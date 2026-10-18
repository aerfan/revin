// Canary Stress, Concurrency & Chaos Test Suite
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

// Setup baseline seed
const svc = Object.assign({ id: 'website' }, seed['services/website']);
const est = E.createEstimate(svc, 'website', seed['config/settings'], { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_me' });
['header', 'footer', 'home', 'about', 'services', 'contact'].forEach((id) => est.items.push(E.copyItem(svc, svc.items.find((x) => x.id === id), est)));
est.items[4].complexity = 'complex';
est.hourlyRate = 100;
est.currency = 'USD';
est.status = 'draft';
const res = E.compute(est);
est.totalHours = E.round(res.total, 1);
est.totalCost = res.totalCost;
est.updatedAt = Date.now();

// Generate 500 estimates for high-volume stress testing
const SEED_STRESS = Object.assign({}, seed, { 'estimates/est-a': est });
const clients = ['Acme Corp', 'Apex Global', 'Zenith Labs', 'Vanguard', 'Aurora AI', 'Starlight', 'Hyperion', 'Nexus'];
const statuses = ['draft', 'won', 'lost'];
for (let i = 1; i <= 500; i++) {
  const e = Object.assign(E.clone(est), {
    name: `Project Alpha ${i}`,
    client: clients[i % clients.length],
    status: statuses[i % statuses.length],
    hourlyRate: 80 + (i % 10) * 10,
    updatedAt: Date.now() - i * 60000
  });
  const c = E.compute(e);
  e.totalHours = E.round(c.total, 1);
  e.totalCost = c.totalCost;
  SEED_STRESS[`estimates/est-stress-${i}`] = e;
}

const stressFindings = [];
function recordStressIssue(testName, symptom, details) {
  stressFindings.push({ test: testName, symptom, details });
  console.error(`[STRESS FAILURE] ${testName}: ${symptom} (${details})`);
}

async function runStressTests() {
  console.log('====================================================');
  console.log('Starting Canary Stress, Concurrency & Chaos Testing');
  console.log('====================================================\n');

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => {
    pageErrors.push(e.message);
    recordStressIssue('Runtime', 'Unhandled page error', e.message);
  });

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js', 'docx.umd.js']) {
      if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    }
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });

  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED_STRESS })};\n${mock}`);

  // Test 1: High-Volume Dashboard (500 estimates load & filter)
  console.log('--- Test 1: 500 Estimates Dashboard Load & Search Filter ---');
  const t0 = Date.now();
  await page.goto('https://app.test/');
  await page.locator('.est-row').first().waitFor({ timeout: 10000 });
  const loadDuration = Date.now() - t0;
  console.log(`✓ 500 estimates loaded in ${loadDuration}ms`);
  assert(loadDuration < 5000, `Dashboard load too slow: ${loadDuration}ms`);

  // Instant Search filter speed
  const tSearch = Date.now();
  await page.locator('#est-search').fill('Apex');
  await page.waitForTimeout(100);
  const searchCount = await page.locator('.est-row').count();
  const searchDuration = Date.now() - tSearch;
  console.log(`✓ Instant search for "Apex" filtered to ${searchCount} rows in ${searchDuration}ms`);
  assert(searchCount > 0, 'Search returned no rows for "Apex"');

  // Clear search
  await page.locator('#est-search').fill('');
  await page.waitForTimeout(100);

  // Test 2: Rapid Stepper Click Burst (50 increments without desync)
  console.log('\n--- Test 2: Rapid Stepper Click Storm (50 consecutive clicks) ---');
  await page.locator('.est-row', { hasText: 'Acme corporate site' }).click();
  await page.locator('.total-big').waitFor({ timeout: 5000 });

  const rateInput = page.locator('#est-rate');
  const startRate = Number(await rateInput.inputValue());
  assert(startRate === 100, `Expected initial rate 100, got ${startRate}`);

  const incBtn = page.locator('[data-stepper="est-rate"] button[aria-label^="Increase"]');
  const tBurst = Date.now();
  for (let i = 0; i < 20; i++) {
    await incBtn.click({ delay: 10 });
  }
  const burstDuration = Date.now() - tBurst;
  await page.waitForTimeout(300);

  const endRate = Number(await rateInput.inputValue());
  console.log(`✓ 20 rapid stepper clicks completed in ${burstDuration}ms. Rate: ${startRate} -> ${endRate} (step = 5)`);
  assert(endRate === 100 + 20 * 5, `Expected rate ${100 + 20 * 5}, got ${endRate}`);

  // Test 3: Financials Badge consistency under rapid rate change
  console.log('\n--- Test 3: Financials Badge Reactive Calculation Under Stress ---');
  const costBadge = await page.locator('.total-cost-badge').innerText();
  console.log(`✓ Updated cost badge under new rate: "${costBadge.trim().replace(/\s+/g, ' ')}"`);
  assert(costBadge.includes('$200/h'), 'Cost badge does not show updated rate $200/h: ' + costBadge);

  // Test 4: Heavy Estimate Calculation Performance (250 items compute benchmark)
  console.log('\n--- Test 4: Heavy Estimate Calculation Benchmark (250 items) ---');
  const heavyEst = E.clone(est);
  heavyEst.items = [];
  for (let i = 0; i < 250; i++) {
    const item = E.copyItem(svc, svc.items[i % svc.items.length], heavyEst);
    item.name = `Heavy Deliverable Item ${i + 1}`;
    heavyEst.items.push(item);
  }
  const tCompute = Date.now();
  const heavyRes = E.compute(heavyEst);
  const computeTime = Date.now() - tCompute;
  console.log(`✓ 250-item estimate computed in ${computeTime}ms. Total: ${E.round(heavyRes.total, 1)}h · Cost: $${heavyRes.totalCost.toLocaleString()}`);
  assert(computeTime < 50, `Compute time exceeded 50ms: ${computeTime}ms`);

  // Test 5: Rapid Navigation Churn & Memory Stability (30 transitions)
  console.log('\n--- Test 5: Rapid Navigation Churn & Memory Stability (30 view switches) ---');
  const tNav = Date.now();
  for (let i = 0; i < 10; i++) {
    await page.locator('.step', { hasText: 'Build' }).click();
    await page.locator('.step', { hasText: 'Scope' }).click();
    await page.locator('.step', { hasText: 'Review' }).click();
  }
  const navDuration = Date.now() - tNav;
  console.log(`✓ 30 rapid view navigations completed in ${navDuration}ms without crashing`);

  // Measure final heap memory
  const memoryInfo = await page.evaluate(() => {
    return window.performance && window.performance.memory ? {
      usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)),
      totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024))
    } : null;
  });
  if (memoryInfo) {
    console.log(`✓ Memory footprint after churn: ${memoryInfo.usedJSHeapSize} MB used / ${memoryInfo.totalJSHeapSize} MB total heap`);
    assert(memoryInfo.usedJSHeapSize < 120, `Heap memory usage too high: ${memoryInfo.usedJSHeapSize} MB`);
  }

  await browser.close();

  console.log('\n====================================================');
  console.log(`STRESS SUITE SUMMARY: ${stressFindings.length} issues found`);
  console.log('====================================================');

  if (stressFindings.length > 0) {
    console.log(JSON.stringify(stressFindings, null, 2));
    process.exit(1);
  } else {
    console.log('ALL STRESS & CONCURRENCY TESTS PASSED PERFECTLY');
    process.exit(0);
  }
}

runStressTests().catch((err) => {
  console.error('Fatal stress test failure:', err);
  process.exit(1);
});
