// Extreme Canary Stress & Performance Benchmark: 1,000 Estimates & 500 Items
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

// Generate 1,000 realistic estimates
console.log('Generating 1,000 test estimates in memory...');
const svc = Object.assign({ id: 'website' }, seed['services/website']);
const settings = seed['config/settings'];
const estMap = {};

const clients = ['Acme Corp', 'Apex Financial', 'Stripe Global', 'Vercel Partner', 'NextGen Media', 'Nordic Bank', 'Atlas Health', 'Loom Video'];
const statuses = ['draft', 'sent', 'won', 'lost'];
const currencies = ['USD', 'EUR', 'GBP', 'BDT', 'CAD', 'AUD'];

for (let i = 1; i <= 1000; i++) {
  const client = clients[i % clients.length];
  const est = E.createEstimate(svc, 'website', settings, {
    id: `est-bench-${i}`,
    name: `Project ${client} Phase ${Math.floor(i / 10) + 1}`,
    client: client,
    userId: 'u_tester'
  });
  est.hourlyRate = 80 + (i % 15) * 10;
  est.currency = currencies[i % currencies.length];
  est.status = statuses[i % statuses.length];
  est.items.push(E.copyItem(svc, svc.items[0], est));
  est.items.push(E.copyItem(svc, svc.items[1], est));
  if (i % 3 === 0) est.items.push(E.copyItem(svc, svc.items[2], est));
  const calc = E.compute(est);
  est.totalHours = E.round(calc.total, 1);
  est.totalCost = calc.totalCost;
  est.updatedAt = Date.now() - i * 60000;
  estMap[`estimates/est-bench-${i}`] = est;
}

const SEED_1000 = Object.assign({}, seed, estMap);

async function runExtremeStressSuite() {
  console.log('\n====================================================');
  console.log('Starting Extreme Performance & Stress Benchmark');
  console.log('Target: 1,000 Estimates Dashboard & 500-Item Breakdown');
  console.log('====================================================\n');

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js', 'docx.umd.js', 'preact-core.min.js']) {
      if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    }
    try { if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' }); } catch (_) {}
    return route.abort();
  });

  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED_1000 })};\n${mock}`);

  // Benchmark 1: Initial Cold Boot with 1,000 Estimates
  const t0 = Date.now();
  await page.goto('https://app.test/');
  await page.locator('.est-row').first().waitFor({ timeout: 10000 });
  const bootTime = Date.now() - t0;
  console.log(`✓ Cold boot & 1,000-estimate feed rendered in: ${bootTime}ms`);
  assert(bootTime < 2500, `Boot time should be under 2500ms, took ${bootTime}ms`);

  // Benchmark 2: Instant Search Across 1,000 Records
  const tSearch = Date.now();
  await page.locator('#est-search').fill('Stripe');
  await page.waitForTimeout(150);
  const searchResultsCount = await page.locator('.est-row').count();
  const searchTime = Date.now() - tSearch;
  console.log(`✓ Real-time search across 1,000 records filtered to ${searchResultsCount} rows in: ${searchTime}ms`);
  assert(searchResultsCount > 0, 'Search should find records for Stripe');
  assert(searchTime < 500, `Search should execute under 500ms, took ${searchTime}ms`);

  // Clear search filter
  await page.locator('#est-search').fill('');
  await page.waitForTimeout(100);

  // Benchmark 3: Massive 500-Item Estimate Engine Computation Benchmark
  console.log('\n--- 500 Items Mega-Estimate Calculation Benchmark ---');
  const megaEst = E.createEstimate(svc, 'website', settings, {
    name: 'Mega Enterprise Platform Scope',
    client: 'Fortune 50 Enterprise',
    hourlyRate: 150,
    currency: 'USD'
  });
  // Populate with 500 items with varying complexity multipliers
  for (let i = 0; i < 500; i++) {
    const templateItem = svc.items[i % svc.items.length];
    const item = E.copyItem(svc, templateItem, megaEst);
    item.id = `item-bench-${i}`;
    item.complexity = i % 3 === 0 ? 'complex' : i % 5 === 0 ? 'simple' : 'standard';
    item.quantity = (i % 4) + 1;
    megaEst.items.push(item);
  }

  const tCompute = Date.now();
  const megaRes = E.compute(megaEst);
  const computeTime = Date.now() - tCompute;
  console.log(`✓ 500-item estimate computed in: ${computeTime}ms`);
  console.log(`  Total Hours: ${E.round(megaRes.total, 1)}h | Cost: $${E.round(megaRes.totalCost, 0).toLocaleString()}`);
  assert(computeTime < 50, `Deterministic engine must compute 500 items under 50ms, took ${computeTime}ms`);

  // Benchmark 4: 60 Rapid View Navigations (Stress Churn)
  console.log('\n--- Rapid Navigation Churn (60 view transitions) ---');
  await page.locator('.est-row').first().click();
  await page.locator('.total-big').waitFor({ timeout: 5000 });

  const tChurn = Date.now();
  for (let i = 0; i < 20; i++) {
    await page.locator('.step', { hasText: 'Scope' }).click();
    await page.locator('.step', { hasText: 'Build' }).click();
    await page.locator('.step', { hasText: 'Review' }).click();
  }
  const churnTime = Date.now() - tChurn;
  console.log(`✓ 60 rapid view transitions completed in: ${churnTime}ms (${Math.round(churnTime / 60)}ms / transition)`);
  assert(churnTime < 5000, `60 transitions should complete under 5000ms, took ${churnTime}ms`);

  // Benchmark 5: Heap Memory Footprint Inspection
  const heap = await page.evaluate(() => {
    if (window.performance && window.performance.memory) {
      return {
        usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)),
        totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024))
      };
    }
    return null;
  });

  if (heap) {
    console.log(`✓ Final Memory Heap Footprint: ${heap.usedJSHeapSize} MB used / ${heap.totalJSHeapSize} MB allocated`);
    assert(heap.usedJSHeapSize < 120, `Heap memory should remain well below 120MB, measured ${heap.usedJSHeapSize} MB`);
  }

  assert(errors.length === 0, `Page errors encountered during extreme stress test: ${errors.join(', ')}`);
  console.log(`✓ Page Errors: 0`);

  await browser.close();
  console.log('\n====================================================');
  console.log('ALL EXTREME PERFORMANCE & STRESS BENCHMARKS PASSED');
  console.log('====================================================\n');
}

runExtremeStressSuite().catch((err) => {
  console.error('Extreme stress test failed:', err);
  process.exit(1);
});
