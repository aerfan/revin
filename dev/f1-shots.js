// F1 actual hours end to end (was: v2 features end to end: packages (C2), versions & diff (E1), requirements & traceability (D2),
// brief analyzer (A1), client proposal (G3) and library calibration.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { execFileSync } = require('child_process');
const E = require('../src/engine.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '..', 'test', 'out', 'f1'); fs.mkdirSync(OUT, { recursive: true });
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, '..', 'test', 'mock-claude.js'), 'utf8');
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



(async () => {
  browser = await chromium.launch();
  for (const [vw, dark] of [[{ width: 1360, height: 1000 }, false], [{ width: 390, height: 844 }, true]]) {
    const est = makeEstimate(['header', 'home', 'contact', 'about']); est.status = 'won';
    const k = est.items.map((i) => i.key);
    est.actuals = { items: { [k[0]]: 3.5, [k[1]]: 31, [k[2]]: 5 }, other: 40 };
    const { page, context } = await open({ seed: Object.assign({}, seed, { 'estimates/est-f1': est }) }, { route: { view: 'estimate', id: 'est-f1', step: 'review' }, viewport: vw });
    if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.locator('.act-panel').waitFor(); await page.waitForTimeout(300);
    await page.locator('.act-panel').screenshot({ path: path.join(OUT, 'actuals-' + vw.width + '.png') });
    await context.close();
  }
  await browser.close();
})();
