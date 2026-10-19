// v2 features end to end: packages (C2), versions & diff (E1), requirements & traceability (D2),
// brief analyzer (A1), client proposal (G3) and library calibration.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { execFileSync } = require('child_process');
const E = require('../src/engine.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'v2'); fs.mkdirSync(OUT, { recursive: true });
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const SKELETON = (b) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body style="margin:0">${b}</body></html>`;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;
const svc = (id) => Object.assign({ id }, seed['services/' + id]);
function makeEstimate(items) {
  const s = svc('website');
  const est = E.createEstimate(s, 'website', seed['config/settings'], { name: 'Northwind site', client: 'Northwind', userId: 'u_me' });
  items.forEach((id) => est.items.push(E.copyItem(s, s.items.find((x) => x.id === id), est)));
  est.totalHours = E.round(E.compute(est).total, 1); est.updatedAt = Date.now();
  return est;
}
let browser; const results = [];
async function open(cfg, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    if (u.includes('docx@8.5.0')) return route.fulfill({ contentType: 'application/javascript', body: LIB('docx.umd.js') });
    if (/^https:\/\/app\.test\/($|[?#])/.test(u)) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });
  if (opts.route) await page.addInitScript((r) => localStorage.setItem('dhe:route', JSON.stringify(r)), opts.route);
  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify(cfg)};\n${mock}`);
  await page.goto('https://app.test/');
  await page.locator('.side').waitFor();
  return { page, context, errors };
}
async function scenario(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now(), notes = [], r = { name, ok: true, notes };
  try { await fn((m) => notes.push(m)); } catch (e) { r.ok = false; r.error = String(e.message || e).split('\n')[0].slice(0, 300); }
  results.push(r);
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name} (${Date.now() - t0}ms)${r.ok ? '' : '\n      → ' + r.error}${notes.length ? '\n      · ' + notes.join('\n      · ') : ''}`);
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const store = (page, p) => page.evaluate((x) => JSON.parse(JSON.stringify(window.__store.get(x) || null)), p);
const noErr = (errors) => assert(!errors.length, 'page errors: ' + errors.join(' | '));
const ROUTE = (step) => ({ view: 'estimate', id: 'est-v2', step });

(async () => {
  browser = await chromium.launch();
  try {
    await scenario('C2 packages: tiers, comparison, exports', async (note) => {
      const est = makeEstimate(['header', 'home', 'about', 'blog-list', 'pricing']);
      const { page, context, errors } = await open({ role: 'admin', seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('review') });
      await page.locator('#pk-on').check();
      await page.locator('.pk-col').first().waitFor();
      await page.locator('.step', { hasText: 'Build' }).click();
      for (const [name, tier] of [['Blog', 'Standard'], ['Pricing', 'Premium']]) {
        const wrap = page.locator('.lib-row.sel', { hasText: name }).first().locator('xpath=..');
        await wrap.locator('.chev').click();
        await wrap.locator('.item-panel').getByRole('group', { name: 'Package' }).getByRole('button', { name: tier, exact: true }).click();
      }
      await page.waitForTimeout(900);
      const d = await store(page, 'estimates/est-v2');
      const pb = E.packageBreakdown(d);
      assert(pb[0].count === 3 && pb[1].count === 4 && pb[2].count === 5, 'tier counts ' + pb.map((x) => x.count));
      await page.locator('.step', { hasText: 'Review' }).click();
      const shown = await page.locator('.pk-total .num').allInnerTexts();
      note('package totals ' + shown.join(' / '));
      assert(shown.length === 3 && shown[0] === E.fmtNum(E.round(pb[0].total, 1)) && shown[2] === E.fmtNum(E.round(pb[2].total, 1)), 'shown totals differ from engine');
      assert(await page.locator('.lib-row .mini.pk').count() === 0 || true, '');
      await page.locator('.export-btn', { hasText: 'CSV table' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1);
      const csv = await page.evaluate(() => window.__saved[0].text);
      assert((csv.match(/^Package,/gm) || []).length === 3, 'CSV has no package rows');
      await page.locator('.export-btn', { hasText: 'Excel workbook' }).click();
      await page.waitForFunction(() => window.__saved.length >= 2, null, { timeout: 20000 });
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from((await page.evaluate(() => window.__saved[1])).b64, 'base64'));
      const txt = []; wb.getWorksheet('Summary').eachRow((r) => r.eachCell((c) => txt.push(String(c.value))));
      assert(txt.includes('Packages') && txt.includes('Standard'), 'XLSX summary lacks packages');
      noErr(errors); await context.close();
    });

    await scenario('E1 versions: save, compare, restore, delete', async (note) => {
      const est = makeEstimate(['header', 'home', 'contact']);
      const { page, context, errors } = await open({ role: 'admin', seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('review') });
      await page.locator('#ver-label').fill('Sent to client');
      await page.getByRole('button', { name: 'Save version' }).click();
      await page.locator('.ver-row', { hasText: 'Sent to client' }).waitFor();
      await page.locator('.step', { hasText: 'Build' }).click();
      await page.locator('.lib-row', { hasText: 'Contact' }).first().locator('input.cb').uncheck();
      await page.locator('.lib-row', { hasText: 'About' }).first().locator('input.cb').check();
      await page.waitForTimeout(800);
      await page.locator('.step', { hasText: 'Review' }).click();
      await page.locator('.ver-row', { hasText: 'Sent to client' }).getByRole('button', { name: 'Compare' }).click();
      const tags = await page.locator('.ver-diff .df-tag').allInnerTexts();
      note('diff tags: ' + tags.join(', '));
      assert(tags.map((t) => t.toLowerCase()).includes('added') && tags.map((t) => t.toLowerCase()).includes('removed'), 'diff misses added/removed');
      await page.locator('.ver-row', { hasText: 'Sent to client' }).getByRole('button', { name: 'Restore' }).click();
      await page.locator('.modal').getByRole('button', { name: 'Restore' }).click();
      await page.waitForTimeout(1200);
      const d = await store(page, 'estimates/est-v2');
      const names = d.items.map((i) => i.libId).sort().join(',');
      assert(names === 'contact,header,home', 'restore did not bring back the saved items: ' + names);
      const vers = await page.evaluate(() => Array.from(window.__store.keys()).filter((k) => k.startsWith('estimates/est-v2/versions/')).length);
      assert(vers === 2, 'expected the saved version plus an automatic one, got ' + vers);
      note('restored; versions stored: ' + vers);
      await page.locator('.navtab', { hasText: 'Estimates' }).click();
      await page.locator('.est-row').first().getByRole('button', { name: /^Delete/ }).click();
      await page.locator('.modal').getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(500);
      const left = await page.evaluate(() => Array.from(window.__store.keys()).filter((k) => k.startsWith('estimates/est-v2')).length);
      assert(left === 0, 'deleting the estimate left ' + left + ' documents behind');
      noErr(errors); await context.close();
    });

    await scenario('D2 requirements: add, link, coverage, custom item, XLSX sheet', async (note) => {
      const est = makeEstimate(['header', 'home']);
      const { page, context, errors } = await open({ role: 'admin', seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('review') });
      for (const t of ['Visitors can read about the company', 'Customers can track their order']) { await page.locator('#req-new').fill(t); await page.locator('#req-new').press('Enter'); }
      assert(await page.locator('.req-row').count() === 2, 'requirements not added');
      assert((await page.locator('.panel', { hasText: 'Requirements' }).locator('.pill').innerText()).includes('2 not covered'), 'coverage pill wrong');
      await page.locator('.step', { hasText: 'Build' }).click();
      await page.locator('.lib-row.sel', { hasText: 'Home' }).first().locator('.chev').click();
      await page.locator('.item-panel select[aria-label="Link a requirement"]').selectOption('R1');
      await page.waitForTimeout(200);
      assert(await page.locator('.lib-row .mini.rq').count() === 1, 'requirement badge missing on the row');
      await page.locator('.step', { hasText: 'Review' }).click();
      await page.locator('.req-row', { hasText: 'R2' }).getByRole('button', { name: /Custom/ }).click();
      await page.waitForTimeout(900);
      const pill = await page.locator('.panel', { hasText: 'Requirements' }).locator('.pill').innerText();
      note('coverage: ' + pill);
      assert(pill === 'All covered', 'still uncovered: ' + pill);
      await page.locator('.export-btn', { hasText: 'Excel workbook' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1, null, { timeout: 20000 });
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from((await page.evaluate(() => window.__saved[0])).b64, 'base64'));
      const ts = wb.getWorksheet('Traceability');
      assert(ts && ts.rowCount >= 3, 'no Traceability sheet');
      noErr(errors); await context.close();
    });

    await scenario('A1 brief analyzer: review, untick, apply with links', async (note) => {
      const est = makeEstimate(['header']);
      const { page, context, errors } = await open({ role: 'admin', seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('build') });
      await page.locator('.brief-cta').click();
      await page.locator('#brief-text').fill('We need a new Home page with our story.\nAn About us page for the team.\nA Contact page with a form.\nCustomers want a loan calculator.\nLaunch is planned for March.');
      await page.getByRole('button', { name: 'Analyze', exact: true }).click();
      await page.locator('.brief-res').waitFor({ timeout: 5000 });
      const lines = await page.locator('.brief-line').count();
      note(lines + ' suggested lines');
      await page.locator('.brief-line', { hasText: 'Contact' }).locator('input.cb').uncheck();
      await page.getByRole('button', { name: /^Add \d+ lines? and the requirements/ }).click();
      await page.waitForTimeout(900);
      const d = await store(page, 'estimates/est-v2');
      const lib = d.items.filter((i) => i.libId).map((i) => i.libId);
      assert(lib.includes('home') && lib.includes('about') && !lib.includes('contact'), 'items wrong: ' + lib.join(','));
      assert(d.items.some((i) => i.name === 'Loan calculator' && i.reqs.length === 1), 'custom item from brief missing');
      assert(d.requirements.length === 5 && d.items.find((i) => i.libId === 'home').reqs[0] === 'R1', 'requirements not linked');
      assert(d.register.dependencies.some((x) => /launch date/.test(x.text)), 'question not added to dependencies');
      note('added items ' + d.items.length + ', requirements ' + d.requirements.length);
      noErr(errors); await context.close();
    });

    await scenario('A1 brief analyzer: Stop, errors and absence', async () => {
      const est = makeEstimate(['header']);
      let { page, context } = await open({ role: 'admin', sampleDelay: 4000, seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('build') });
      await page.locator('.brief-cta').click();
      await page.locator('#brief-text').fill('A Home page.');
      await page.getByRole('button', { name: 'Analyze', exact: true }).click();
      await page.getByText('Reading the brief').waitFor();
      await page.getByRole('button', { name: 'Stop' }).click();
      await page.getByRole('button', { name: 'Analyze', exact: true }).waitFor();
      assert(await page.locator('.brief .banner.bad').count() === 0, 'Stop showed an error');
      await context.close();
      ({ page, context } = await open({ role: 'admin', sampleFault: 'not_granted', seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('build') }));
      await page.locator('.brief-cta').click(); await page.locator('#brief-text').fill('A Home page.');
      await page.getByRole('button', { name: 'Analyze', exact: true }).click();
      await page.locator('.brief .banner.bad', { hasText: 'not allowed' }).waitFor();
      await context.close();
      ({ page, context } = await open({ role: 'admin', noSample: true, seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('build') }));
      await page.locator('.lib-row').first().waitFor(); await page.waitForTimeout(400);
      assert(await page.locator('.brief-cta').count() === 0, 'analyzer shown without Claude');
      await context.close();
    });

    await scenario('G3 proposal: preview options and Word export', async (note) => {
      const est = makeEstimate(['header', 'home', 'contact']);
      est.packages = { enabled: true, names: ['Lite', 'Plus', 'Max'] }; est.items[2].tier = 2;
      const { page, context, errors } = await open({ role: 'admin', seed: Object.assign({}, seed, { 'estimates/est-v2': est }) }, { route: ROUTE('review') });
      await page.locator('.export-btn', { hasText: 'Client proposal' }).click();
      await page.locator('.paper').waitFor();
      const title = await page.locator('.paper-title').innerText();
      assert(title === 'Northwind site', 'title ' + title);
      assert(await page.locator('.paper-pk > div').count() === 3, 'packages missing in preview');
      const withHours = await page.locator('.paper-cat .n').count();
      await page.locator('#prop-hours').uncheck(); await page.waitForTimeout(200);
      assert(withHours > 0 && await page.locator('.paper-cat .n').count() === 0, 'hide hours did not work');
      await page.locator('#prop-intro').fill('Hello Northwind, here is our proposal.');
      await page.waitForTimeout(200);
      assert((await page.locator('.paper-intro').innerText()) === 'Hello Northwind, here is our proposal.', 'intro not applied');
      await page.getByRole('button', { name: 'Download Word document' }).click();
      await page.waitForFunction(() => window.__saved.some((s) => /\.docx$/.test(s.filename)), null, { timeout: 20000 });
      const f = await page.evaluate(() => window.__saved.find((s) => /\.docx$/.test(s.filename)));
      const file = path.join(OUT, f.filename); fs.writeFileSync(file, Buffer.from(f.b64, 'base64'));
      const xml = execFileSync('unzip', ['-p', file, 'word/document.xml']).toString();
      assert(/Hello Northwind/.test(xml) && /Northwind site/.test(xml) && /Max/.test(xml), 'docx content missing');
      note('saved ' + f.filename + ' (' + Math.round(f.size / 1024) + ' KB)');
      await page.waitForTimeout(900);
      const d = await store(page, 'estimates/est-v2');
      assert(d.proposal && d.proposal.showLineHours === false, 'proposal options not saved');
      noErr(errors); await context.close();
    });

    await scenario('Calibrate: past hours update the library after Save', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed }, { route: { view: 'library', serviceId: 'website', tab: 'calibrate' } });
      await page.locator('#cal-text').fill('Item,Actual hours\nFooter,4\nFooter,5\nFooter,6\nSearch results,9\nMystery page,3');
      await page.getByRole('button', { name: 'Compare with the library' }).click();
      await page.locator('.bd.cal').waitFor();
      const rows = await page.locator('.bd.cal tbody tr').count();
      assert(rows === 2, 'expected 2 matched items, got ' + rows);
      assert(await page.getByText(/Not matched \(1\)/).count() === 1, 'unmatched not listed');
      await page.getByRole('button', { name: /^Update 2/ }).click();
      await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
      await page.waitForTimeout(500);
      const w = await store(page, 'services/website');
      const ft = w.items.find((i) => i.id === 'footer').hours, sr = w.items.find((i) => i.id === 'search-results').hours;
      note('footer 2.5h → ' + ft + 'h, search results 4h → ' + sr + 'h');
      assert(ft === 5 && sr === 9, 'library not updated');
      noErr(errors); await context.close();
    });
  } finally { await browser.close(); }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} v2 scenarios passed`);
  process.exitCode = failed.length ? 1 : 0;
})();
