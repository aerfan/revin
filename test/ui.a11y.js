// UI QA: axe-core accessibility audit (both themes) + responsive overflow sweep across widths.
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'a11y');
fs.mkdirSync(OUT, { recursive: true });
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');
const axe = fs.readFileSync(path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const SKELETON = (body) => `<!doctype html><html lang="en"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;

// realistic data: two estimates, one fully built
const s = Object.assign({ id: 'website' }, seed['services/website']);
const est = E.createEstimate(s, 'website', seed['config/settings'], { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_me' });
['header', 'footer', 'home', 'about', 'services', 'service-detail', 'contact', 'pricing', 'blog-list'].forEach((id) => est.items.push(E.copyItem(s, s.items.find((x) => x.id === id), est)));
est.items[5].qty = 3; est.items[7].priority = 'should'; est.items[8].priority = 'wont'; est.items[4].complexity = 'complex';
Object.assign(est.scope.values, { tablet: true, languages: 2, illustrations: 3 }); est.scope.choice.theming = 'both';
est.customDeliverables.push({ key: 'c1', name: 'Brand workshop', qty: 1, hours: 8 });
est.register.risks.push({ id: 'r1', text: 'Content may arrive late' });
est.status = 'sent'; est.totalHours = E.round(E.compute(est).total, 1); est.updatedAt = Date.now();
const est2 = Object.assign(E.clone(est), { name: 'Bloom mobile app', client: 'Bloom Health', status: 'won', serviceId: 'mobile-app', serviceName: 'Mobile application', updatedAt: Date.now() - 86400000 });
const SEED = Object.assign({}, seed, { 'estimates/est-a': est, 'estimates/est-b': est2 });

const SCREENS = [
  ['dashboard', async (p) => { await p.locator('.est-row').first().waitFor(); }],
  ['new-estimate', async (p) => { await p.getByRole('button', { name: 'New estimate', exact: true }).first().click(); await p.locator('.svc-card').first().waitFor(); }],
  ['scope', async (p) => { await p.locator('.est-row', { hasText: 'Acme' }).click(); await p.locator('.step', { hasText: 'Scope' }).click(); await p.locator('.opt-row').first().waitFor(); }],
  ['build', async (p) => { await p.locator('.est-row', { hasText: 'Acme' }).click(); await p.locator('.step', { hasText: 'Build' }).click(); await p.locator('.lib-row').first().waitFor(); await p.locator('.lib-row.sel .chev').first().click(); await p.locator('.lib-row .icon-btn[aria-label^="What"]').first().click(); }],
  ['review', async (p) => { await p.locator('.est-row', { hasText: 'Acme' }).click(); await p.locator('.total-big').waitFor(); }],
  ['library-items', async (p) => { await p.locator('.navtab', { hasText: 'Library' }).click(); await p.locator('.ed-sum').first().click(); }],
  ['library-options', async (p) => { await p.locator('.navtab', { hasText: 'Library' }).click(); await p.locator('.cms-tab', { hasText: 'Scope options' }).click(); await p.locator('.ed-sum').first().click(); }],
  ['library-rules', async (p) => { await p.locator('.navtab', { hasText: 'Library' }).click(); await p.locator('.cms-tab', { hasText: 'Gap rules' }).click(); }],
  ['library-details', async (p) => { await p.locator('.navtab', { hasText: 'Library' }).click(); await p.locator('.cms-tab', { hasText: 'Service details' }).click(); }],
  ['settings', async (p) => { await p.locator('.navtab', { hasText: 'Settings' }).click(); await p.locator('#set-agency').waitFor(); }],
  ['deleted-banner', async (p) => { await p.locator('.est-row', { hasText: 'Acme' }).click(); await p.locator('.total-big').waitFor(); await p.evaluate(() => window.__remoteDelete('estimates/est-a')); await p.locator('.banner', { hasText: 'deleted by someone else' }).waitFor(); }],
  ['error-boundary', async (p) => { await p.evaluate(() => { const E = window.Engine; const c = E.compute; E.compute = function () { if (window.__boom) throw new Error('Injected'); return c.apply(this, arguments); }; window.__boom = true; }); await p.locator('.est-row .est-open', { hasText: 'Acme' }).click(); await p.getByText('Something went wrong showing this page').waitFor(); }],
  ['error-toast', async (p) => { await p.evaluate(() => window.__faults.push({ op: 'set', match: 'estimates/', code: 'quota_exceeded', times: 9 })); await p.locator('.est-row', { hasText: 'Acme' }).click(); await p.locator('#est-name').fill('Acme corporate site v2'); await p.locator('.toast.bad').waitFor({ timeout: 4000 }); }],
  ['modal', async (p) => { await p.locator('.est-row').first().getByRole('button', { name: /Delete/ }).click(); await p.locator('.modal').waitFor(); }],
];

let browser;
async function open(opts = {}) {
  const context = await browser.newContext({ viewport: opts.viewport || { width: 1360, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    if (/^https:\/\/app\.test\/($|[?#])/.test(u)) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });
  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED })};\n${mock}`);
  await page.goto('https://app.test/');
  return { page, context, errors };
}

(async () => {
  browser = await chromium.launch();
  const axeFindings = {};
  const overflow = [];
  let audits = 0, sweeps = 0;
  try {
    // ---------------- axe audit
    for (const dark of [false, true]) {
      for (const [name, go] of SCREENS) {
        const { page, context, errors } = await open({ dark });
        await go(page);
        await page.waitForTimeout(150);
        await page.addScriptTag({ content: axe });
        const res = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { 'page-has-heading-one': { enabled: false }, region: { enabled: false } } });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + (n.any[0] && n.any[0].data && n.any[0].data.contrastRatio ? ` (${n.any[0].data.contrastRatio}:1 fg ${n.any[0].data.fgColor} bg ${n.any[0].data.bgColor})` : '')) }));
        });
        audits++;
        for (const v of res) {
          const k = v.id;
          axeFindings[k] = axeFindings[k] || { impact: v.impact, help: v.help, screens: [], nodes: 0, samples: [] };
          axeFindings[k].screens.push((dark ? 'dark:' : 'light:') + name);
          axeFindings[k].nodes += v.nodes;
          if (axeFindings[k].samples.length < 6) axeFindings[k].samples.push(...v.sample.slice(0, 2));
        }
        if (errors.length) axeFindings['page-errors'] = { impact: 'critical', help: errors.join(' | '), screens: [name], nodes: errors.length, samples: [] };
        await context.close();
      }
    }
    // ---------------- responsive sweep
    const widths = [320, 360, 390, 414, 600, 768, 900, 1024, 1200, 1440, 1920];
    for (const w of widths) {
      for (const [name, go] of SCREENS.filter((x) => x[0] !== 'modal')) {
        const { page, context } = await open({ viewport: { width: w, height: 900 }, dark: w % 2 === 0 && w < 800 });
        try { await go(page); } catch (e) { overflow.push({ width: w, screen: name, hscroll: false, outside: ['navigation failed: ' + e.message.split('\n')[0]], outsideCount: 1, clipped: [] }); await context.close(); continue; }
        await page.waitForTimeout(120);
        const r = await page.evaluate(() => {
          const iw = window.innerWidth;
          const scrollers = '.table-wrap, .steps, .packs, .svc-list, .cms-tabs, .chips';
          const bad = [];
          document.querySelectorAll('body *').forEach((el) => {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
            if (el.closest(scrollers)) return;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) return;
            if (b.right > iw + 1 || b.left < -1) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.') + ` [${Math.round(b.left)}..${Math.round(b.right)}]`);
          });
          // clipped single-line text that is not intentionally truncated
          const clipped = [];
          document.querySelectorAll('button, .lib-name, h1, h2, h3, .opt-name, .cat-head h3, .bar-label, .field > span:first-child').forEach((el) => {
            const cs = getComputedStyle(el);
            if (cs.textOverflow === 'ellipsis' || el.classList.contains('sr')) return; // visually hidden on purpose
            if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && cs.overflowX !== 'visible') clipped.push(el.tagName.toLowerCase() + ':' + (el.innerText || '').slice(0, 30));
          });
          return { hscroll: document.documentElement.scrollWidth > iw, bad: bad.slice(0, 5), badCount: bad.length, clipped: clipped.slice(0, 5) };
        });
        sweeps++;
        if (r.hscroll || r.badCount || r.clipped.length) overflow.push({ width: w, screen: name, hscroll: r.hscroll, outside: r.bad, outsideCount: r.badCount, clipped: r.clipped });
        await context.close();
      }
    }
  } finally { await browser.close(); }

  fs.writeFileSync(path.join(OUT, 'axe.json'), JSON.stringify(axeFindings, null, 1));
  fs.writeFileSync(path.join(OUT, 'overflow.json'), JSON.stringify(overflow, null, 1));
  console.log(`axe: ${audits} audits (${SCREENS.length} screens × 2 themes) → ${Object.keys(axeFindings).length} rule violations`);
  Object.entries(axeFindings).sort((a, b) => b[1].nodes - a[1].nodes).forEach(([id, f]) => {
    console.log(`  [${f.impact}] ${id}: ${f.help} — ${f.nodes} nodes on ${f.screens.length} screens`);
    f.samples.slice(0, 4).forEach((s) => console.log('      · ' + s));
  });
  console.log(`\nresponsive: ${sweeps} screen×width checks → ${overflow.length} with problems`);
  overflow.slice(0, 25).forEach((o) => console.log(`  ${o.width}px ${o.screen}: hscroll=${o.hscroll} outside=${o.outsideCount} ${o.outside.slice(0, 2).join(', ')} clipped=${o.clipped.join(', ')}`));
  process.exitCode = Object.keys(axeFindings).length || overflow.length ? 1 : 0;
})();
