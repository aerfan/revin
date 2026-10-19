// Lead-QA frontend suite: functional edge cases, fault injection, stress/performance, security, keyboard.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const E = require('../src/engine.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'qa');
fs.mkdirSync(OUT, { recursive: true });
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const SKELETON = (body) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;

const svc = (id) => Object.assign({ id }, seed['services/' + id]);
const settings = seed['config/settings'];
function makeEstimate(serviceId, name, opts = {}) {
  const s = svc(serviceId);
  const est = E.createEstimate(s, serviceId, settings, { name, client: opts.client || 'QA Client', userId: 'u_me' });
  (opts.items || s.items.slice(0, opts.count || 6).map((i) => i.id)).forEach((id) => { const li = s.items.find((x) => x.id === id); if (li) est.items.push(E.copyItem(s, li, est)); });
  est.totalHours = E.round(E.compute(est).total, 1);
  est.updatedAt = opts.updatedAt || Date.now();
  return est;
}
function seedWith(extra) { return Object.assign({}, seed, extra); }

const results = [];
let browser;
async function open(cfg, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    if (/^https:\/\/app\.test\/($|[?#])/.test(u)) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });
  if (cfg) await page.addInitScript(`window.__MOCK__ = ${JSON.stringify(cfg)};\n${mock}`);
  if (opts.preload) await page.addInitScript(opts.preload);
  await page.goto('https://app.test/');
  return { page, context, errors };
}
async function scenario(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now();
  const notes = [];
  const r = { name, ok: true, notes, ms: 0 };
  try { await fn((msg) => notes.push(msg)); } catch (e) { r.ok = false; r.error = String(e && e.message || e).split('\n')[0].slice(0, 300); }
  r.ms = Date.now() - t0;
  results.push(r);
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name} (${r.ms}ms)${r.ok ? '' : '\n      → ' + r.error}${notes.length ? '\n      · ' + notes.join('\n      · ') : ''}`);
}
function assert(c, m) { if (!c) throw new Error(m); }
async function noErrors(errors, label) { assert(!errors.length, (label || '') + ' console/page errors: ' + errors.slice(0, 3).join(' | ')); }
const store = (page, p) => page.evaluate((x) => { const d = window.__store.get(x); return d ? JSON.parse(JSON.stringify(d)) : null; }, p);
const estDocs = (page) => page.evaluate(() => Array.from(window.__store.entries()).filter(([k]) => k.startsWith('estimates/')).map(([k, v]) => Object.assign({ path: k }, v)));
async function newEstimate(page, service, name) {
  await page.locator('.side-new').click();
  if (name) await page.locator('#new-name').fill(name);
  await page.locator('.svc-card', { hasText: service }).click();
  await page.locator('.step[aria-current="step"]', { hasText: 'Scope' }).waitFor();
}
async function step(page, nm) { await page.locator('.step', { hasText: nm }).click(); await page.waitForTimeout(80); }
async function frame(page, fn) {
  return page.evaluate(async (src) => { const t0 = performance.now(); (0, eval)(src)(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0; }, fn);
}

(async () => {
  browser = await chromium.launch();
  try {
    // ================================================================ A. functional edge cases
    await scenario('A1 switching service clears items and loads the new scope', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Website', 'Switch test');
      await step(page, 'Build');
      await page.locator('.packs .chip', { hasText: 'Corporate website' }).click();
      await step(page, 'Service');
      await page.locator('.svc-card', { hasText: 'Mobile application' }).click();
      await page.locator('.modal').getByRole('button', { name: 'Switch service' }).click();
      await page.waitForTimeout(900);
      const d = (await estDocs(page))[0];
      assert(d.serviceId === 'mobile-app' && d.items.length === 0, 'service not switched / items kept: ' + d.serviceId + ' ' + d.items.length);
      assert(d.snapshot.optionGroups.some((g) => g.id === 'platforms'), 'mobile scope groups missing');
      assert(await page.locator('.step[aria-current="step"]', { hasText: 'Scope' }).count() === 1, 'did not land on Scope');
      await noErrors(errors); await context.close();
    });
    await scenario('A2 adding a starter pack twice creates no duplicates', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Mobile application');
      await step(page, 'Build');
      await page.locator('.packs .chip', { hasText: 'Standard auth' }).click();
      await page.locator('.packs .chip', { hasText: 'Standard auth' }).click();
      await page.waitForTimeout(800);
      const d = (await estDocs(page))[0];
      const libIds = d.items.map((i) => i.libId);
      assert(libIds.length === 4 && new Set(libIds).size === 4, 'duplicates: ' + libIds.join());
      assert(await page.locator('.toast', { hasText: 'already added' }).count() === 1, 'no "already added" feedback');
      await noErrors(errors); await context.close();
    });
    await scenario('A3 number fields clamp and reject bad input', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Website');
      await step(page, 'Build');
      await page.locator('.lib-row', { hasText: 'Service detail' }).locator('input.cb').check();
      const panel = page.locator('.item-panel').first();
      const qty = panel.locator('.ctl', { hasText: 'Quantity' }).locator('input');
      const cases = [['abc', 1], ['0', 1], ['500', 99], ['2.5', null], ['-4', 1], ['7', 7]];
      const got = [];
      for (const [typed] of cases) { await qty.fill(typed); await qty.press('Tab'); await page.waitForTimeout(60); got.push(await qty.inputValue()); }
      note('quantity inputs ' + cases.map((c, i) => `"${c[0]}"→${got[i]}`).join(', '));
      assert(got[0] === '1' && got[1] === '1' && got[2] === '99' && got[4] === '1' && got[5] === '7', 'quantity clamping wrong: ' + got.join());
      assert(got[3] === '2' || got[3] === '3', 'quantity accepted a fraction: 2.5 → ' + got[3]);
      const hrs = panel.locator('.ip-foot .stepper input').first();
      await hrs.fill('1e9'); await hrs.press('Tab'); await page.waitForTimeout(60);
      const big = parseFloat(await hrs.inputValue());
      note('hours "1e9" → ' + big);
      assert(big <= 1000, 'hours accepted an absurd value: ' + big);
      await noErrors(errors); await context.close();
    });
    await scenario('A4 custom deliverables count only with a name', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Website');
      const before = await page.locator('.insp-total .num').innerText();
      await page.getByRole('button', { name: 'Add custom deliverable' }).click();
      await page.waitForTimeout(100);
      assert(await page.locator('.insp-total .num').innerText() === before, 'unnamed deliverable changed the total');
      await page.locator('.custom-row input.input').fill('Workshop');
      await page.waitForTimeout(100);
      const after = parseFloat(await page.locator('.insp-total .num').innerText());
      assert(after > parseFloat(before), 'named deliverable not counted');
      await noErrors(errors); await context.close();
    });
    await scenario('A5 register edits and hidden library lines flow into the XLSX', async (note) => {
      const est = makeEstimate('website', 'Register test', { items: ['header', 'home', 'contact', 'cart', 'checkout'] });
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-reg': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      const firstAuto = page.locator('.reg-item:has(.src)').first();
      const hiddenText = await firstAuto.locator('.txt').innerText();
      await firstAuto.getByRole('button', { name: 'Leave this line out' }).click();
      await page.locator('#reg-new-dependencies').fill('Brand guidelines from the client');
      await page.locator('form', { has: page.locator('#reg-new-dependencies') }).locator('button[type="submit"]').click();
      await page.waitForTimeout(900);
      await page.locator('.export-btn', { hasText: 'Excel workbook' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1, null, { timeout: 20000 });
      const x = (await page.evaluate(() => window.__saved))[0];
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(x.b64, 'base64'));
      const txt = []; wb.getWorksheet('Assumptions').eachRow((r) => r.eachCell((c) => txt.push(String(c.value))));
      const all = txt.join(' | ');
      assert(all.includes('Brand guidelines from the client'), 'new dependency missing from XLSX');
      assert(!all.includes(hiddenText), 'hidden library line still exported: ' + hiddenText.slice(0, 60));
      note('hidden line excluded, dependency included');
      await noErrors(errors); await context.close();
    });
    await scenario('A6 status changes update dashboard filters', async () => {
      const est = makeEstimate('website', 'Status test');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-st': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('#est-status').selectOption('won');
      await page.waitForTimeout(900);
      await page.locator('.navtab', { hasText: 'Estimates' }).click();
      await page.locator('.chip', { hasText: 'Won' }).click();
      assert(await page.locator('.est-row').count() === 1 && (await page.locator('.est-row .pill').innerText()) === 'Won', 'won filter wrong');
      await page.locator('.chip', { hasText: 'Draft' }).click();
      assert(await page.getByText('No matching estimates').count() === 1, 'draft filter should be empty');
      await noErrors(errors); await context.close();
    });
    await scenario('A7 save a custom item to the library (admin)', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Web application');
      await step(page, 'Build');
      await page.locator('#custom-name').fill('Audit export');
      await page.locator('form.inline-form', { has: page.locator('#custom-name') }).locator('button[type="submit"]').click();
      await page.getByRole('button', { name: 'Save to library' }).click();
      await page.waitForFunction(() => window.__store.get('services/web-app').items.some((i) => i.name === 'Audit export'), null, { timeout: 5000 });
      await page.waitForTimeout(800);
      const d = (await estDocs(page))[0];
      const it = d.items.find((i) => i.name === 'Audit export');
      assert(it && it.libId && !it.custom, 'estimate item not linked to the library');
      await noErrors(errors); await context.close();
    });
    await scenario('A8 deactivating a service hides it from new estimates', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await page.locator('.navtab', { hasText: 'Library' }).click();
      await page.locator('.svc-item', { hasText: 'Web application' }).click();
      await page.locator('.cms-tab', { hasText: 'Service details' }).click();
      await page.locator('#svc-active').uncheck();
      await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
      await page.waitForFunction(() => window.__store.get('services/web-app').active === false);
      await page.locator('.side-new').click();
      assert(await page.locator('.svc-card').count() === 2 && await page.locator('.svc-card', { hasText: 'Web application' }).count() === 0, 'inactive service still offered');
      await noErrors(errors); await context.close();
    });
    await scenario('A9 library CRUD: categories, items, options, rules, packs, duplicate, delete', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await page.locator('.navtab', { hasText: 'Library' }).click();
      await page.locator('.cms-tab', { hasText: 'Pages' }).waitFor();
      // delete a category with items → items move
      await page.getByRole('button', { name: 'Delete Utility & legal', exact: true }).click();
      await page.locator('.modal').getByRole('button', { name: 'Delete' }).click();
      // add item to first category and rename it
      await page.locator('.cat-block').first().getByRole('button', { name: 'Add page' }).click();
      await page.locator('[id^="it-name-new-page"]').fill('QA landing');
      // delete item Cart (referenced by gap rules and packs)
      await page.locator('.ed-sum', { hasText: 'Cart' }).first().click();
      await page.locator('.ed-form').getByRole('button', { name: 'Delete' }).click();
      await page.locator('.modal').getByRole('button', { name: 'Delete' }).click();
      // options: add group + option
      await page.locator('.cms-tab', { hasText: 'Scope options' }).click();
      await page.getByRole('button', { name: 'Add option group' }).click();
      await page.locator('.cat-block').last().getByRole('button', { name: 'Add option' }).click();
      // rules: add one
      await page.locator('.cms-tab', { hasText: 'Gap rules' }).click();
      await page.getByRole('button', { name: 'Add rule' }).click();
      // packs: add one
      await page.locator('.cms-tab', { hasText: 'Starter packs' }).click();
      await page.getByRole('button', { name: 'Add starter pack' }).click();
      await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
      await page.waitForTimeout(400);
      const w = await store(page, 'services/website');
      assert(!w.categories.some((c) => c.name === 'Utility & legal'), 'category not deleted');
      assert(w.items.some((i) => i.id === 'not-found' && i.categoryId !== 'utility'), 'items not moved from deleted category');
      assert(w.items.some((i) => i.name === 'QA landing'), 'new item missing');
      assert(!w.items.some((i) => i.id === 'cart'), 'Cart not deleted');
      assert(!w.gapRules.some((r) => r.trigger.ref === 'cart' || r.suggest.ref === 'cart'), 'rules referencing Cart remain');
      assert(!w.starterPacks.some((k) => k.items.includes('cart')), 'packs referencing Cart remain');
      assert(w.optionGroups.length === 6 && w.optionGroups[5].options.length === 1, 'option group/option not added');
      assert(w.gapRules.length === 10, 'rule count unexpected: ' + w.gapRules.length);
      assert(w.starterPacks.length === 5, 'pack not added');
      // duplicate + delete service
      await page.locator('.cms-tab', { hasText: 'Service details' }).click();
      await page.getByRole('button', { name: 'Duplicate service' }).click();
      await page.waitForFunction(() => Array.from(window.__store.values()).some((d) => d.name === 'Website (copy)'));
      await page.getByRole('button', { name: 'Delete service' }).click();
      await page.locator('.modal').getByRole('button', { name: 'Delete service' }).click();
      await page.waitForFunction(() => !Array.from(window.__store.values()).some((d) => d.name === 'Website (copy)'));
      note('category delete moved items; item delete cleaned packs and rules; duplicate/delete service OK');
      await noErrors(errors); await context.close();
    });
    await scenario('A10 settings phases flow into new estimates', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await page.locator('.navtab', { hasText: 'Settings' }).click();
      await page.locator('#phase-new').fill('Phase 4');
      await page.locator('form', { has: page.locator('#phase-new') }).locator('button[type="submit"]').click();
      await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
      await page.waitForFunction(() => window.__store.get('config/settings').phases.length === 4);
      await newEstimate(page, 'Website');
      const d = (await estDocs(page))[0];
      assert(d.snapshot.phases.includes('Phase 4'), 'new estimate missed the new phase');
      await noErrors(errors); await context.close();
    });
    await scenario('A11 deleting an open estimate elsewhere does not silently recreate it', async (note) => {
      const est = makeEstimate('website', 'Deleted elsewhere');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-del': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      await page.evaluate(() => window.__remoteDelete('estimates/est-del'));
      await page.waitForTimeout(200);
      await page.locator('#est-name').fill('Edited after delete');
      await page.waitForTimeout(1000);
      const back = await store(page, 'estimates/est-del');
      const banner = await page.locator('.banner', { hasText: /deleted/i }).count();
      note('doc after edit: ' + (back ? 'recreated' : 'absent') + ', banner: ' + banner);
      assert(!back || banner, 'estimate deleted by someone else was silently recreated by autosave');
      await noErrors(errors); await context.close();
    });
    await scenario('A12 keyboard: rows open with Enter and Space; modal traps focus and Escape closes', async (note) => {
      const est = makeEstimate('website', 'Keyboard test');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-kb': est }) });
      await page.locator('.est-row .est-open').first().focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      const spaceOpened = await page.locator('.total-big').count();
      note('Space on a row ' + (spaceOpened ? 'opens' : 'does nothing'));
      if (!spaceOpened) { await page.locator('.est-row .est-open').first().focus(); await page.keyboard.press('Enter'); await page.locator('.total-big').waitFor(); }
      await page.locator('.navtab', { hasText: 'Estimates' }).click();
      await page.locator('.est-row').first().getByRole('button', { name: /Delete/ }).click();
      await page.waitForTimeout(100);
      const focusInModal = await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.modal'));
      for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
      const stillInModal = await page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.modal'));
      await page.keyboard.press('Escape');
      await page.locator('.modal').waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
      const closed = (await page.locator('.modal').count()) === 0;
      note(`focus moves into modal: ${focusInModal}, stays after 4×Tab: ${stillInModal}, Escape closes: ${closed}`);
      assert(spaceOpened, 'Space does not open the estimate from its row');
      // Enter too, and focus returns to the opener after the modal closes
      await page.locator('.navtab', { hasText: 'Estimates' }).click();
      await page.locator('.est-row .est-open').first().focus(); await page.keyboard.press('Enter');
      await page.locator('.total-big').waitFor();
      assert(focusInModal && stillInModal, 'modal does not take/keep keyboard focus');
      assert(closed, 'Escape does not close modal');
      await noErrors(errors); await context.close();
    });
    await scenario('A13 duplicated estimates are independent copies', async () => {
      const est = makeEstimate('website', 'Original', { count: 5 });
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-orig': est }) });
      await page.locator('.est-row').first().getByRole('button', { name: /Duplicate/ }).click();
      await page.waitForFunction(() => document.querySelectorAll('.est-row').length === 2);
      await page.locator('.est-row', { hasText: '(copy)' }).click();
      await page.locator('.total-big').waitFor();
      await step(page, 'Build');
      await page.locator('.lib-row', { hasText: 'Header & navigation' }).first().locator('input.cb').uncheck();
      await page.waitForTimeout(900);
      const docs = await estDocs(page);
      const orig = docs.find((d) => d.name === 'Original'), copy = docs.find((d) => d.name === 'Original (copy)');
      assert(orig.items.length === 5 && copy.items.length === 4, `copy not independent: ${orig.items.length}/${copy.items.length}`);
      await noErrors(errors); await context.close();
    });

    await scenario('A14 keyboard: radio groups move with arrow keys and keep one tab stop', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Website');
      const group = page.locator('.choice-list[role="radiogroup"]').first();
      const stops = await group.locator('[role="radio"][tabindex="0"]').count();
      const before = await group.locator('[aria-checked="true"]').innerText();
      await group.locator('[aria-checked="true"]').focus();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(120);
      const after = await group.locator('[aria-checked="true"]').innerText();
      const focusFollows = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-checked') === 'true');
      const pressed = await page.locator('[role="radio"][aria-pressed]').count();
      note(`tab stops in group: ${stops} · moved: ${before.split('\n')[0]} → ${after.split('\n')[0]} · focus follows: ${focusFollows}`);
      assert(stops === 1, 'radio group should have exactly one tab stop, has ' + stops);
      assert(before !== after && focusFollows, 'arrow key did not move the selection and focus');
      assert(pressed === 0, 'radios still carry aria-pressed');
      await noErrors(errors); await context.close();
    });
    await scenario('A15 an estimate deleted elsewhere can be restored with your edits', async (note) => {
      const est = makeEstimate('website', 'Restore me');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-rs': est }) });
      await page.locator('.est-row .est-open').first().click();
      await page.locator('.total-big').waitFor();
      await page.evaluate(() => window.__remoteDelete('estimates/est-rs'));
      await page.locator('.banner', { hasText: /deleted by someone else/ }).waitFor({ timeout: 3000 });
      await page.locator('#est-name').fill('Restored with edits');
      await page.waitForTimeout(900);
      assert(!(await store(page, 'estimates/est-rs')), 'autosave recreated the deleted estimate');
      await page.getByRole('button', { name: 'Restore it' }).click();
      await page.waitForFunction(() => !!window.__store.get('estimates/est-rs'));
      await page.waitForTimeout(300);
      const d = await store(page, 'estimates/est-rs');
      assert(d.name === 'Restored with edits', 'restore lost the edit: ' + d.name);
      assert(await page.locator('.banner', { hasText: /deleted by someone else/ }).count() === 0, 'banner stayed after restore');
      await page.locator('#est-client').fill('After restore');
      await page.waitForTimeout(900);
      assert((await store(page, 'estimates/est-rs')).client === 'After restore', 'autosave did not resume after restore');
      note('banner shown, nothing recreated until Restore, edits kept, autosave resumed');
      await noErrors(errors); await context.close();
    });
    await scenario('A16 dialogs return focus to the control that opened them', async (note) => {
      const est = makeEstimate('website', 'Focus return');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-fr': est }) });
      const del = page.locator('.est-row').first().getByRole('button', { name: /Delete/ });
      await del.focus(); await page.keyboard.press('Enter');
      await page.locator('.modal').waitFor();
      const focusedLabel = await page.evaluate(() => document.activeElement && document.activeElement.innerText);
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(() => !!document.activeElement.closest('.modal'));
      await page.keyboard.press('Escape');
      await page.locator('.modal').waitFor({ state: 'detached', timeout: 1000 });
      const back = await page.evaluate(() => (document.activeElement.getAttribute('aria-label') || ''));
      note(`initial focus: "${focusedLabel}" · Shift+Tab stays inside: ${inside} · focus after close: "${back}"`);
      assert(/Delete/.test(focusedLabel), 'confirm button not focused');
      assert(inside, 'Shift+Tab escaped the dialog');
      assert(/^Delete /.test(back), 'focus not returned to the opener');
      assert(await store(page, 'estimates/est-fr'), 'Escape must not delete');
      await noErrors(errors); await context.close();
    });
    await scenario('A17 overhead and option values are bounded', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await page.locator('.navtab', { hasText: 'Settings' }).click();
      const all = page.locator('.stepper input[id^="oh-val-"]');
      const k = await all.count();
      const got = [];
      for (let i = 0; i < k; i++) { const inp = all.nth(i); await inp.fill('99999'); await inp.press('Tab'); await page.waitForTimeout(40); got.push(parseFloat(await inp.inputValue())); }
      note('overhead values after typing 99999: ' + got.join(', '));
      assert(got.every((v) => v <= 1000) && got.some((v) => v === 100), 'overhead not bounded (percent ≤ 100, hours ≤ 1000): ' + got.join());
      await noErrors(errors); await context.close();
    });

    // ================================================================ B. fault injection
    await scenario('B1 a transient "unavailable" save is retried silently', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed, faults: [{ op: 'set', match: 'estimates/', code: 'unavailable', times: 1 }] });
      await newEstimate(page, 'Website', 'Retry test');
      await page.waitForTimeout(300);
      assert((await estDocs(page)).length === 1, 'estimate not created after retry');
      assert(await page.locator('.toast.bad').count() === 0, 'error toast shown for a recovered failure');
      await noErrors(errors); await context.close();
    });
    await scenario('B2 persistent save failures show "Not saved", then recover', async () => {
      const est = makeEstimate('website', 'Failing saves');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-f': est }), faults: [{ op: 'set', match: 'estimates/', code: 'unavailable', times: 2 }] });
      await page.locator('.est-row').first().click();
      await page.locator('#est-name').fill('Failing saves 2');
      await page.waitForTimeout(2200);
      assert((await page.locator('.savestate').innerText()).includes('Not saved'), 'save state does not show failure');
      assert(await page.locator('.toast.bad').count() >= 1, 'no error toast');
      const texts = await page.locator('.toast.bad').allInnerTexts();
      assert(new Set(texts).size === texts.length, 'the same error toast is shown more than once: ' + texts.join(' | '));
      await page.locator('#est-name').fill('Failing saves 3');
      await page.waitForTimeout(1200);
      assert((await store(page, 'estimates/est-f')).name === 'Failing saves 3', 'did not recover on next edit');
      await noErrors(errors); await context.close();
    });
    await scenario('B3 storage full while creating an estimate', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed, faults: [{ op: 'set', match: 'estimates/', code: 'quota_exceeded', times: 1 }] });
      await page.locator('.side-new').click();
      await page.locator('.svc-card', { hasText: 'Website' }).click();
      await page.waitForTimeout(400);
      assert(await page.locator('.toast.bad', { hasText: /Storage is full/ }).count() === 1, 'no storage-full message');
      assert(await page.locator('.svc-card').count() > 0, 'navigated away despite failure');
      await noErrors(errors); await context.close();
    });
    await scenario('B4 estimator without write access gets a view-only banner', async () => {
      const est = makeEstimate('website', 'No write');
      const { page, context, errors } = await open({ role: 'estimator', seed: seedWith({ 'estimates/est-nw': est }), faults: [{ op: 'set', match: 'estimates/', code: 'invalid_argument' }] });
      await page.locator('.est-row').first().click();
      await page.locator('#est-name').fill('Try edit');
      await page.waitForTimeout(1200);
      assert(await page.locator('.banner.bad', { hasText: 'View only' }).count() === 1, 'no view-only banner');
      await noErrors(errors); await context.close();
    });
    await scenario('B5 an oversized estimate gets a clear size error (not view-only)', async (note) => {
      const s = svc('website');
      const est = makeEstimate('website', 'Huge estimate', { items: [] });
      while (Buffer.byteLength(JSON.stringify(est)) < 263000) est.items.push(Object.assign(E.customItem('Custom page ' + est.items.length, 4, 'custom', 'Custom', est), { note: 'x'.repeat(400) }));
      const { page, context, errors } = await open({ role: 'estimator', seed: seedWith({ 'estimates/est-huge': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('#est-name').fill('Huge estimate edited');
      await page.waitForTimeout(1500);
      const ro = await page.locator('.banner.bad', { hasText: 'View only' }).count();
      const msg = (await page.locator('.toast').allInnerTexts()).join(' | ');
      note('banner view-only: ' + ro + ' · toast: ' + msg.slice(0, 120));
      assert(!ro, 'size rejection wrongly switched an Estimator to view-only');
      assert(/too large|size|limit/i.test(msg), 'no clear size message: ' + msg);
      await noErrors(errors); await context.close();
    });
    await scenario('B6 revoked access shows a notice instead of a broken page', async () => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await page.locator('.side-new').waitFor();
      await page.evaluate(() => window.__revoke());
      await page.getByText('Access to the estimator changed').waitFor({ timeout: 3000 });
      await noErrors(errors); await context.close();
    });
    await scenario('B7 download declined / rate limited / unavailable are handled', async () => {
      for (const [fault, expectText] of [['declined', null], ['rate_limited', /already open/], ['unavailable', /could not be saved/]]) {
        const est = makeEstimate('website', 'Download ' + fault);
        const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-dl': est }), downloadFault: fault });
        await page.locator('.est-row').first().click();
        await page.locator('.export-btn', { hasText: 'CSV table' }).click();
        await page.waitForTimeout(300);
        const toasts = (await page.locator('.toast').allInnerTexts()).join(' | ');
        if (expectText) assert(expectText.test(toasts), `${fault}: expected message, got "${toasts}"`);
        else assert(!/Saved|could not/.test(toasts), `${fault}: should stay quiet, got "${toasts}"`);
        await noErrors(errors, fault); await context.close();
      }
    });
    await scenario('B8 slow network: rapid edits coalesce into few writes, final value saved', async (note) => {
      const est = makeEstimate('website', 'Slow');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-slow': est }), latency: 1200 });
      await page.locator('.est-row').first().click();
      await page.locator('#est-name').click();
      await page.locator('#est-name').fill('');
      await page.keyboard.type('Slow network estimate typed quickly with many characters', { delay: 15 });
      assert((await page.locator('.savestate').innerText()).includes('Saving'), 'no saving indicator during slow write');
      await page.waitForTimeout(4500);
      const writes = await page.evaluate(() => window.__writes.filter((w) => w[0] === 'set' && w[1] === 'estimates/est-slow').length);
      note('57 keystrokes → ' + writes + ' writes');
      assert(writes <= 4, 'too many writes: ' + writes);
      assert((await store(page, 'estimates/est-slow')).name === 'Slow network estimate typed quickly with many characters', 'final value not saved');
      assert((await page.locator('.savestate').innerText()).includes('Saved'), 'save state not settled');
      await noErrors(errors); await context.close();
    });
    await scenario('B9 a teammate\'s edit appears live when you are idle and never clobbers your typing', async (note) => {
      const est = makeEstimate('website', 'Shared');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-sh': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      const remote = Object.assign({}, est, { name: 'Renamed by teammate', updatedAt: Date.now() + 1000 });
      await page.evaluate((d) => window.__remoteSet('estimates/est-sh', d), remote);
      await page.waitForTimeout(300);
      assert(await page.locator('#est-name').inputValue() === 'Renamed by teammate', 'idle editor did not adopt remote change');
      await page.locator('#est-client').fill('My local edit');
      const remote2 = Object.assign({}, remote, { name: 'Second remote rename', updatedAt: Date.now() + 2000 });
      await page.evaluate((d) => window.__remoteSet('estimates/est-sh', d), remote2);
      await page.waitForTimeout(100);
      assert(await page.locator('#est-client').inputValue() === 'My local edit', 'remote change overwrote local typing');
      await page.waitForTimeout(1200);
      const fin = await page.evaluate(() => { const d = window.__store.get('estimates/est-sh'); return [d.name, d.client]; });
      note('final stored [name, client]: ' + JSON.stringify(fin));
      assert(fin[0] === 'Second remote rename' && fin[1] === 'My local edit', 'merge lost a change: ' + JSON.stringify(fin));
      assert(await page.locator('#est-name').inputValue() === 'Second remote rename', 'teammate rename not shown after merge');
      await noErrors(errors); await context.close();
    });

    await scenario('B10 a dropped live connection re-subscribes on its own', async (note) => {
      const est = makeEstimate('website', 'Live link');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-live': est }) });
      await page.locator('.est-row').first().waitFor();
      await page.evaluate(() => window.__dropListeners('unavailable'));
      await page.waitForTimeout(100);
      await page.evaluate((d) => window.__remoteSet('estimates/est-live2', d), Object.assign({}, est, { name: 'Arrived after reconnect', updatedAt: Date.now() + 5000 }));
      await page.locator('.est-row', { hasText: 'Arrived after reconnect' }).waitFor({ timeout: 6000 });
      const listeners = await page.evaluate(() => window.__listenerCount());
      const toasts = (await page.locator('.toast').allInnerTexts()).join(' | ');
      note('listeners after reconnect: ' + listeners + ' · toasts: ' + (toasts || 'none'));
      assert(listeners === 3, 'expected 3 live listeners after reconnect, got ' + listeners);
      assert(!/Lost the connection/.test(toasts), 'reload message shown although reconnect worked');
      await noErrors(errors); await context.close();
    });
    await scenario('B11 concurrent edits merge row by row (your removal + their new item)', async (note) => {
      const est = makeEstimate('website', 'Row merge', { items: ['header', 'footer', 'home', 'about'] });
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-rm': est }), latency: 400 });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      await step(page, 'Build');
      await page.locator('.lib-row', { hasText: 'About us' }).first().locator('input.cb').uncheck();
      const theirs = JSON.parse(JSON.stringify(est));
      theirs.items.push(E.customItem('Teammate page', 6, 'custom', 'Custom', theirs));
      theirs.updatedAt = Date.now() + 3000;
      await page.evaluate((d) => window.__remoteSet('estimates/est-rm', d), theirs);
      await page.waitForTimeout(2600);
      const d = await store(page, 'estimates/est-rm');
      const names = d.items.map((i) => i.name);
      note('stored items: ' + names.join(', '));
      assert(!names.includes('About us'), 'your removal was lost');
      assert(names.includes('Teammate page'), "teammate's new item was lost");
      assert(names.length === 4, 'unexpected item count ' + names.length);
      await noErrors(errors); await context.close();
    });
    await scenario('B12 hiding the tab saves immediately', async (note) => {
      const est = makeEstimate('website', 'Hide tab');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-ht': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('#est-name').fill('Saved on hide');
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(150);
      const d = await store(page, 'estimates/est-ht');
      note('stored name 150ms after hide: ' + d.name);
      assert(d.name === 'Saved on hide', 'pending edit not flushed when the tab was hidden');
      await noErrors(errors); await context.close();
    });
    await scenario('B13 resource_exhausted is retried before giving up', async () => {
      const est = makeEstimate('website', 'Busy store');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-busy': est }), faults: [{ op: 'set', match: 'estimates/', code: 'resource_exhausted', times: 1 }] });
      await page.locator('.est-row').first().click();
      await page.locator('#est-name').fill('Busy store retried');
      await page.waitForTimeout(3200);
      assert((await store(page, 'estimates/est-busy')).name === 'Busy store retried', 'not saved after retry');
      assert(await page.locator('.toast.bad').count() === 0, 'error shown for a recovered failure');
      await noErrors(errors); await context.close();
    });

    await scenario('B14 after a failed save, a teammate\'s change merges with your unsaved edits', async (note) => {
      const est = makeEstimate('website', 'Failed then merged');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-fm': est }), faults: [{ op: 'set', match: 'estimates/', code: 'quota_exceeded', times: 1 }] });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      await page.locator('#est-client').fill('Local unsaved client');
      await page.waitForTimeout(1000);
      assert((await page.locator('.savestate').innerText()).includes('Not saved'), 'expected the first save to fail');
      const theirs = Object.assign({}, est, { name: 'Teammate renamed it', updatedAt: Date.now() + 4000 });
      await page.evaluate((d) => window.__remoteSet('estimates/est-fm', d), theirs);
      await page.waitForTimeout(250);
      const shown = [await page.locator('#est-name').inputValue(), await page.locator('#est-client').inputValue()];
      await page.waitForTimeout(1000);
      const d = await store(page, 'estimates/est-fm');
      note('shown ' + JSON.stringify(shown) + ' · stored ' + JSON.stringify([d.name, d.client]));
      assert(shown[1] === 'Local unsaved client', 'unsaved edit was replaced by the teammate\'s version');
      assert(shown[0] === 'Teammate renamed it', "teammate's change not shown");
      assert(d.name === 'Teammate renamed it' && d.client === 'Local unsaved client', 'merged result not saved: ' + JSON.stringify([d.name, d.client]));
      await noErrors(errors); await context.close();
    });

    await scenario('B15 repeated identical errors show one message, not a stack', async (note) => {
      const est = makeEstimate('website', 'Repeated errors');
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-re': est }), faults: [{ op: 'set', match: 'estimates/', code: 'quota_exceeded', times: 3 }] });
      await page.locator('.est-row').first().click();
      for (const v of ['One', 'Two', 'Three']) { await page.locator('#est-name').fill('Repeated errors ' + v); await page.waitForTimeout(900); }
      const n = await page.locator('.toast', { hasText: 'Storage is full' }).count();
      const fails = await page.evaluate(() => window.__writes.filter((w) => String(w[0]).startsWith('fail:')).length);
      note(fails + ' failed saves → ' + n + ' message(s) on screen');
      assert(fails === 3, 'expected 3 failed saves, got ' + fails);
      assert(n === 1, 'identical error shown ' + n + ' times');
      await noErrors(errors); await context.close();
    });

    // ================================================================ C. stress & performance
    await scenario('C1 dashboard with 500 estimates', async (note) => {
      const extra = {};
      const base = makeEstimate('website', 'Bulk', { count: 3 });
      for (let i = 0; i < 500; i++) extra['estimates/bulk-' + i] = Object.assign({}, base, { name: 'Bulk estimate ' + i, client: 'Client ' + (i % 37), status: E.STATUSES[i % 5].id, updatedAt: Date.now() - i * 60000, totalHours: 10 + i });
      const t0 = Date.now();
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith(extra) });
      await page.locator('.est-row').first().waitFor();
      const load = Date.now() - t0;
      const rows = await page.locator('.est-row').count();
      const searchMs = await frame(page, `() => { const i = document.getElementById('est-search'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Client 7'); i.dispatchEvent(new Event('input', { bubbles: true })); }`);
      const filtered = await page.locator('.est-row').count();
      const filterMs = await frame(page, `() => document.querySelectorAll('.chip')[4].click()`);
      note(`load ${load}ms · ${rows} rows · search ${searchMs.toFixed(0)}ms → ${filtered} rows · status filter ${filterMs.toFixed(0)}ms`);
      assert(rows === 500, 'not all rows rendered: ' + rows);
      assert(searchMs < 500 && filterMs < 500, 'interaction too slow');
      assert((await page.locator('.side .count').first().innerText()) === '500', 'sidebar count wrong');
      await noErrors(errors); await context.close();
    });
    await scenario('C2 estimate with 250 items: build, toggle, review, export', async (note) => {
      const s = svc('website');
      const est = makeEstimate('website', 'Big build', { items: s.items.map((i) => i.id) });
      while (est.items.length < 250) est.items.push(E.customItem('Extra page ' + est.items.length, 3, 'custom', 'Custom', est));
      const bytes = JSON.stringify(est).length;
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-big': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      const reviewMs = await frame(page, `() => {}`);
      const t0 = Date.now(); await step(page, 'Build'); await page.locator('.lib-row').first().waitFor(); const buildMs = Date.now() - t0;
      const toggleMs = await frame(page, `() => document.querySelector('.lib-row.sel input.cb').click()`);
      const t1 = Date.now(); await step(page, 'Review'); await page.locator('.total-big').waitFor(); const backMs = Date.now() - t1;
      const t2 = Date.now();
      await page.locator('.export-btn', { hasText: 'Excel workbook' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1, null, { timeout: 30000 });
      const xlsxMs = Date.now() - t2;
      note(`doc ${Math.round(bytes / 1024)}KB · build ${buildMs}ms · toggle ${toggleMs.toFixed(0)}ms · review ${backMs}ms · XLSX ${xlsxMs}ms`);
      assert(toggleMs < 400 && buildMs < 3000 && xlsxMs < 15000, 'too slow');
      await noErrors(errors); await context.close();
    });
    await scenario('C3 how many items fit in one estimate before the 256 KiB limit', async (note) => {
      const out = [];
      for (const id of ['website', 'mobile-app', 'web-app']) {
        const s = svc(id);
        const est = makeEstimate(id, 'Capacity', { items: [] });
        let n = 0;
        while (new TextEncoder().encode(JSON.stringify(est)).length < 262144) { const li = s.items[n % s.items.length]; est.items.push(E.copyItem(s, li, est)); n++; }
        out.push(`${id}: ~${n - 1} items`);
      }
      note('capacity before limit ' + out.join(', '));
    });
    await scenario('C4 rapid interaction: 60 toggles, step switching and navigation churn', async (note) => {
      const { page, context, errors } = await open({ role: 'admin', seed });
      await newEstimate(page, 'Website', 'Churn');
      await step(page, 'Build');
      const boxes = page.locator('.lib-row input.cb');
      const n = Math.min(30, await boxes.count());
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) await boxes.nth(i).click({ delay: 0 });
      await page.waitForTimeout(1200);
      const d = (await estDocs(page))[0];
      for (let i = 0; i < 25; i++) await step(page, ['Scope', 'Build', 'Review', 'Service'][i % 4]);
      for (let i = 0; i < 10; i++) { await page.locator('.navtab', { hasText: 'Library' }).click(); await page.locator('.navtab', { hasText: 'Settings' }).click(); await page.locator('.navtab', { hasText: 'Estimates' }).click(); }
      const listeners = await page.evaluate(() => window.__listenerCount());
      const writes = await page.evaluate(() => window.__writes.filter((w) => w[0] === 'set').length);
      const heap = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1);
      note(`items after toggling twice: ${d.items.length} (expect 0) · writes ${writes} · listeners ${listeners} · heap ${heap}MB`);
      assert(d.items.length === 0, 'toggle state inconsistent');
      assert(listeners === 3, 'subscription leak: ' + listeners + ' listeners');
      await noErrors(errors); await context.close();
    });

    // ================================================================ D. security
    await scenario('D1 hostile text is never executed or injected', async (note) => {
      const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
      const lib = JSON.parse(JSON.stringify(seed));
      lib['services/website'].name = 'Web ' + payload;
      lib['services/website'].description = payload;
      lib['services/website'].items[0].name = 'Header ' + payload;
      lib['services/website'].items[0].description = payload;
      lib['services/website'].gapRules[0].message = payload;
      lib['services/website'].icon = '"><img src=x onerror=window.__xss=3>';
      const est = makeEstimate('website', 'XSS ' + payload, { client: payload, items: ['home'] });
      est.register.risks.push({ id: 'x', text: payload });
      lib['estimates/est-xss'] = est;
      const { page, context, errors } = await open({ role: 'admin', seed: lib });
      await page.locator('.est-row').first().click();
      await page.locator('.total-big').waitFor();
      await step(page, 'Build');
      await page.locator('.navtab', { hasText: 'Library' }).click();
      await page.locator('.cms-tab', { hasText: 'Gap rules' }).click();
      await page.locator('.navtab', { hasText: 'Estimates' }).click();
      await page.locator('.side-new').click();
      const xss = await page.evaluate(() => window.__xss || 0);
      const injected = await page.evaluate(() => document.querySelectorAll('img[src="x"]').length + Array.from(document.scripts).filter((s) => s.textContent.includes('__xss')).length);
      note('xss flag ' + xss + ', injected nodes ' + injected);
      assert(!xss && injected === 0, 'hostile markup executed or injected');
      await noErrors(errors); await context.close();
    });
    await scenario('D2 CSV export neutralises formula injection', async () => {
      const est = makeEstimate('website', '=HYPERLINK("http://evil","click")', { items: ['home'] });
      est.items.push(E.customItem('+SUM(A1:A9)', 2, 'custom', 'Custom', est));
      est.customDeliverables.push({ key: 'c', name: '@cmd', qty: 1, hours: 1 });
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-inj': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('.export-btn', { hasText: 'CSV table' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1);
      const csv = (await page.evaluate(() => window.__saved[0].text));
      const cells = csv.split(/\r\n/).flatMap((l) => l.split(','));
      const bad = cells.filter((c) => /^"?[=+@]/.test(c));
      assert(!bad.length, 'injectable cells: ' + bad.slice(0, 3).join(' '));
      await noErrors(errors); await context.close();
    });
    await scenario('D3 non-Latin estimate names keep a meaningful file name', async (note) => {
      const est = makeEstimate('website', 'বিকাশ ওয়েবসাইট', { items: ['home'] });
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-bn': est }) });
      await page.locator('.est-row').first().click();
      await page.locator('.export-btn', { hasText: 'CSV table' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1);
      const fn = await page.evaluate(() => window.__saved[0].filename);
      note('file name: ' + fn);
      assert(!/^(item|estimate)-hours\.csv$/.test(fn), 'name lost: ' + fn);
      await noErrors(errors); await context.close();
    });
    await scenario('D4 malformed estimate data does not blank the app', async (note) => {
      const est = makeEstimate('website', 'Corrupted', { items: ['home'] });
      est.items.push(null); est.overhead = { broken: true }; est.register = { assumptions: 'oops' }; est.hiddenAuto = {};
      const { page, context, errors } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-bad': est }) });
      await page.locator('.est-row').first().click();
      await page.waitForTimeout(500);
      const text = await page.evaluate(() => document.body.innerText.length);
      const sidebar = await page.locator('.side').count();
      note(`page text length ${text}, sidebar present ${sidebar}, errors ${errors.length}`);
      assert(sidebar && text > 200, 'app went blank on corrupted data');
      for (const s of ['Scope', 'Build', 'Service', 'Review']) { await step(page, s); assert(await page.locator('.ed-main .panel').count() > 0, s + ' step did not render'); }
      await page.locator('.export-btn', { hasText: 'CSV table' }).click();
      await page.waitForFunction(() => window.__saved.length >= 1);
      assert(await page.locator('.total-big').count() === 1, 'review did not render');
      await noErrors(errors, 'corrupted estimate'); await context.close();
    });

    await scenario('D5 corrupted library and settings documents do not break any screen', async (note) => {
      const lib = JSON.parse(JSON.stringify(seed));
      const w = lib['services/website'];
      w.items.push(null, 'junk', { id: 'odd', name: ['A', 'B'], hours: 'ten', categoryId: 'missing' });
      w.optionGroups = { not: 'an array' };
      w.starterPacks = [{ id: 'p', name: 'Pack', items: 'header' }, null];
      w.gapRules = [null, { id: 'g' }, { id: 'g2', trigger: { type: 'item', ref: 'home' }, suggest: null }];
      w.categories = [null, { id: 'global', name: 7 }];
      lib['config/settings'] = { agencyName: { x: 1 }, bufferPercent: 'lots', complexity: 'standard', overhead: { a: 1 }, phases: 'Phase 1', defaultAssumptions: 'none' };
      const { page, context, errors } = await open({ role: 'admin', seed: lib });
      await newEstimate(page, 'Website', 'From broken library');
      for (const s of ['Build', 'Review', 'Scope']) await step(page, s);
      assert(await page.locator('.total-big').count() + await page.locator('.ed-main .panel').count() > 0, 'editor did not render');
      await page.locator('.navtab', { hasText: 'Library' }).click();
      for (const tab of ['Scope options', 'Starter packs', 'Gap rules', 'Service details']) { await page.locator('.cms-tab', { hasText: tab }).click(); await page.waitForTimeout(60); }
      await page.locator('.navtab', { hasText: 'Settings' }).click();
      await page.locator('#set-agency').waitFor();
      const boundary = await page.locator('text=Something went wrong showing this page').count();
      note('error boundary shown: ' + boundary + ' · page errors: ' + errors.length);
      assert(!boundary, 'a screen crashed on corrupted library/settings data');
      await noErrors(errors, 'corrupted library'); await context.close();
    });
    await scenario('D6 a crashing view shows a recoverable error instead of a blank app', async (note) => {
      const est = makeEstimate('website', 'Crash view');
      const { page, context } = await open({ role: 'admin', seed: seedWith({ 'estimates/est-cv': est }) });
      await page.locator('.est-row').first().waitFor();
      // make the engine throw while the editor renders
      await page.evaluate(() => { const E = window.Engine; const c = E.compute; window.__boom = true; E.compute = function () { if (window.__boom) throw new Error('Injected render failure'); return c.apply(this, arguments); }; });
      await page.locator('.est-row .est-open').first().click();
      await page.getByText('Something went wrong showing this page').waitFor({ timeout: 3000 });
      const side = await page.locator('.side').count();
      await page.evaluate(() => { window.__boom = false; });
      await page.getByRole('button', { name: 'Back to estimates' }).click();
      await page.locator('.est-row').first().waitFor();
      await page.locator('.est-row .est-open').first().click();
      await page.locator('.total-big').waitFor({ timeout: 3000 });
      note('boundary shown with sidebar intact: ' + !!side + '; recovered and reopened the estimate');
      assert(side, 'sidebar disappeared');
      await context.close();
    });

    // ================================================================ summary
    const failed = results.filter((r) => !r.ok);
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
    console.log(`\n${results.length - failed.length}/${results.length} QA scenarios passed`);
    if (failed.length) { console.log('FAILED:'); failed.forEach((r) => console.log(' - ' + r.name + ': ' + r.error)); }
    process.exitCode = failed.length ? 1 : 0;
  } finally { await browser.close(); }
})();
