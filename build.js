// Inlines styles, engine and app into a single publishable page.
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const parts = { CSS: src('styles.css'), ENGINE: src('engine.js'), APP: src('app.js') };
for (const [k, v] of Object.entries(parts)) {
  if (/<\/script/i.test(v) || /<\/style/i.test(v)) throw new Error(`${k} contains a closing tag that would break inlining`);
}
let out = src('template.html');
for (const [k, v] of Object.entries(parts)) out = out.replace(`/*__${k}__*/`, () => v);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const file = path.join(__dirname, 'dist', 'design-hours-estimator.html');
fs.writeFileSync(file, out);
console.log('built', file, (out.length / 1024).toFixed(1) + ' KB', '| title within first 8KB:', out.indexOf('<title>') < 8192);
