// Element-level screenshots of the spots the scan flagged, for visual review and the report.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out', 'peek');
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, 'break-ui.html'), 'utf8');
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const VIEW = { d1360: { width: 1360, height: 900 }, d1024: { width: 1024, height: 800 }, p390: { width: 390, height: 844 }, p320: { width: 320, height: 640 }, z200: { width: 680, height: 450 } };
const est = (step, id) => ({ view: 'estimate', id: id || 'est-focus', step });
const lib = (serviceId, tab) => ({ view: 'library', serviceId, tab });
async function expand(p, names) { for (const nm of names) { const r = p.locator('.lib-row.sel', { hasText: nm }).first(); if (await r.count()) await r.locator('.chev').click().catch(() => {}); } }

const SHOTS = [
  ['01-dash-rows', 'worst', 'd1360', { view: 'estimates' }, null, '.est-table'],
  ['02-dash-side', 'worst', 'd1360', { view: 'estimates' }, null, '.side'],
  ['03-checkout-row', 'worst', 'd1360', est('build'), (p) => expand(p, ['Checkout']), '.lib-row.sel', 'Checkout'],
  ['04-checkout-row-1024', 'worst', 'd1024', est('build'), null, '.lib-row.sel', 'Checkout'],
  ['05-commerce-z200', 'worst', 'z200', est('build'), null, '.panel.cat', 'Commerce'],
  ['06-custom-deliv-1024', 'worst', 'd1024', est('scope'), null, '.panel', 'Custom deliverables'],
  ['07-custom-deliv-320', 'worst', 'p320', est('scope'), null, '.panel', 'Custom deliverables'],
  ['08-inspector-320', 'worst', 'p320', est('build'), null, '.inspector'],
  ['08b-inspector-320-demo', 'demo', 'p320', est('build'), null, '.inspector'],
  ['09-breakdown-head-320', 'worst', 'p320', est('review'), null, '.panel.flush', 'Breakdown'],
  ['10-assumptions', 'worst', 'd1360', est('review'), null, '.panel', 'Assumptions'],
  ['11-exclusions', 'worst', 'd1360', est('review'), null, '.panel', 'Exclusions'],
  ['12-phases', 'worst', 'd1360', est('review'), null, '.panel', 'Hours by phase'],
  ['13-breakdown', 'worst', 'd1360', est('review'), null, '.panel.flush', 'Breakdown'],
  ['14-deliverables', 'worst', 'd1360', est('review'), null, '.panel.flush', 'Deliverables'],
  ['15-total-card', 'worst', 'd1360', est('review'), null, '.review-top'],
  ['16-overhead', 'worst', 'd1360', est('review'), null, '.panel', 'Overhead & buffer'],
  ['17-scope-top', 'worst', 'd1360', est('scope'), null, '.scope-grid'],
  ['18-ed-head', 'worst', 'd1360', est('scope'), null, '.ed-head'],
  ['19-ed-head-390', 'worst', 'p390', est('scope'), null, '.ed-head'],
  ['20-modal', 'worst', 'd1360', { view: 'estimates' }, async (p) => { await p.locator('.est-row').nth(1).getByRole('button', { name: /^Delete/ }).click(); }, '.modal'],
  ['21-toast-remove', 'worst', 'p390', est('build'), async (p) => { await p.locator('.lib-row.sel', { hasText: 'Checkout' }).first().locator('input.cb').click(); }, '.toasts'],
  ['22-toast-export', 'worst', 'p390', est('review'), async (p) => { await p.locator('.export-btn', { hasText: 'CSV table' }).click(); await p.locator('.toast').first().waitFor(); }, '.toasts'],
  ['23-ar-dash-row', 'worst', 'd1360', { view: 'estimates' }, null, '.est-row', 'Oct 5'],
  ['24-ar-build', 'worst', 'd1360', est('build', 'est-ar'), null, '.ed-main'],
  ['25-ar-review-breakdown', 'worst', 'd1360', est('review', 'est-ar'), null, '.panel.flush', 'Breakdown'],
  ['26-gone-service', 'worst', 'd1360', est('build', 'est-gone'), null, '.ed-main'],
  ['27-new', 'worst', 'd1360', { view: 'new' }, null, '.svc-grid'],
  ['28-lib-list', 'worst', 'd1360', lib('website', 'items'), null, '.svc-list'],
  ['29-lib-tabs-mobile', 'worst', 'd1360', lib('mobile-app', 'items'), null, '.cms-tabs'],
  ['30-lib-items', 'worst', 'd1360', lib('website', 'items'), async (p) => { await p.locator('.ed-sum', { hasText: 'Checkout' }).first().click(); }, '.cat-block', 'Commerce'],
  ['31-lib-rules', 'worst', 'd1360', lib('website', 'rules'), null, '.cat-block'],
  ['32-lib-packs-one', 'worst', 'd1360', lib('website', 'packs'), null, '.cat-block'],
  ['33-settings-cx', 'worst', 'd1360', { view: 'settings' }, null, '.panel', 'Complexity levels'],
  ['34-settings-oh', 'worst', 'd1360', { view: 'settings' }, null, '.panel', 'Project overhead'],
  ['35-settings-phases', 'worst', 'd1360', { view: 'settings' }, null, '.panel', 'Phases'],
  ['36-settings-assume', 'worst', 'd1360', { view: 'settings' }, null, '.grid-2', 'Default assumptions'],
  ['37-build-seg-390', 'worst', 'p390', est('build'), (p) => expand(p, ['Home']), '.item-panel'],
  ['38-empty-dash', 'empty', 'd1360', { view: 'estimates' }, null, '.wrap'],
  ['39-empty-build', 'empty', 'd1360', { view: 'new' }, async (p) => { await p.locator('.svc-card', { hasText: 'Discovery' }).click(); await p.locator('.step', { hasText: 'Build' }).click(); }, '.ed-body'],
  ['40-empty-scope', 'empty', 'd1360', { view: 'new' }, async (p) => { await p.locator('.svc-card', { hasText: 'Discovery' }).click(); }, '.ed-body'],
  ['41-one-review', 'one', 'd1360', est('review'), null, '.ed-main'],
  ['42-one-build', 'one', 'd1360', est('build'), (p) => expand(p, ['Home']), '.ed-body'],
  ['43-huge-dash-foot', 'huge', 'd1360', { view: 'estimates' }, null, '.list-foot'],
  ['44-huge-side', 'huge', 'd1360', { view: 'estimates' }, null, '.side-nav'],
  ['45-suggestions', 'worst', 'd1360', est('build'), null, '.suggest'],
  ['46-scope-390', 'worst', 'p390', est('scope'), null, '.scope-grid'],
  ['47-review-outdated', 'worst', 'd1360', est('review'), async (p) => { await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__store.get('services/website'))); s.optionGroups[0].options[1].value = 99; window.__remoteSet('services/website', s); }); await p.locator('.banner.warn').waitFor(); }, '.banner.warn'],
  ['48-one-scope', 'one', 'd1360', est('scope'), null, '.ed-main'],
];
const ONLY = process.argv[2] || '';
(async () => {
  const browser = await chromium.launch();
  for (const [name, ds, env, route, prep, sel, hasText] of SHOTS) {
    if (ONLY && !name.includes(ONLY)) continue;
    const ctx = await browser.newContext({ viewport: VIEW[env], deviceScaleFactor: env === 'z200' ? 2 : 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith('https://harness.test/')) return r.fulfill({ contentType: 'text/html', body: html });
      for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return r.fulfill({ contentType: 'application/javascript', body: LIB(f) });
      if (new URL(u).hostname === 'fonts.googleapis.com') return r.fulfill({ contentType: 'text/css', body: '' });
      return r.abort();
    });
    await page.addInitScript((r) => { try { localStorage.setItem('dhe:route', JSON.stringify(r)); } catch (e) { /* ignore */ } }, route);
    try {
      await page.goto('https://harness.test/?data=' + ds);
      await page.locator('.side').waitFor({ timeout: 15000 });
      await page.waitForTimeout(250);
      await page.locator('.dev-data-switch').evaluate((el) => { el.style.display = 'none'; });
      if (prep) await prep(page);
      await page.waitForTimeout(250);
      const loc = hasText ? page.locator(sel, { hasText }).first() : page.locator(sel).first();
      await loc.screenshot({ path: path.join(OUT, name + '.png') });
      console.log('ok  ', name);
    } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); }
    await ctx.close();
  }
  await browser.close();
})();
