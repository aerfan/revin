// Re-checks each break-ui fix against the worst-case / 1,000-row data.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(__dirname, 'break-ui.html'), 'utf8');
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
async function open(browser, ds, route, vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url();
    if (u.startsWith('https://harness.test/')) return r.fulfill({ contentType: 'text/html', body: html });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return r.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    return r.abort(); });
  await page.addInitScript((r) => localStorage.setItem('dhe:route', JSON.stringify(r)), route);
  await page.goto('https://harness.test/?data=' + ds); await page.locator('.side').waitFor(); await page.waitForTimeout(300);
  return { page, ctx };
}
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const b = await chromium.launch();
  let { page, ctx } = await open(b, 'huge', { view: 'estimates' });
  const before = await page.locator('.est-row').count(); const side1 = await page.locator('.navtab .count').first().innerText();
  await page.getByRole('button', { name: /Show 500 more/ }).click(); await page.waitForTimeout(800);
  const after = await page.locator('.est-row').count();
  ok(before === 500 && side1 === '500+' && after === 1001, `1,000 rows: ${before} → ${after} after "Show more", sidebar "${side1}" → "${await page.locator('.navtab .count').first().innerText()}"`);
  await ctx.close();
  ({ page, ctx } = await open(b, 'worst', { view: 'estimates' }));
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.est-row')).map((r) => ({ name: r.querySelector('.est-open').innerText, pill: r.querySelector('.pill').innerText, av: r.querySelector('.av') ? r.querySelector('.av').outerHTML.slice(0, 60) : '' })));
  ok(!(await page.evaluate(() => Array.from(document.images).some((i) => i.complete && i.naturalWidth === 0))), 'no broken avatar images; initials: ' + [...new Set(rows.map((r) => (r.av.match(/>([^<]*)</) || [])[1]).filter(Boolean))].join(' '));
  ok(rows.some((r) => r.name.startsWith('Untitled estimate')), 'blank name shows "Untitled estimate"');
  ok(rows.some((r) => r.name.startsWith('🚀') && r.pill === 'Archived'), 'unknown status shows "Archived", not Draft');
  ok(await page.locator('.est-open[title]').count() === rows.length, 'every truncatable name has a hover title');
  await ctx.close();
  ({ page, ctx } = await open(b, 'worst', { view: 'estimate', id: 'est-focus', step: 'review' }));
  const txt = await page.evaluate(() => document.body.innerText);
  ok(!/includes [a-z][A-Z]/.test(txt) && /includes SEO metadata/.test(txt), 'acronyms keep their case in the register');
  ok(/7,293\.63/.test(txt), 'totals use thousands separators');
  await ctx.close();
  ({ page, ctx } = await open(b, 'worst', { view: 'settings' }));
  ok(await page.locator('#cx-mult-regulated').inputValue() === '2.25' && await page.locator('#cx-mult-simple').inputValue() === '0.75', 'multipliers show their stored values (0.75, 2.25)');
  ok(await page.locator('[id^="phase-"]').count() >= 3, 'phase list loads');
  await page.locator('#phase-new').fill('phase 3'); await page.locator('#phase-new').press('Enter');
  ok(await page.getByText('is already in the list').count() === 1, 'duplicate phase is refused with a message');
  await ctx.close(); await b.close();
})();
