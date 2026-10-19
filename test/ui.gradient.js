// Measure worst-case contrast of text drawn on the gradient start card (axe cannot judge gradients).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(ROOT, 'test', 'mock-claude.js'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const SP = path.join(__dirname, 'out', 'a11y', 'gradient'); fs.mkdirSync(SP, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  for (const dark of [false, true]) for (const width of [1360, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route('**/*', (route) => {
      const u = route.request().url();
      for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
      if (/^https:\/\/app\.test\/($|[?#])/.test(u)) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body style="margin:0">' + page$ + '</body></html>' });
      return route.abort();
    });
    await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed })};\n${mock}`);
    await page.goto('https://app.test/');
    const card = page.locator('.start-card');
    await card.waitFor();
    const els = await page.evaluate(() => Array.from(document.querySelectorAll('.start-card h2, .start-card p, .start-card .go, .start-card .pill')).map((e) => { const b = e.getBoundingClientRect(); return { sel: e.tagName.toLowerCase() + (e.className ? '.' + e.className.split(' ').join('.') : ''), x: b.x, y: b.y, w: b.width, h: b.height, color: getComputedStyle(e).color }; }));
    await page.screenshot({ path: path.join(SP, `card-${dark ? 'dark' : 'light'}-${width}.text.png`) });
    await page.addStyleTag({ content: '.start-card * { color: transparent !important; } .start-card svg { visibility: hidden }' });
    await page.waitForTimeout(50);
    const shot = path.join(SP, `card-${dark ? 'dark' : 'light'}-${width}.png`);
    await page.screenshot({ path: shot });
    fs.writeFileSync(shot + '.json', JSON.stringify(els));
    await context.close();
  }
  await browser.close();
})();
// After capturing, score every glyph pixel with the WCAG formula (axe skips text on gradients).
process.on('beforeExit', () => {
  if (process.__scored) return; process.__scored = true;
  const r = require('child_process').spawnSync('python3', [path.join(__dirname, 'gradient_contrast.py'), path.join(__dirname, 'out', 'a11y', 'gradient')], { encoding: 'utf8' });
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  process.exitCode = r.status;
});
