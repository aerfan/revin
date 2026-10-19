// Break-UI scan: every screen × dataset × environment, with automatic detectors for the failure
// signatures in the break-ui catalog, plus full-page screenshots for visual review.
// Usage: node dev/break-ui/scan.js [datasets=demo,worst,one,empty,huge] [only=<screen regex>]
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const html = fs.readFileSync(path.join(__dirname, 'break-ui.html'), 'utf8');
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const DATASETS = (args.datasets || 'demo,worst,one,empty,huge').split(',');
const ONLY = args.only ? new RegExp(args.only) : null;

const ENVS = {
  d1360: { viewport: { width: 1360, height: 900 } },
  d1024: { viewport: { width: 1024, height: 800 } },
  p390: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  p320: { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true },
  w1920: { viewport: { width: 1920, height: 1080 } },
  z200: { viewport: { width: 680, height: 450 }, deviceScaleFactor: 2 }, // a 1360×900 window at 200% zoom
  dark1360: { viewport: { width: 1360, height: 900 }, colorScheme: 'dark' },
  dark390: { viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true },
};
const PLAN = {
  demo: { envs: ['d1360', 'p390', 'p320'], shots: ['d1360', 'p390'] },
  worst: { envs: Object.keys(ENVS), shots: ['d1360', 'p390', 'p320', 'z200', 'dark390'] },
  one: { envs: ['d1360', 'p390'], shots: ['d1360', 'p390'] },
  empty: { envs: ['d1360', 'p390'], shots: ['d1360', 'p390'] },
  huge: { envs: ['d1360', 'p390'], shots: ['d1360'] },
};

const est = (step, id) => ({ view: 'estimate', id: id || 'est-focus', step });
const lib = (serviceId, tab) => ({ view: 'library', serviceId, tab });
async function clickAll(page, sel, n) { const l = page.locator(sel); const c = Math.min(n || 99, await l.count()); for (let i = 0; i < c; i++) { try { await l.nth(i).click({ timeout: 1500 }); } catch (e) { /* hidden at this width */ } } }
async function expandRows(page, names) {
  for (const nm of names) {
    const row = page.locator('.lib-row.sel', { hasText: nm }).first();
    if (await row.count()) { try { await row.locator('.chev').click({ timeout: 1500 }); } catch (e) { /* ignore */ } }
  }
}
const SCREENS = [
  { id: 'dashboard', route: { view: 'estimates' } },
  { id: 'new', route: { view: 'new' } },
  { id: 'service', route: est('service'), needs: 'focus' },
  { id: 'scope', route: est('scope'), needs: 'focus' },
  { id: 'build', route: est('build'), needs: 'focus', prep: async (p) => {
    await expandRows(p, ['Home', 'Header', 'Checkout', 'Loan EMI', 'Service detail']);
    await clickAll(p, '.lib-row .icon-btn[aria-label^="What"]', 3);
  } },
  { id: 'review', route: est('review'), needs: 'focus', prep: async (p) => { const b = p.getByRole('button', { name: /^Show / }).first(); if (await b.count()) await b.click(); } },
  { id: 'review-outdated', route: est('review'), needs: 'focus', sets: ['worst'], prep: async (p) => {
    await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__store.get('services/website'))); s.optionGroups[0].options[1].value = 99; window.__remoteSet('services/website', s); });
    await p.locator('.banner.warn').first().waitFor({ timeout: 3000 });
  } },
  { id: 'deleted-banner', route: est('scope'), needs: 'focus', sets: ['worst', 'demo'], prep: async (p) => {
    await p.evaluate(() => window.__remoteDelete('estimates/est-focus'));
    await p.locator('.banner', { hasText: 'deleted by someone else' }).waitFor({ timeout: 3000 });
  } },
  { id: 'gone-service', route: est('build', 'est-gone'), sets: ['worst'] },
  { id: 'arabic-build', route: est('build', 'est-ar'), sets: ['worst'], prep: async (p) => { await expandRows(p, ['الصفحة']); } },
  { id: 'arabic-review', route: est('review', 'est-ar'), sets: ['worst'] },
  { id: 'lib-items', route: lib('website', 'items'), prep: async (p) => { await clickAll(p, '.ed-sum', 1); const t = p.locator('.ed-sum', { hasText: 'Services overview' }); if (await t.count()) await t.first().click(); } },
  { id: 'lib-subs', route: lib('website', 'subs'), prep: async (p) => { await clickAll(p, '.ed-sum', 1); } },
  { id: 'lib-options', route: lib('website', 'options'), prep: async (p) => { const t = p.locator('.ed-sum', { hasText: 'Accessibility annotations' }); if (await t.count()) await t.first().click(); else await clickAll(p, '.ed-sum', 1); } },
  { id: 'lib-packs', route: lib('website', 'packs') },
  { id: 'lib-rules', route: lib('website', 'rules') },
  { id: 'lib-details', route: lib('website', 'overview') },
  { id: 'lib-mobile', route: lib('mobile-app', 'items'), prep: async (p) => { await clickAll(p, '.ed-sum', 1); } },
  { id: 'lib-arabic', route: lib('store-ar', 'items'), sets: ['worst'], prep: async (p) => { await clickAll(p, '.ed-sum', 1); } },
  { id: 'lib-empty-service', route: lib('discovery', 'items'), sets: ['empty'] },
  { id: 'settings', route: { view: 'settings' } },
  { id: 'modal', route: { view: 'estimates' }, needs: 'rows', prep: async (p) => { await p.locator('.est-row').first().getByRole('button', { name: /^Delete/ }).click(); await p.locator('.modal').waitFor(); } },
  { id: 'toast-remove', route: est('build'), needs: 'focus', prep: async (p) => {
    const row = p.locator('.lib-row.sel', { hasText: /Checkout|Home/ }).first();
    await row.locator('input.cb').click(); await p.locator('.toast').first().waitFor({ timeout: 2000 });
  } },
  { id: 'toast-export', route: est('review'), needs: 'focus', prep: async (p) => {
    await p.locator('.export-btn', { hasText: 'CSV table' }).click(); await p.locator('.toast').first().waitFor({ timeout: 4000 });
  } },
  { id: 'empty-editor', route: { view: 'new' }, sets: ['empty'], prep: async (p) => {
    await p.locator('.svc-card', { hasText: 'Discovery workshop' }).click(); await p.locator('.step[aria-current="step"]').waitFor();
    await p.locator('.step', { hasText: 'Build' }).click(); await p.waitForTimeout(150);
  } },
  { id: 'empty-review', route: { view: 'new' }, sets: ['empty'], prep: async (p) => {
    await p.locator('.svc-card', { hasText: 'Discovery workshop' }).click(); await p.locator('.step[aria-current="step"]').waitFor();
    await p.locator('.step', { hasText: 'Review' }).click(); await p.waitForTimeout(150);
  } },
];

// ------------------------------------------------------------- detectors (run in the page)
function detect() {
  const out = [];
  const iw = window.innerWidth;
  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const text = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const dev = (el) => !!el.closest('.dev-data-switch, .sr');
  // clipped by an ancestor that hides overflow: not visible, so not "off screen" (the ancestor is reported instead)
  const clippedBy = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (o.overflowX !== 'visible' || o.overflowY !== 'visible') return a; } return null; };
  // number of rendered text lines inside an element (text nodes only, so icons don't count)
  const lineCount = (el) => {
    const tops = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      Array.from(rg.getClientRects()).forEach((rc) => { if (rc.width > 0.5) tops.push(rc.top + rc.height / 2); });
    }
    tops.sort((a, b) => a - b);
    let lines = 0, last = -1e9;
    tops.forEach((t) => { if (t - last > 6) { lines++; last = t; } });
    return lines;
  };
  const scrollers = '.table-wrap, .steps, .cms-tabs, .chips, .packs';
  // A. page scrolls sideways
  if (document.documentElement.scrollWidth > iw + 1) out.push({ kind: 'hscroll', el: 'html', text: '', detail: document.documentElement.scrollWidth + ' > ' + iw });
  const all = Array.from(document.querySelectorAll('body *')).filter((el) => !dev(el) && visible(el));
  for (const el of all) {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    // B. outside the viewport
    if ((b.right > iw + 1 || b.left < -1) && !el.closest(scrollers) && !clippedBy(el)) out.push({ kind: 'offscreen', el: label(el), text: text(el), detail: Math.round(b.left) + '..' + Math.round(b.right) + ' of ' + iw });
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    const ow = el.scrollWidth - el.clientWidth;
    if (hasText && ow > 1 && el.clientWidth > 0 && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
      if (cs.overflowX === 'visible') out.push({ kind: 'spill', el: label(el), text: text(el), detail: 'text ' + el.scrollWidth + 'px in a ' + el.clientWidth + 'px box' });
      else if (cs.textOverflow !== 'ellipsis') out.push({ kind: 'clipped', el: label(el), text: text(el), detail: 'overflow ' + cs.overflowX + ', ' + ow + 'px hidden' });
      else if (!el.title && !el.closest('[title]')) out.push({ kind: 'truncated-no-title', el: label(el), text: text(el), detail: ow + 'px cut, no title/tooltip' });
    }
    // M. tall scripts clipped vertically by single-line clipping
    if (hasText && cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1 && cs.whiteSpace === 'nowrap') out.push({ kind: 'clipped-vertical', el: label(el), text: text(el), detail: el.scrollHeight + ' > ' + el.clientHeight });
  }
  // F. squished square things
  document.querySelectorAll('.tile, .av, .brand-mark, .choice .dot, input.cb, .icon-btn, .stepper button').forEach((el) => {
    if (dev(el) || !visible(el)) return;
    const b = el.getBoundingClientRect();
    if (Math.abs(b.width - b.height) > 2) out.push({ kind: 'squished', el: label(el), text: text(el.closest('.est-row, .lib-row, .side-foot, .svc-item, .menu-item, .cat-head, .opt-row, .choice, .deliv-row, .panel-head, .sub-row, .custom-row, .adj-row') || el), detail: Math.round(b.width) + '×' + Math.round(b.height) });
  });
  // G. badges and pills that wrapped
  document.querySelectorAll('.pill, .hrs, .mini, .chip, .tag, .role, .src, .qty-badge, .savestate, .step, .count, .navtab, .cms-tab, .seg button, .btn').forEach((el) => {
    if (dev(el) || !visible(el)) return;
    const cs = getComputedStyle(el);
    const n = lineCount(el);
    if (n > 1) out.push({ kind: 'badge-wrapped', el: label(el), text: text(el), detail: n + ' lines' });
    if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.push({ kind: 'badge-overflow', el: label(el), text: text(el), detail: el.scrollWidth + ' > ' + el.clientWidth });
  });
  // K. broken images
  document.querySelectorAll('img').forEach((img) => { if (!dev(img) && img.complete && img.naturalWidth === 0) out.push({ kind: 'broken-image', el: label(img), text: img.getAttribute('src') ? img.getAttribute('src').slice(0, 70) : '(empty src)', detail: img.title || img.alt || '' }); });
  // L. siblings overlapping inside rows
  document.querySelectorAll('.est-row, .lib-row, .opt-row, .adj-row, .custom-row, .sub-row, .suggest-item, .bar-row, .deliv-row, .reg-item, .cat-head, .cat-block-head, .ed-sum, .side-foot, .recent-item, .svc-item, .menu-item, .panel-head, .ed-head, .crumbs, .toast, .banner, .insp-card, .rule-row, .str-row, .choice, .svc-card').forEach((row) => {
    if (dev(row) || !visible(row)) return;
    const kids = Array.from(row.children).filter(visible).map((k) => [k, k.getBoundingClientRect()]);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i][1], c = kids[j][1];
      const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ix > 2 && iy > 2) out.push({ kind: 'overlap', el: label(row), text: text(row).slice(0, 60), detail: label(kids[i][0]) + ' ∩ ' + label(kids[j][0]) + ' ' + Math.round(ix) + '×' + Math.round(iy) });
    }
    // trailing children pushed out of their row
    const rb = row.getBoundingClientRect();
    kids.forEach(([k, b]) => { if (b.right > rb.right + 2 && getComputedStyle(row).overflow === 'visible') out.push({ kind: 'pushed-out', el: label(row), text: text(row).slice(0, 60), detail: label(k) + ' ends ' + Math.round(b.right - rb.right) + 'px past the row' }); });
  });
  // N. interactive elements with no visible text and no accessible name
  document.querySelectorAll('button, [role="button"], a').forEach((el) => {
    if (dev(el) || !visible(el)) return;
    if (!(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.title && !el.querySelector('svg, img')) out.push({ kind: 'blank-control', el: label(el), text: JSON.stringify(el.textContent), detail: 'no visible text or name' });
  });
  // H, I, J. text checks on what the person reads
  const body = Array.from(document.querySelectorAll('#app')).map((a) => a.innerText).join('\n');
  const raw = body.match(/[^\n]{0,30}\b(NaN|undefined|null|Infinity|\[object Object\]|Invalid Date)\b[^\n]{0,20}/g) || [];
  raw.forEach((m) => out.push({ kind: 'raw-value', el: '#app', text: m.trim(), detail: '' }));
  const pl = body.match(/(?:^|[^\d.,])1 (pages|sections|features|screens|items|estimates|services|suggestions|rules|options|languages|flows|deliverables|component states|screens & user flows|sub-items|days|weeks|designer-weeks)\b/gi) || [];
  pl.forEach((m) => out.push({ kind: 'plural', el: '#app', text: m.trim(), detail: '' }));
  const pl0 = body.match(/\b0 (page|section|feature|item|estimate|service|suggestion|rule|option)\b(?!s)/gi) || [];
  pl0.forEach((m) => out.push({ kind: 'plural', el: '#app', text: m.trim(), detail: 'zero with singular' }));
  const big = body.match(/[^\n\d,.]{0,24}\b\d{4,}(?:\.\d)?\s?h\b[^\n]{0,8}/g) || [];
  big.forEach((m) => out.push({ kind: 'number-format', el: '#app', text: m.trim(), detail: 'no thousands separator' }));
  const bigCount = body.match(/[^\n\d,.]{0,24}(?<![\d,.#])\d{4,}(?![\d,.]|\s?h\b|px|%|-\d)[^\n]{0,12}/g) || [];
  bigCount.forEach((m) => { if (!/20\d\d|IMG_|#\d{3,}/.test(m)) out.push({ kind: 'number-format', el: '#app', text: m.trim(), detail: 'count without separator' }); });
  const quarter = body.match(/\b\d+\.\d{2,}\b/g) || [];
  quarter.forEach((m) => out.push({ kind: 'number-precision', el: '#app', text: m, detail: 'more than one decimal shown' }));
  return out;
}

// ------------------------------------------------------------- runner
(async () => {
  const browser = await chromium.launch();
  const findings = [];
  const perf = [];
  let loads = 0;
  try {
    for (const ds of DATASETS) {
      const plan = PLAN[ds];
      for (const sc of SCREENS) {
        if (ONLY && !ONLY.test(sc.id)) continue;
        if (sc.sets && !sc.sets.includes(ds)) continue;
        if (ds === 'empty' && (sc.needs === 'focus' || sc.needs === 'rows')) continue;
        if (ds === 'huge' && !['dashboard', 'build', 'review'].includes(sc.id)) continue;
        if (ds === 'one' && ['lib-mobile'].includes(sc.id)) continue;
        for (const envId of plan.envs) {
          const env = ENVS[envId];
          const ctx = await browser.newContext(Object.assign({}, env));
          const page = await ctx.newPage();
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
          await page.route('**/*', (route) => {
            const u = route.request().url();
            if (u.startsWith('https://harness.test/')) return route.fulfill({ contentType: 'text/html', body: html });
            for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
            if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
            return route.abort();
          });
          await page.addInitScript((r) => { try { localStorage.setItem('dhe:route', JSON.stringify(r)); } catch (e) { /* ignore */ } }, sc.route);
          const t0 = Date.now();
          let navErr = null;
          try {
            await page.goto('https://harness.test/?data=' + ds);
            await page.locator('.side').waitFor({ timeout: 15000 });
            await page.waitForTimeout(250);
            if (ds === 'huge') perf.push({ screen: sc.id, env: envId, ms: Date.now() - t0 });
            if (sc.prep) await sc.prep(page);
            await page.waitForTimeout(180);
          } catch (e) { navErr = e.message.split('\n')[0]; }
          loads++;
          const res = navErr ? [{ kind: 'navigation', el: '', text: navErr, detail: '' }] : await page.evaluate(detect);
          errors.forEach((e) => res.push({ kind: 'page-error', el: '', text: e.slice(0, 160), detail: '' }));
          res.forEach((f) => findings.push(Object.assign({ dataset: ds, screen: sc.id, env: envId }, f)));
          if (plan.shots.includes(envId) && !navErr) {
            await page.locator('.dev-data-switch').evaluate((el) => { el.style.display = 'none'; }).catch(() => {});
            await page.screenshot({ path: path.join(OUT, 'shots', `${ds}__${sc.id}__${envId}.png`), fullPage: true });
          }
          await ctx.close();
        }
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 1));
  fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(perf, null, 1));
  // summary: unique (kind, el, text) per dataset, with where they were seen
  const uniq = new Map();
  for (const f of findings) {
    const k = [f.dataset, f.kind, f.el, f.text].join(' | ');
    if (!uniq.has(k)) uniq.set(k, Object.assign({}, f, { where: [] }));
    uniq.get(k).where.push(f.screen + '@' + f.env);
  }
  const rows = Array.from(uniq.values());
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 1));
  console.log(`${loads} page loads, ${findings.length} raw findings, ${rows.length} unique`);
  const byKind = {};
  rows.forEach((r) => { const k = r.dataset + ':' + r.kind; byKind[k] = (byKind[k] || 0) + 1; });
  Object.entries(byKind).sort().forEach(([k, n]) => console.log('  ' + k.padEnd(34) + n));
  if (perf.length) console.log('huge timings', JSON.stringify(perf));
})();
