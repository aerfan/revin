// Loads the harness with each dataset and checks the app boots without errors.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(__dirname, 'break-ui.html'), 'utf8');
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
(async () => {
  const browser = await chromium.launch();
  for (const ds of ['demo', 'worst', 'empty', 'one', 'huge']) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('https://harness.test/')) return route.fulfill({ contentType: 'text/html', body: html });
      for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
      if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return route.abort();
    });
    const t0 = Date.now();
    await page.goto('https://harness.test/?data=' + ds);
    await page.locator('.side').waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({ rows: document.querySelectorAll('.est-row').length, sel: document.querySelector('.dev-data-switch [aria-pressed="true"]').textContent, empty: !!document.querySelector('.empty') }));
    console.log(ds.padEnd(6), `${Date.now() - t0}ms`, JSON.stringify(info), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors');
    await ctx.close();
  }
  await browser.close();
})();
