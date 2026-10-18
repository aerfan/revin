// Builds the standalone web app into dist-web/: index.html (styles, engine, runtime and app inlined)
// plus the vendored libraries. Reads the Supabase settings from the environment:
//   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL            e.g. https://abcd.supabase.co
//   SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY  the project's public anon key (safe to ship)
//   AGENCY_NAME (optional)                             shown on the sign-in screen
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-web');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
try { // local convenience: .env.local / .env
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    for (const line of read(f).split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
  }
} catch (e) { /* optional */ }
const env = (...names) => names.map((n) => process.env[n]).find((v) => v && v.trim()) || '';
const url = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
const key = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (url && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) throw new Error('SUPABASE_URL should look like https://xyz.supabase.co, got: ' + url);
if (!url || !key) console.warn('warning: SUPABASE_URL / SUPABASE_ANON_KEY not set — the app will show a setup message');
const config = { supabaseUrl: url, supabaseAnonKey: key, agencyName: env('AGENCY_NAME').slice(0, 80) };

const origin = url ? new URL(url).origin : '';
const ws = origin.replace(/^http/, 'ws');
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${origin} ${ws} https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://*.googleapis.com`.trim(),
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'self' https://accounts.google.com https://*.supabase.co",
  "object-src 'none'",
].join('; ');

const { assembleApp } = require('../dev/bundle-ui.js');
assembleApp(ROOT);
const parts = { CSS: read('src', 'styles.css'), ENGINE: read('src', 'engine.js'), RUNTIME: read('web', 'runtime.js'), APP: read('src', 'app.js') };
for (const [k, v] of Object.entries(parts)) if (/<\/script/i.test(v) || /<\/style/i.test(v)) throw new Error(`${k} contains a closing tag that would break inlining`);
let html = read('web', 'template.html');
html = html.replace('/*__CSP__*/', () => csp.replace(/"/g, '&quot;'));
html = html.replace('/*__CONFIG__*/', () => JSON.stringify(config).replace(/</g, '\\u003c'));
for (const [k, v] of Object.entries(parts)) html = html.replace(`/*__${k}__*/`, () => v);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);
for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'supabase.js', 'exceljs.min.js', 'docx.umd.js']) fs.copyFileSync(path.join(ROOT, 'libs', f), path.join(OUT, 'vendor', f));
fs.writeFileSync(path.join(OUT, 'vendor', 'preact-core.min.js'), read('libs', 'preact.umd.min.js') + '\n;' + read('libs', 'hooks.umd.min.js') + '\n;' + read('libs', 'htm.umd.min.js'));
console.log(`built dist-web/index.html ${(html.length / 1024).toFixed(1)} KB · supabase ${url ? origin : '(not configured)'}`);
