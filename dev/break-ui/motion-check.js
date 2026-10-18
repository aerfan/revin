// Samples the new motion mid-flight to confirm it runs (and that reduced motion keeps fades only).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(__dirname, 'break-ui.html'), 'utf8');
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
(async () => {
  const b = await chromium.launch();
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url();
      if (u.startsWith('https://harness.test/')) return r.fulfill({ contentType: 'text/html', body: html });
      for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js']) if (u.includes(f)) return r.fulfill({ contentType: 'application/javascript', body: LIB(f) });
      return r.abort(); });
    await page.goto('https://harness.test/?data=demo'); await page.locator('.est-row').first().waitFor();
    await page.locator('.est-row').first().getByRole('button', { name: /^Delete/ }).click();
    const t = await page.evaluate(async () => { const m = document.querySelector('.modal'); const out = []; for (const ms of [0, 60, 120, 260]) { await new Promise((r) => setTimeout(r, ms ? 60 : 0)); const cs = getComputedStyle(m); out.push(cs.opacity.slice(0, 4) + ' ' + cs.transform.slice(0, 22)); } return out; });
    console.log((reduced ? 'reduced ' : 'normal  ') + 'modal in:', t.join(' | '));
    await page.keyboard.press('Escape');
    const closing = await page.evaluate(() => !!document.querySelector('.modal-scrim.closing'));
    await page.locator('.modal').waitFor({ state: 'detached' });
    console.log('         modal exit class seen:', closing);
    await ctx.close();
  }
  await b.close();
})();
