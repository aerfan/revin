// Canary Screen Sizes & Viewport Sweeps Test
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const E = require('../src/engine.js');

const ROOT = path.join(__dirname, '..');
const page$ = fs.readFileSync(path.join(ROOT, 'dist', 'design-hours-estimator.html'), 'utf8');
const mock = fs.readFileSync(path.join(__dirname, 'mock-claude.js'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', 'seed.json'), 'utf8'));
const LIB = (f) => fs.readFileSync(path.join(ROOT, 'libs', f));
const SKELETON = (body) => `<!doctype html><html lang="en"><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;

// Setup realistic estimate
const svc = Object.assign({ id: 'website' }, seed['services/website']);
const est = E.createEstimate(svc, 'website', seed['config/settings'], { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_me' });
['header', 'footer', 'home', 'about', 'services', 'contact'].forEach((id) => est.items.push(E.copyItem(svc, svc.items.find((x) => x.id === id), est)));
est.items[4].complexity = 'complex';
est.scope.values.tablet = true;
est.hourlyRate = 120;
est.currency = 'USD';
est.status = 'draft';
const res = E.compute(est);
est.totalHours = E.round(res.total, 1);
est.totalCost = res.totalCost;
est.updatedAt = Date.now();

const SEED = Object.assign({}, seed, { 'estimates/est-a': est });

const VIEWPORTS = [
  { name: 'iPhone SE 1st Gen (Ultra-Compact)', width: 320, height: 568 },
  { name: 'Galaxy S Series (Android Compact)', width: 360, height: 800 },
  { name: 'iPhone mini / SE 3rd Gen', width: 375, height: 667 },
  { name: 'iPhone 14 / 15 / 16 (Standard)', width: 390, height: 844 },
  { name: 'iPhone Pro Max (Large Mobile)', width: 414, height: 896 },
  { name: 'iPad Mini / Air Portrait (Tablet)', width: 768, height: 1024 },
  { name: 'iPad 10th Gen Portrait', width: 820, height: 1180 },
  { name: 'iPad Landscape / Small Laptop', width: 1024, height: 768 },
  { name: 'MacBook Air 13" (Compact Desktop)', width: 1280, height: 800 },
  { name: 'Standard Desktop', width: 1440, height: 900 },
  { name: '1080p FHD Monitor', width: 1920, height: 1080 },
  { name: 'QHD Ultrawide Monitor', width: 2560, height: 1440 }
];

const defects = [];
function recordDefect(viewport, viewName, type, description) {
  defects.push({ viewport: viewport.name, width: viewport.width, view: viewName, type, description });
  console.error(`[OVERFLOW/DEFECT] ${viewport.name} (${viewport.width}px) @ ${viewName}: ${type} - ${description}`);
}

async function runScreenTests() {
  console.log('====================================================');
  console.log(`Starting Viewport & Responsive Sweeps (${VIEWPORTS.length} Screen Profiles)`);
  console.log('====================================================\n');

  const browser = await chromium.launch();
  let totalChecks = 0;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.width < 768 ? 2 : 1,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
      for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js', 'docx.umd.js']) {
        if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
      }
      if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
      return route.abort();
    });

    await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED })};\n${mock}`);
    await page.goto('https://app.test/');

    // Helper to test overflow on current view
    async function checkView(viewName) {
      totalChecks++;
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(root.scrollWidth, body.scrollWidth);
        const clientWidth = root.clientWidth;
        if (scrollWidth > clientWidth) {
          // Identify overflowing elements
          const culprits = [];
          document.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > clientWidth + 1) {
              culprits.push({ tag: el.tagName, id: el.id, class: el.className, right: Math.round(rect.right), clientWidth });
            }
          });
          return { scrollWidth, clientWidth, diff: scrollWidth - clientWidth, culprits: culprits.slice(0, 3) };
        }
        return null;
      });

      if (overflow) {
        recordDefect(vp, viewName, 'Horizontal Overflow', `scrollWidth ${overflow.scrollWidth}px > clientWidth ${overflow.clientWidth}px (+${overflow.diff}px). Culprits: ${JSON.stringify(overflow.culprits)}`);
      }
    }

    // 1. Dashboard View
    await page.locator('.est-row').first().waitFor({ timeout: 5000 });
    await checkView('Dashboard');

    // 2. Estimate Review View (with Financials Cost Badge)
    await page.locator('.est-row', { hasText: 'Acme corporate site' }).click();
    await page.locator('.total-big').waitFor({ timeout: 5000 });
    await checkView('Estimate Review');

    // 3. Estimate Scope View
    await page.locator('.step', { hasText: 'Scope' }).click();
    await page.waitForTimeout(100);
    await checkView('Estimate Scope');

    // 4. Estimate Build View (with Inspector Cost Badge)
    await page.locator('.step', { hasText: 'Build' }).click();
    await page.locator('.lib-row').first().waitFor({ timeout: 5000 });
    await checkView('Estimate Build');

    // 5. Settings View (with Financials Defaults)
    await page.locator('.navtab', { hasText: 'Settings' }).click();
    await page.locator('#set-agency').waitFor({ timeout: 5000 });
    await checkView('Settings');

    if (pageErrors.length > 0) {
      recordDefect(vp, 'Runtime', 'Page Errors', pageErrors.join('; '));
    }

    console.log(`✓ [${vp.name}] ${vp.width}×${vp.height}px: All 5 views checked. Overflow: ${defects.filter(d => d.width === vp.width).length === 0 ? 'NONE' : 'DEFECTS FOUND'}`);
    await context.close();
  }

  await browser.close();

  console.log('\n====================================================');
  console.log(`RESPONSIVE SWEEP SUMMARY: ${totalChecks} views checked across ${VIEWPORTS.length} screen profiles`);
  console.log(`Defects found: ${defects.length}`);
  console.log('====================================================');

  if (defects.length > 0) {
    console.log(JSON.stringify(defects, null, 2));
    process.exit(1);
  } else {
    console.log('ALL VIEWPORTS PASSED WITH ZERO HORIZONTAL OVERFLOW');
    process.exit(0);
  }
}

runScreenTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
