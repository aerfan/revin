// F1 actual hours end to end (was: v2 features end to end: packages (C2), versions & diff (E1), requirements & traceability (D2),
// brief analyzer (A1), client proposal (G3) and library calibration.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { execFileSync } = require('child_process');
const E = require('../src/engine.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'f1'); fs.mkdirSync(OUT, { recursive: true });
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
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    if (u.includes('docx@8.5.0')) return route.fulfill({ contentType: 'application/javascript', body: LIB('docx.umd.js') });
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


const ROUTE_F1 = (step) => ({ view: 'estimate', id: 'est-f1', step });
(async () => {
  browser = await chromium.launch();
  try {
    await scenario('F1 actuals: type, import timesheet, variance, persist', async (note) => {
      const est = makeEstimate(['header', 'home', 'contact']); est.status = 'won';
      const { page, context, errors } = await open({ seed: Object.assign({}, seed, { 'estimates/est-f1': est }) }, { route: ROUTE_F1('review') });
      const panel = page.locator('.act-panel');
      await panel.waitFor();
      const keys = est.items.map((i) => i.key), res = E.compute(est);
      const tot = (k) => res.items.find((x) => x.item.key === k).total;
      const home = page.locator('#act-' + keys[1]);
      await home.fill('1.'); await page.waitForTimeout(50);
      assert(await home.inputValue() === '1.', 'typing a decimal point was swallowed');
      await home.fill(String(tot(keys[1]) * 2)); await home.press('Enter');
      await page.locator('.act-sum').waitFor();
      const diffHome = await page.locator('tr', { has: home }).locator('.act-d').innerText();
      note('home doubled → ' + diffHome);
      assert(diffHome === '+100%', 'variance ' + diffHome);
      // timesheet import
      await panel.getByRole('button', { name: 'Import timesheet' }).click();
      await page.locator('#act-sheet').fill('Task,Hours\nHeader,2\nheader,1.5\nContact,4\nClient call,3');
      await panel.getByRole('button', { name: 'Fill from timesheet' }).click();
      await page.locator('.toast', { hasText: 'Filled 2' }).waitFor();
      await page.waitForFunction((id) => document.getElementById(id) && document.getElementById(id).value === '3.5', 'act-' + keys[0]);
      assert(await page.locator('#act-' + keys[0]).inputValue() === '3.5', 'header not summed');
      assert(await page.locator('#act-other').inputValue() === '3', 'unmatched hours → project time');
      assert(await panel.locator('.pill', { hasText: 'Tracked' }).count() === 1, 'should be complete');
      // blank clears a line
      await page.locator('#act-' + keys[2]).fill(''); await page.locator('#act-' + keys[2]).press('Tab');
      await page.waitForTimeout(900);
      const d = await store(page, 'estimates/est-f1');
      assert(d.actuals.items[keys[1]] === E.round(tot(keys[1]) * 2, 2), 'home not saved');
      assert(d.actuals.items[keys[2]] === undefined, 'cleared line still saved');
      assert(d.actuals.other === 3, 'other not saved');
      assert(await panel.locator('.pill', { hasText: '2 of 3 tracked' }).count() === 1, 'pill after clearing');
      // bad input reverts
      await home.fill('-5'); await home.press('Enter');
      assert(await home.inputValue() === E.plainNum(E.round(tot(keys[1]) * 2, 2)), 'negative accepted');
      noErr(errors); await context.close();
    });
    await scenario('F1 actuals: hidden until asked on a draft; mobile fits', async (note) => {
      const est = makeEstimate(['home']);
      const { page, context, errors } = await open({ seed: Object.assign({}, seed, { 'estimates/est-f1': est }) }, { route: ROUTE_F1('review'), viewport: { width: 360, height: 760 } });
      const btn = page.getByRole('button', { name: 'Track actual hours' });
      await btn.waitFor();
      await btn.click();
      await page.locator('.act-panel').waitFor();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert(over <= 0, 'page scrolls sideways by ' + over);
      noErr(errors); await context.close();
    });
    await scenario('F1 → Calibrate reads tracked estimates', async (note) => {
      const a = makeEstimate(['footer', 'home']), b = makeEstimate(['footer']);
      a.actuals = { items: { [a.items[0].key]: 6, [a.items[1].key]: 0 } }; b.actuals = { items: { [b.items[0].key]: 8 } };
      const sd = Object.assign({}, seed, { 'estimates/a1': a, 'estimates/b1': b });
      const { page, context, errors } = await open({ role: 'admin', seed: sd }, { route: { view: 'library', serviceId: 'website', tab: 'calibrate' } });
      await page.locator('.cal-tracked').getByText(/2 estimates for this service/).waitFor();
      await page.getByRole('button', { name: 'Compare with the library' }).click();
      const row = page.locator('table.cal tr', { hasText: 'Footer' });
      await row.waitFor();
      const med = await row.locator('td').nth(3).innerText();
      note('footer median from tracked: ' + med);
      assert(/^7(\.0)?h$/.test(med.trim()), 'median ' + med);
      assert(await page.locator('table.cal tr', { hasText: 'Home' }).count() === 0, '0h actual used as a sample');
      await page.locator('#cal-use-tracked').uncheck();
      assert(await page.getByRole('button', { name: 'Compare with the library' }).isDisabled(), 'button should need a source');
      noErr(errors); await context.close();
    });
  } finally { await browser.close(); }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} F1 scenarios passed`);
  process.exitCode = failed.length ? 1 : 0;
})();
