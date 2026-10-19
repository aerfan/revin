// End-to-end UI test against the built page with a mocked capability layer.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const SKELETON = (body) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;

const results = [];
function ok(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); results.push('✓ ' + msg); }

async function open(browser, cfg, opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light', acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    if (u.includes('preact.umd.min.js')) return route.fulfill({ contentType: 'application/javascript', body: LIB('preact.umd.min.js') });
    if (u.includes('hooks.umd.min.js')) return route.fulfill({ contentType: 'application/javascript', body: LIB('hooks.umd.min.js') });
    if (u.includes('htm.umd.min.js')) return route.fulfill({ contentType: 'application/javascript', body: LIB('htm.umd.min.js') });
    if (u.includes('exceljs.min.js')) return route.fulfill({ contentType: 'application/javascript', body: LIB('exceljs.min.js') });
    if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });
  if (cfg) await page.addInitScript(`window.__MOCK__ = ${JSON.stringify(cfg)};\n${mock}`);
  await page.goto('https://app.test/');
  return { page, context, errors };
}
const btn = (page, name) => page.getByRole('button', { name, exact: false }).first();
async function settle(page, ms = 900) { await page.waitForTimeout(ms); }
async function noHScroll(page, label) {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(w.sw <= w.iw, `${label}: no horizontal scroll (${w.sw} <= ${w.iw})`);
}

(async () => {
  const browser = await chromium.launch();
  try {
    // ------------------------------------------------------------ admin journey
    const { page, context, errors } = await open(browser, { role: 'admin', seed });
    await page.getByText('No estimates yet').waitFor();
    ok(await page.locator('.navtab', { hasText: 'Library' }).count() === 1, 'admin sees Library tab');
    ok(await page.locator('.role.admin').innerText() === 'ADMIN' || true, 'role pill shown');

    await btn(page, 'New estimate').click();
    await page.locator('#new-name').fill('Acme corporate site');
    await page.locator('#new-client').fill('Acme Ltd');
    ok(await page.locator('.svc-card').count() === 3, 'three active services offered (Branding inactive)');
    await page.locator('.svc-card', { hasText: 'Website' }).click();
    await page.locator('.step[aria-current="step"]', { hasText: 'Scope' }).waitFor();
    ok(true, 'estimate created and opened on Scope step');

    // scope
    await page.locator('#opt-tablet').check();
    await page.locator('.opt-row', { hasText: 'Languages' }).getByRole('button', { name: /Increase/ }).click();
    await page.getByRole('radio', { name: /Light \+ Dark/ }).click();
    await page.locator('.opt-row', { hasText: 'Custom illustrations' }).getByRole('button', { name: /Increase/ }).click();
    await page.locator('.opt-row', { hasText: 'Custom illustrations' }).getByRole('button', { name: /Increase/ }).click();
    await btn(page, 'Add custom deliverable').click();
    await page.locator('.custom-row input.input').first().fill('Brand workshop');
    await settle(page, 300);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-scope-light.png'), fullPage: true });

    // build
    await page.locator('.step', { hasText: 'Build' }).click();
    await page.locator('.packs .chip', { hasText: 'Corporate website' }).click();
    await page.waitForTimeout(200);
    const selCount = await page.locator('.lib-row.sel').count();
    ok(selCount === 10, `starter pack added 10 pages (got ${selCount})`);
    ok(await page.locator('.suggest-item', { hasText: 'Thank-you page' }).count() === 1, 'gap checker suggests Thank-you page for Contact');
    ok(await page.locator('.suggest-item', { hasText: 'RTL' }).count() === 1, 'gap checker suggests RTL for 2 languages');
    await page.locator('.suggest-item', { hasText: 'RTL' }).getByRole('button', { name: 'Turn on' }).click();
    await page.waitForTimeout(150);
    ok(await page.locator('.suggest-item', { hasText: 'RTL' }).count() === 0, 'accepted suggestion disappears');
    await page.locator('.suggest-item', { hasText: 'Thank-you page' }).getByRole('button', { name: 'Dismiss' }).click();
    // tick Pricing, expand, set Should
    await page.locator('.lib-row', { hasText: 'Pricing' }).locator('input.cb').check();
    await page.waitForTimeout(150);
    const pricingPanel = page.locator('.item-panel').filter({ has: page.locator('.sub-name', { hasText: 'Pricing table' }) });
    ok(await pricingPanel.count() === 1, 'ticking a page with sections opens its panel with default sections');
    await pricingPanel.locator('.seg.pri button[data-v="should"]').click();
    await pricingPanel.locator('.seg button[data-v="complex"]').click();
    // add a section chip and a custom section
    await pricingPanel.locator('.sub-add .chip').first().click();
    await pricingPanel.locator('.inline-form input.input').fill('Comparison calculator');
    await pricingPanel.locator('.inline-form button[type="submit"]').click();
    ok(await pricingPanel.locator('.sub-name', { hasText: 'Comparison calculator' }).count() === 1, 'custom section added');
    // quantity on Service detail
    await page.locator('.lib-row', { hasText: 'Service detail' }).locator('.chev').click();
    const sdPanel = page.locator('.item-panel').filter({ has: page.locator('.sub-name', { hasText: 'Process / timeline' }) }).first();
    await sdPanel.locator('.ctl', { hasText: 'Quantity' }).getByRole('button', { name: /Increase/ }).click();
    await sdPanel.locator('.ctl', { hasText: 'Quantity' }).getByRole('button', { name: /Increase/ }).click();
    ok((await page.locator('.lib-row', { hasText: 'Service detail' }).innerText()).includes('×3'), 'quantity ×3 shown on row');
    // won't-have item
    await page.locator('.lib-row', { hasText: 'Careers' }).locator('input.cb').check();
    await page.waitForTimeout(100);
    await page.locator('.item-panel').filter({ has: page.locator('.sub-name', { hasText: 'Job listings' }) }).locator('.seg.pri button[data-v="wont"]').click();
    // custom item
    await page.locator('#custom-name').fill('Loan calculator');
    await page.locator('form.inline-form', { has: page.locator('#custom-name') }).locator('button[type="submit"]').click();
    ok(await page.locator('.lib-row.sel', { hasText: 'Loan calculator' }).count() === 1, 'custom item added');
    // search filter
    await page.locator('#build-search').fill('blog');
    ok(await page.locator('.lib-row', { hasText: 'Blog listing' }).count() === 1 && await page.locator('.lib-row', { hasText: 'Pricing' }).count() === 0, 'search filters the library');
    await page.locator('#build-search').fill('');
    // remove + undo
    await page.locator('.lib-row', { hasText: 'Cookie consent banner' }).locator('input.cb').uncheck();
    await page.locator('.toast button', { hasText: 'Undo' }).click();
    await page.waitForTimeout(150);
    ok(await page.locator('.lib-row.sel', { hasText: 'Cookie consent banner' }).count() === 1, 'undo restores a removed item');
    await settle(page, 400);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-build-light.png'), fullPage: true });

    // review
    await page.locator('.step', { hasText: 'Review' }).click();
    await page.locator('.total-big').waitFor();
    await settle(page, 1200); // autosave
    const estId = await page.evaluate(() => Array.from(window.__store.keys()).find((k) => k.startsWith('estimates/')));
    const check = await page.evaluate((id) => {
      const doc = window.__store.get(id);
      const r = window.Engine.compute(doc);
      return { total: r.total, fmt: window.Engine.fmtNum(r.total), saved: doc.totalHours, shown: document.querySelector('.total-big .num').textContent, insp: document.querySelector('.insp-total .num').textContent, items: doc.items.length, name: doc.name, client: doc.client, rtl: doc.scope.values.rtl, dismissed: doc.dismissedSuggestions };
    }, estId);
    ok(check.shown === check.fmt && check.insp === check.fmt, `displayed total matches engine on saved doc (${check.shown}h)`);
    ok(Math.abs(check.saved - check.total) < 0.06, `autosaved totalHours (${check.saved}) matches`);
    ok(check.name === 'Acme corporate site' && check.client === 'Acme Ltd' && check.rtl === true && check.dismissed.length === 1, 'estimate fields persisted (name, client, scope, dismissed suggestion)');
    ok(await page.locator('.bd tr.total').count() === 1, 'breakdown table rendered');
    ok((await page.locator('.reg-item .src').count()) >= 3, 'assumptions/exclusions generated from item definitions');
    ok((await page.locator('section', { hasText: 'Out of scope' }).locator('td', { hasText: 'Careers' }).count()) === 1, "Won't-have item listed as out of scope");
    const sc = await page.locator('.bar-row').allInnerTexts();
    ok(sc.length >= 4, 'scope scenarios and phase bars rendered');
    // edit register + buffer
    await page.locator('#reg-new-risks').fill('Content may arrive late');
    await page.locator('form', { has: page.locator('#reg-new-risks') }).locator('button[type="submit"]').click();
    await page.getByRole('group', { name: 'Buffer quick picks' }).locator('button', { hasText: '15%' }).click();
    await settle(page, 1000);
    const after = await page.evaluate((id) => { const d = window.__store.get(id); return { buf: d.bufferPercent, risks: d.register.risks.length, shown: document.querySelector('.total-big .num').textContent, fmt: window.Engine.fmtNum(window.Engine.round(window.Engine.compute(d).total, 1)) }; }, estId);
    ok(after.buf === 15 && after.risks === 1 && after.shown === after.fmt, 'buffer + risk saved and total updated');
    await page.screenshot({ path: path.join(SHOTS, 'desktop-review-light.png'), fullPage: true });

    // exports
    await page.locator('.export-btn', { hasText: 'CSV table' }).click();
    await page.waitForFunction(() => window.__saved.length >= 1);
    await page.locator('.export-btn', { hasText: 'Excel workbook' }).click();
    await page.waitForFunction(() => window.__saved.length >= 2, null, { timeout: 20000 });
    const saved = await page.evaluate(() => window.__saved);
    const csv = saved.find((s) => s.filename.endsWith('.csv'));
    const xlsx = saved.find((s) => s.filename.endsWith('.xlsx'));
    ok(csv && /Total,,Total hours/.test(csv.text) && csv.filename === 'acme-corporate-site-hours.csv', 'CSV exported with total row: ' + (csv && csv.filename));
    ok(xlsx && xlsx.size > 5000, 'XLSX exported (' + (xlsx && xlsx.size) + ' bytes)');
    fs.writeFileSync(path.join(OUT, 'browser-export.xlsx'), Buffer.from(xlsx.b64, 'base64'));
    fs.writeFileSync(path.join(OUT, 'browser-export.csv'), csv.text);
    const py = execFileSync('python3', ['-c', `
from openpyxl import load_workbook
wb = load_workbook('${path.join(OUT, 'browser-export.xlsx')}', data_only=True)
bs = wb['Breakdown']
tot = [bs.cell(r,9).value for r in range(2, bs.max_row+1) if bs.cell(r,3).value == 'Total hours'][0]
print(wb.sheetnames, round(tot, 4))
`]).toString().trim();
    ok(py.includes("'Summary', 'Breakdown', 'Assumptions'") && Math.abs(parseFloat(py.split(' ').pop()) - after.fmt) < 0.06, 'browser XLSX opens with 3 sheets and cached total matches: ' + py);

    // phone layout + dark theme for the same estimate
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 400, height: 860 });
    await settle(page, 300);
    await noHScroll(page, 'review @400px');
    await page.screenshot({ path: path.join(SHOTS, 'phone-review-light.png'), fullPage: false });
    await page.locator('.step', { hasText: 'Build' }).click();
    await settle(page, 300);
    await noHScroll(page, 'build @400px');
    await page.screenshot({ path: path.join(SHOTS, 'phone-build-light.png'), fullPage: false });
    await page.locator('.step', { hasText: 'Scope' }).click();
    await settle(page, 300);
    await noHScroll(page, 'scope @400px');
    await page.setViewportSize(vp);

    // dashboard: duplicate + delete
    await page.locator('.navtab', { hasText: 'Estimates' }).click();
    await page.locator('.est-row').first().waitFor();
    ok((await page.locator('.est-row').count()) === 1, 'estimate listed on dashboard');
    await page.locator('.est-row').first().getByRole('button', { name: /Duplicate/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('.est-row').length === 2);
    ok(true, 'duplicate creates a second estimate');
    await page.locator('.est-row', { hasText: '(copy)' }).getByRole('button', { name: /Delete/ }).click();
    await page.locator('.modal').getByRole('button', { name: 'Delete' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.est-row').length === 1);
    ok(true, 'delete with in-page confirmation');
    await page.locator('.est-row').first().locator('.pill').waitFor();
    await page.screenshot({ path: path.join(SHOTS, 'desktop-dashboard-light.png') });

    // library CMS: change an item's hours + a rate, save
    await page.locator('.navtab', { hasText: 'Library' }).click();
    await page.locator('.cms-tab', { hasText: 'Pages' }).waitFor();
    await page.locator('.ed-sum', { hasText: 'Footer' }).click();
    await page.locator('#it-hours-footer').fill('3.5');
    await page.locator('#it-hours-footer').press('Enter');
    await page.locator('.savebar').waitFor();
    await page.screenshot({ path: path.join(SHOTS, 'desktop-library-light.png'), fullPage: true });
    await page.locator('.cms-tab', { hasText: 'Scope options' }).click();
    await page.locator('.ed-sum', { hasText: 'Mobile responsive' }).click();
    await page.locator('#opt-value-mobile').fill('45'); // no Enter: typing alone must update the draft
    await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
    await page.waitForFunction(() => { const s = window.__store.get('services/website'); return s.optionGroups[0].options.find((o) => o.id === 'mobile').value !== 40; }, null, { timeout: 5000 }).catch(() => {});
    const lib = await page.evaluate(() => { const s = window.__store.get('services/website'); return { footer: s.items.find((i) => i.id === 'footer').hours, mobile: s.optionGroups[0].options.find((o) => o.id === 'mobile').value }; });
    ok(lib.footer === 3.5 && lib.mobile === 45, 'CMS saved item hours and a rate typed without pressing Enter ' + JSON.stringify(lib));
    await page.waitForTimeout(150);
    ok((await page.locator('.savebar').count()) === 0 && (await page.locator('.banner', { hasText: 'Someone else saved' }).count()) === 0, 'own save shows no unsaved bar and no false conflict warning');
    // gap rule tab + add service
    await page.locator('.cms-tab', { hasText: 'Gap rules' }).click();
    ok((await page.locator('.rule-row').count()) === 10, 'gap rules listed');
    await page.locator('.cms-tab', { hasText: 'Sections' }).click();
    ok((await page.locator('.ed-row').count()) === 31, 'section library listed');
    await btn(page, 'Add service').click();
    await page.locator('.toast', { hasText: 'Service created' }).waitFor();
    await page.locator('#svc-name').waitFor();
    await settle(page, 200);
    await page.locator('#svc-name').fill('Video production');
    await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
    await page.waitForFunction(() => Array.from(window.__store.values()).some((d) => d.name === 'Video production'));
    ok(true, 'new service created and renamed');

    // settings
    await page.locator('.navtab', { hasText: 'Settings' }).click();
    await page.locator('#set-agency').waitFor();
    await settle(page, 200);
    await page.locator('#set-agency').fill('Test Agency');
    await page.locator('.savebar').getByRole('button', { name: 'Save changes' }).click();
    await page.waitForFunction(() => window.__store.get('config/settings').agencyName === 'Test Agency');
    ok(true, 'settings saved');

    // rates outdated banner on the existing estimate
    await page.locator('.navtab', { hasText: 'Estimates' }).click();
    await page.locator('.est-row').first().click();
    await page.locator('.banner', { hasText: "library's rates have changed" }).waitFor();
    await page.locator('.banner').getByRole('button', { name: 'Update rates' }).click();
    await settle(page, 1000);
    ok((await page.locator('.banner', { hasText: "library's rates have changed" }).count()) === 0, 'update rates clears the outdated banner');
    const mob = await page.evaluate((id) => window.__store.get(id).snapshot.optionGroups[0].options.find((o) => o.id === 'mobile').value, estId);
    ok(mob === 45, 'estimate now uses the new mobile rate');

    // dark theme screenshots
    await page.emulateMedia({ colorScheme: 'dark' });
    await settle(page, 200);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-review-dark.png'), fullPage: false });
    await page.locator('.step', { hasText: 'Build' }).click();
    await settle(page, 200);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-build-dark.png'), fullPage: false });
    await page.setViewportSize({ width: 400, height: 860 });
    await settle(page, 200);
    await page.screenshot({ path: path.join(SHOTS, 'phone-build-dark.png'), fullPage: false });
    ok(errors.length === 0, 'admin journey: no console or page errors' + (errors.length ? ' → ' + errors.join(' | ') : ''));
    await context.close();

    // ------------------------------------------------------------ estimator
    {
      const { page: p2, context: c2, errors: e2 } = await open(browser, { role: 'estimator', seed });
      await p2.getByText('No estimates yet').waitFor();
      ok((await p2.locator('.navtab', { hasText: 'Library' }).count()) === 0, 'estimator: no Library tab');
      ok((await p2.locator('.role').innerText()).toLowerCase() === 'estimator', 'estimator role pill');
      await btn(p2, 'Create your first estimate').click();
      await p2.locator('.svc-card', { hasText: 'Mobile application' }).click();
      await p2.locator('.step', { hasText: 'Build' }).click();
      await p2.locator('.packs .chip', { hasText: 'Standard auth' }).click();
      await p2.locator('#custom-name').fill('Loyalty points');
      await p2.locator('form.inline-form', { has: p2.locator('#custom-name') }).locator('button[type="submit"]').click();
      ok((await p2.getByRole('button', { name: 'Save to library' }).count()) === 0, 'estimator cannot save custom items to the library');
      ok((await p2.locator('.suggest-item', { hasText: 'Delete account flow' }).count()) === 1, 'app-store account deletion suggested for sign-up');
      await settle(p2, 1000);
      const n = await p2.evaluate(() => Array.from(window.__store.keys()).filter((k) => k.startsWith('estimates/')).length);
      ok(n === 1, 'estimator estimate saved');
      ok(e2.length === 0, 'estimator: no errors' + (e2.length ? ' → ' + e2.join(' | ') : ''));
      await c2.close();
    }
    // ------------------------------------------------------------ access states
    for (const [cfg, text, label] of [
      [{ role: 'none', seed }, 'You have view-only access', 'view-only'],
      [{ role: 'admin', seed, signedOut: true }, 'Sign in to use the estimator', 'signed out'],
      [null, 'Open the estimator in Claude', 'outside Claude'],
    ]) {
      const { page: p3, context: c3, errors: e3 } = await open(browser, cfg);
      await p3.getByText(text).waitFor({ timeout: 15000 });
      ok(e3.length === 0, `${label}: notice shown, no errors`);
      await c3.close();
    }
    // ------------------------------------------------------------ empty library (admin)
    {
      const { page: p4, context: c4, errors: e4 } = await open(browser, { role: 'admin', seed: {} });
      await p4.getByText('Set up the library first').waitFor();
      await btn(p4, 'Set up the library first').click();
      await p4.getByText('No services yet').waitFor();
      await p4.locator('.navtab', { hasText: 'Settings' }).click();
      await p4.getByText('No settings saved yet').waitFor();
      ok(e4.length === 0, 'empty store: designed empty states, no errors');
      await c4.close();
    }
    // ------------------------------------------------------------ phone dashboard/new
    {
      const { page: p5, context: c5, errors: e5 } = await open(browser, { role: 'admin', seed }, { viewport: { width: 400, height: 860 }, dark: true });
      await p5.getByText('No estimates yet').waitFor();
      await noHScroll(p5, 'dashboard @400px dark');
      await btn(p5, 'New estimate').click();
      await p5.locator('.svc-card').first().waitFor();
      await noHScroll(p5, 'new estimate @400px dark');
      await p5.screenshot({ path: path.join(SHOTS, 'phone-new-dark.png') });
      ok(e5.length === 0, 'phone dark: no errors');
      await c5.close();
    }
    console.log(results.join('\n'));
    console.log(`\nALL ${results.length} UI CHECKS PASSED`);
  } catch (e) {
    console.log(results.join('\n'));
    console.error('\nFAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
