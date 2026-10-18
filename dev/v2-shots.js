const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(__dirname, 'break-ui', 'break-ui.html'), 'utf8');
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  async function shot(name, route, prep, sel, vp, dark) {
    const ctx = await b.newContext({ viewport: vp || { width: 1360, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url();
      if (u.startsWith('https://harness.test/')) return r.fulfill({ contentType: 'text/html', body: html });
      for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js']) if (u.includes(f)) return r.fulfill({ contentType: 'application/javascript', body: LIB(f) });
      return r.abort(); });
    await page.addInitScript((r) => localStorage.setItem('dhe:route', JSON.stringify(r)), route);
    await page.goto('https://harness.test/?data=demo'); await page.locator('.side').waitFor(); await page.waitForTimeout(300);
    await page.locator('.dev-data-switch').evaluate((e) => e.remove());
    if (prep) await prep(page);
    await page.waitForTimeout(500);
    await (sel ? page.locator(sel).first().screenshot({ path: path.join(OUT, name + '.png') }) : page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }));
    await ctx.close(); console.log('ok', name);
  }
  const est = (step) => ({ view: 'estimate', id: 'est-focus', step });
  await shot('review-v2', est('review'), async (p) => {
    await p.locator('#pk-on').check();
    for (const t of ['Visitors can read our story', 'Customers can book a call']) { await p.locator('#req-new').fill(t); await p.locator('#req-new').press('Enter'); }
    await p.locator('#ver-label').fill('Sent to client'); await p.getByRole('button', { name: 'Save version' }).click(); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.querySelector('#pk-on'); });
  }, null);
  await shot('brief', est('build'), async (p) => {
    await p.locator('.brief-cta').click();
    await p.locator('#brief-text').fill('We need a new Home page with our story.\nAn About us page.\nA Contact page with a form.\nCustomers want a loan calculator.\nLaunch is planned for March.');
    await p.getByRole('button', { name: 'Analyze', exact: true }).click(); await p.locator('.brief-res').waitFor();
  }, '.brief');
  await shot('brief-cta', est('build'), null, '.brief-cta');
  await shot('proposal', est('proposal'), null, null);
  await shot('proposal-390', est('proposal'), null, null, { width: 390, height: 844 });
  await shot('calibrate', { view: 'library', serviceId: 'website', tab: 'calibrate' }, async (p) => {
    await p.locator('#cal-text').fill('Item,Actual hours\nFooter,4\nFooter,5\nFooter,6\nSearch results,9\nHome,26\nHome,31\nMystery page,3');
    await p.getByRole('button', { name: 'Compare with the library' }).click();
  }, '.ed-main, .wrap');
  await shot('review-v2-dark', est('review'), async (p) => { await p.locator('#pk-on').check(); }, null, null, true);
  await b.close();
})();
