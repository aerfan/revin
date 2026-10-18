// Guard: every rule in styles.css must survive the browser's CSS parser (a stray quote or comment drops the rest of the file).
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles.css'), 'utf8');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const r = await p.evaluate((c) => { const s = new CSSStyleSheet(); s.replaceSync(c); const sel = [...s.cssRules].map((x) => x.selectorText || x.cssText.slice(0, 40)); return { n: s.cssRules.length, last: sel.slice(-3) }; }, css);
  const want = ['.act-foot', '::selection', '.toast.leaving'];
  const text = await p.evaluate((c) => { const s = new CSSStyleSheet(); s.replaceSync(c); return [...s.cssRules].map((x) => x.cssText).join('\n'); }, css);
  const missing = want.filter((w) => !text.includes(w));
  const lastSrcSel = css.trim().split('\n').pop();
  console.log('rules parsed:', r.n, '| last:', r.last.join(' , '));
  await b.close();
  if (missing.length) { console.error('CSS PARSE CUT OFF — missing: ' + missing.join(', ')); process.exit(1); }
  console.log('CSS OK');
})();
