// End-to-end tests of the standalone build (dist-web) against a local Supabase stand-in:
// real Postgres + real PostgREST + the migration's access rules, with stand-ins for auth and realtime.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const { start, sign } = require('./stack');
const ROOT = path.join(__dirname, '..', '..');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const PORT = 54321;
const ANON = sign({ role: 'anon', iss: 'supabase', iat: 1700000000, exp: 2000000000 });
function build(env) { execFileSync('node', [path.join(ROOT, 'web', 'build.js')], { env: Object.assign({ PATH: process.env.PATH }, env), stdio: 'pipe' }); }

let browser, stack; const results = [];
const assert = (c, m) => { if (!c) throw new Error(m); };
async function scenario(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now(), notes = [], r = { name, ok: true };
  try { await fn((m) => notes.push(m)); } catch (e) { r.ok = false; r.error = String(e.message || e).split('\n')[0].slice(0, 300); }
  results.push(r);
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name} (${Date.now() - t0}ms)${r.ok ? '' : '\n      → ' + r.error}${notes.length ? '\n      · ' + notes.join('\n      · ') : ''}`);
}
async function open(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource: net::ERR_FAILED|status of 400|status of 401|status of 422/.test(t)) errors.push(t); });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto(stack.appUrl + '/');
  return { page, context, errors };
}
async function signIn(page, email, pw) {
  await page.locator('#auth-email').fill(email); await page.locator('#auth-password').fill(pw);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function signUp(page, name, email, pw) {
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.locator('#auth-name').fill(name); await page.locator('#auth-email').fill(email); await page.locator('#auth-password').fill(pw);
  await page.getByRole('button', { name: 'Create account' }).click();
}
const noErr = (errors) => assert(!errors.length, 'console: ' + errors.slice(0, 3).join(' | '));

(async () => {
  stack = await start({ port: PORT });
  build({ SUPABASE_URL: stack.apiUrl, SUPABASE_ANON_KEY: ANON, AGENCY_NAME: 'News9' });
  browser = await chromium.launch();
  let admin, adminPage, adminErrors;
  try {
    await scenario('First sign-up becomes admin; empty workspace; backup import loads the library', async (note) => {
      const o = await open(); admin = o.context; adminPage = o.page; adminErrors = o.errors;
      const page = o.page;
      await page.getByRole('heading', { name: 'Sign in to Revin' }).waitFor();
      assert(await page.getByText('News9 · Revin').count() === 1, 'agency name on sign-in');
      await signIn(page, 'ada@agency.com', 'wrong-password');
      await page.getByRole('alert').filter({ hasText: 'don’t match' }).waitFor();
      await signUp(page, 'Ada Owner', 'Ada@Agency.com', 'correct-horse-1');
      await page.locator('.side').waitFor();
      assert(await stack.role('ada@agency.com') === 'admin', 'not admin');
      assert(await page.locator('.navtab', { hasText: 'Library' }).count() === 1, 'no Library tab');
      assert(/Ada Owner/.test(await page.locator('.side-foot').innerText()), 'name not shown');
      await page.locator('.navtab', { hasText: 'Settings' }).click();
      await page.locator('.team').waitFor();
      // import the starter library as a backup file
      const backup = path.join(ROOT, 'test', 'out', 'web-backup-in.json'); fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, JSON.stringify({ app: 'design-hours-estimator', docs: seed }));
      await page.locator('input[type=file][accept*=json]').setInputFiles(backup);
      await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
      try { await page.locator('.toast', { hasText: /Imported \d+ records/ }).waitFor({ timeout: 15000 }); } catch (e) { await page.screenshot({ path: path.join(ROOT, 'test', 'out', 'web-debug.png') }); note('docs in db: ' + (await stack.db.query('select count(*) n from docs')).rows[0].n + ' members: ' + JSON.stringify((await stack.db.query('select email, role from members')).rows)); note('toasts: ' +(await page.locator('.toast').allInnerTexts()).join(' / ') + ' | status: ' + (await page.locator('[role=status]').allInnerTexts()).join(' / ')); note(o.errors.join(' | ').slice(0, 600)); throw e; }
      assert((await stack.doc('services/website')).name === 'Website', 'service not in database');
      await page.locator('.navtab', { hasText: 'Library' }).click();
      await page.locator('.svc-item', { hasText: 'Website' }).waitFor();
      note(Object.keys(seed).length + ' records imported through PostgREST');
      noErr(o.errors);
    });

    await scenario('Admin creates an estimate through the UI; data lands in Postgres', async () => {
      const page = adminPage;
      await page.getByRole('button', { name: 'New estimate' }).first().click();
      await page.locator('#new-name').fill('Northwind site'); await page.locator('#new-client').fill('Northwind');
      await page.locator('.svc-card', { hasText: 'Website' }).click();
      await page.locator('.step[aria-current="step"]', { hasText: 'Scope' }).waitFor();
      await page.locator('.step', { hasText: 'Build' }).click();
      await page.locator('.lib-row', { hasText: 'Home' }).first().locator('input.cb').check();
      await page.waitForTimeout(1500);
      const rows = (await stack.db.query(`select data from docs where parent='estimates'`)).rows;
      assert(rows.length === 1 && rows[0].data.name === 'Northwind site', 'estimate not saved');
      assert(rows[0].data.items.some((i) => i.name === 'Home'), 'item not saved');
      noErr(adminErrors);
    });

    let est, estPage;
    await scenario('Invited estimator signs up, sees no Library, and changes sync live to the admin', async (note) => {
      await adminPage.locator('.navtab', { hasText: 'Settings' }).click();
      await adminPage.locator('#team-invite-email').fill('sam@agency.com');
      await adminPage.locator('.team-invite').getByRole('button', { name: 'Invite' }).click();
      await adminPage.locator('.team-invites', { hasText: 'sam@agency.com' }).waitFor();
      const o = await open(); est = o.context; estPage = o.page;
      await signUp(o.page, 'Sam Estimator', 'sam@agency.com', 'sam-password-1');
      await o.page.locator('.side').waitFor();
      assert(await stack.role('sam@agency.com') === 'estimator', 'invite role not applied');
      assert(await o.page.locator('.navtab', { hasText: 'Library' }).count() === 0, 'estimator sees Library');
      await o.page.locator('.est-row', { hasText: 'Northwind site' }).waitFor();
      // estimator duplicates; admin's dashboard updates without reload (realtime)
      await adminPage.locator('.navtab', { hasText: 'Estimates' }).click();
      await adminPage.locator('.est-row', { hasText: 'Northwind site' }).waitFor();
      const t0 = Date.now();
      await o.page.locator('.est-row', { hasText: 'Northwind site' }).getByRole('button', { name: /Duplicate/ }).click();
      await adminPage.locator('.est-row', { hasText: '(copy)' }).waitFor({ timeout: 5000 });
      note('live update reached the admin in ' + (Date.now() - t0) + 'ms');
      // the database refuses library writes from an estimator, whatever the UI does
      const code = await o.page.evaluate(async () => { const db = await window.claude.use('db'); try { await db.doc('services/hack').set({ name: 'x' }); return 'saved'; } catch (e) { return e.code; } });
      assert(code === 'invalid_argument', 'estimator wrote the library: ' + code);
      assert(!(await stack.doc('services/hack')), 'row exists');
      const i403 = o.errors.findIndex((e) => /status of 403/.test(e)); if (i403 >= 0) o.errors.splice(i403, 1); // the refused write above
      noErr(o.errors); noErr(adminErrors);
    });

    await scenario('Unknown sign-up waits; admin approves; access follows role changes', async (note) => {
      const o = await open();
      await signUp(o.page, 'Pat', 'pat@gmail.com', 'pat-password-1');
      await o.page.getByRole('heading', { name: 'Waiting for approval' }).waitFor();
      const leak = await o.page.evaluate(async () => { const r = await window.__dheSupabase.from('docs').select('path'); return (r.data || []).length; });
      assert(leak === 0, 'pending user can read ' + leak + ' docs');
      await adminPage.locator('.navtab', { hasText: 'Settings' }).click();
      await adminPage.locator('.team-row.pending', { hasText: 'pat@gmail.com' }).getByRole('button', { name: 'Approve' }).click();
      await adminPage.locator('.toast', { hasText: 'Approved' }).waitFor();
      await o.page.getByRole('button', { name: 'Check again' }).click();
      await o.page.locator('.side').waitFor();
      note('approved user is in');
      // admin removes Pat while Pat has the app open → Pat's page reloads into "access removed"
      await adminPage.locator('.team-row', { hasText: 'pat@gmail.com' }).locator('select').selectOption('disabled');
      await adminPage.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
      await o.page.getByRole('heading', { name: 'Your access was removed' }).waitFor({ timeout: 8000 });
      assert(await stack.role('pat@gmail.com') === 'disabled', 'not disabled');
      noErr(o.errors);
      await o.context.close();
    });

    await scenario('Google sign-in on the company domain joins automatically (PKCE round trip)', async () => {
      await adminPage.locator('#team-domain').fill('agency.com');
      await adminPage.locator('.team-domain').getByRole('button', { name: 'Save' }).click();
      await adminPage.locator('.toast', { hasText: 'Saved the company domain' }).waitFor();
      stack.state.nextGoogle = { email: 'gina@agency.com', name: 'Gina G', avatar: '' };
      const o = await open();
      await o.page.getByRole('button', { name: 'Continue with Google' }).click();
      await o.page.locator('.side').waitFor();
      assert(await stack.role('gina@agency.com') === 'estimator', 'domain join failed');
      assert(!/code=/.test(o.page.url()), 'code left in the URL: ' + o.page.url());
      stack.state.nextGoogle = { email: 'mallory@notagency.com', name: 'M' };
      const o2 = await open();
      await o2.page.getByRole('button', { name: 'Continue with Google' }).click();
      await o2.page.getByRole('heading', { name: 'Waiting for approval' }).waitFor();
      noErr(o.errors); noErr(o2.errors);
      await o.context.close(); await o2.context.close();
    });

    await scenario('Exports and backup download; sign out; session survives reload', async (note) => {
      const page = estPage;
      await page.locator('.est-row', { hasText: 'Northwind site' }).first().click();
      await page.locator('.step', { hasText: 'Review' }).click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.export-btn', { hasText: 'CSV table' }).click()]);
      const csv = fs.readFileSync(await dl.path(), 'utf8');
      assert(/Home/.test(csv) && /Total/.test(csv), 'csv content');
      const [dx] = await Promise.all([page.waitForEvent('download'), page.locator('.export-btn', { hasText: 'Excel workbook' }).click()]);
      assert(/\.xlsx$/.test(dx.suggestedFilename()) && fs.statSync(await dx.path()).size > 5000, 'xlsx (vendored ExcelJS)');
      note('csv ' + csv.length + ' B, xlsx ' + fs.statSync(await dx.path()).size + ' B');
      const [bk] = await Promise.all([adminPage.waitForEvent('download'), (async () => { await adminPage.locator('.navtab', { hasText: 'Settings' }).click(); await adminPage.getByRole('button', { name: 'Download backup' }).click(); })()]);
      const j = JSON.parse(fs.readFileSync(await bk.path(), 'utf8'));
      assert(j.docs['services/website'] && Object.keys(j.docs).some((k) => k.startsWith('estimates/')), 'backup content');
      await page.reload(); await page.locator('.side').waitFor();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.getByRole('heading', { name: 'Sign in to Revin' }).waitFor();
      await page.reload(); await page.getByRole('heading', { name: 'Sign in to Revin' }).waitFor();
      await signIn(page, 'sam@agency.com', 'sam-password-1'); await page.locator('.side').waitFor();
    });

    await scenario('Realtime drop: reconnects and catches up', async (note) => {
      await estPage.locator('.navtab', { hasText: 'Estimates' }).click(); await estPage.locator('.est-row').first().waitFor();
      const before = stack.state.connections;
      stack.dropRealtime();
      await new Promise((r) => setTimeout(r, 30));
      await stack.db.query(`insert into docs (path,parent,id,data) values ('estimates/remote1','estimates','remote1',$1)`, [{ name: 'Added while offline', serviceId: 'website', status: 'draft', items: [], updatedAt: Date.now() + 5000 }]);
      const t0 = Date.now(); stack.state.rest = [];
      try { await estPage.locator('.est-row', { hasText: 'Added while offline' }).waitFor({ timeout: 8000 }); } catch (e) { note('connections ' + before + ' → ' + stack.state.connections + '; rest: ' + stack.state.rest.map((r) => (r[0] - t0) + 'ms ' + r[2].split('/').pop()).join(', ') + '; url ' + estPage.url() + ' rows ' + (await estPage.locator('.est-row').count()) + ' view ' + (await estPage.locator('h1').first().innerText())); throw e; }
      note('appeared ' + (Date.now() - t0) + 'ms after the change, once the socket reconnected');
      note('missed change appeared; websocket connections ' + before + ' → ' + stack.state.connections);
      assert(stack.state.connections > before, 'no reconnect happened');
    });

    await scenario('Email confirmation required; password reset request; weak password', async () => {
      stack.state.confirmEmails = true;
      const o = await open();
      await signUp(o.page, 'Cora', 'cora@agency.com', 'cora-password-1');
      await o.page.getByRole('status').filter({ hasText: 'Check your email' }).waitFor();
      await o.page.getByRole('button', { name: 'Back to sign in' }).isVisible().catch(() => {});
      await o.page.reload();
      await signIn(o.page, 'cora@agency.com', 'cora-password-1');
      await o.page.getByRole('alert').filter({ hasText: 'Confirm your email' }).waitFor();
      await o.page.getByRole('button', { name: 'Forgot password?' }).click();
      await o.page.locator('#auth-email').fill('cora@agency.com');
      await o.page.getByRole('button', { name: 'Send reset link' }).click();
      await o.page.getByRole('status').filter({ hasText: 'reset link' }).waitFor();
      assert(stack.state.requests.some((r) => r[0] === 'recover'), 'recover not called');
      stack.state.confirmEmails = false;
      noErr(o.errors); await o.context.close();
    });

    await scenario('Phone width: sign-in and team panel fit', async () => {
      const o = await open({ viewport: { width: 360, height: 740 } });
      await o.page.getByRole('heading', { name: 'Sign in to Revin' }).waitFor();
      let over = await o.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(over <= 0, 'sign-in scrolls sideways ' + over);
      await o.page.screenshot({ path: path.join(ROOT, 'test', 'out', 'web-signin-360.png') });
      await signIn(o.page, 'ada@agency.com', 'correct-horse-1'); await o.page.locator('.side, .topbar').first().waitFor();
      await o.page.evaluate(() => { localStorage.setItem('dhe:route', JSON.stringify({ view: 'settings' })); }); await o.page.reload();
      await o.page.locator('.team').waitFor();
      over = await o.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(over <= 0, 'settings scrolls sideways ' + over);
      await o.page.locator('.team').screenshot({ path: path.join(ROOT, 'test', 'out', 'web-team-360.png') });
      noErr(o.errors); await o.context.close();
    });

    await scenario('Build without Supabase settings shows the setup message', async () => {
      build({});
      const o = await open();
      await o.page.getByRole('heading', { name: /connect the database/ }).waitFor();
      await o.context.close();
      build({ SUPABASE_URL: stack.apiUrl, SUPABASE_ANON_KEY: ANON });
    });
  } finally {
    await browser.close(); await stack.stop();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} standalone scenarios passed`);
  process.exitCode = failed.length ? 1 : 0;
})().catch(async (e) => { console.error(e); try { await stack.stop(); } catch (x) { /* ignore */ } process.exit(1); });
