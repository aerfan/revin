// Canary Cross-Browser Compatibility Test: Chromium & WebKit (Safari engine)
const { chromium, webkit } = require('playwright');
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

// Prepare realistic seed data with estimates
const svc = Object.assign({ id: 'website' }, seed['services/website']);
const est = E.createEstimate(svc, 'website', seed['config/settings'], { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_me' });
['header', 'footer', 'home', 'about', 'services', 'contact'].forEach((id) => est.items.push(E.copyItem(svc, svc.items.find((x) => x.id === id), est)));
est.items[4].complexity = 'complex';
est.scope.values.tablet = true;
est.hourlyRate = 100;
est.currency = 'USD';
est.status = 'draft';
const res = E.compute(est);
est.totalHours = E.round(res.total, 1);
est.totalCost = res.totalCost;
est.updatedAt = Date.now();

const est2 = Object.assign(E.clone(est), { name: 'Fintech Mobile App', client: 'Apex Pay', status: 'won', serviceId: 'mobile-app', serviceName: 'Mobile application', currency: 'EUR', hourlyRate: 140, updatedAt: Date.now() - 3600000 });
const res2 = E.compute(est2);
est2.totalHours = E.round(res2.total, 1);
est2.totalCost = res2.totalCost;

const SEED = Object.assign({}, seed, { 'estimates/est-a': est, 'estimates/est-b': est2 });

const findings = [];
function logIssue(browserName, component, symptom, details) {
  findings.push({ browser: browserName, component, symptom, details });
  console.error(`[FAIL - ${browserName}] ${component}: ${symptom} (${details})`);
}

async function runBrowserTests(engineName, browserEngine) {
  console.log(`\n========================================`);
  console.log(`Running Canary Compatibility Tests on: ${engineName}`);
  console.log(`========================================`);

  let browser;
  try {
    browser = await browserEngine.launch();
  } catch (err) {
    logIssue(engineName, 'Browser Launch', 'Failed to launch browser engine', err.message);
    return;
  }

  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('pageerror', (e) => {
    errors.push(e.message);
    logIssue(engineName, 'Runtime JS', 'Unhandled page error', e.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!/favicon|failed to load resource/i.test(text)) {
        errors.push(text);
        logIssue(engineName, 'Console', 'Console error emitted', text);
      }
    }
  });

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js', 'docx.umd.js']) {
      if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    }
    try { if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' }); } catch (_) {}
    return route.abort();
  });

  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED })};\n${mock}`);
  await page.goto('https://app.test/');

  // 1. Dashboard & Navigation
  try {
    await page.locator('.est-row').first().waitFor({ timeout: 5000 });
    const rowCount = await page.locator('.est-row').count();
    assert(rowCount === 2, `Expected 2 estimates, got ${rowCount}`);
    const rowCost = await page.locator('.row-sub-cost').first().innerText();
    assert(rowCost && rowCost.length > 0, 'Dashboard row sub-cost missing');
    const footCost = await page.locator('.cost-foot').innerText();
    assert(footCost && footCost.length > 0, 'Dashboard footer pipeline total cost missing');
    console.log(`✓ [${engineName}] Dashboard loaded with ${rowCount} estimates. Pipeline total: "${footCost.trim()}"`);
  } catch (e) {
    logIssue(engineName, 'Dashboard', 'Failed loading dashboard rows', e.message);
  }

  // 2. Open an estimate and navigate to Review
  try {
    await page.locator('.est-row', { hasText: 'Acme corporate site' }).click();
    await page.locator('.total-big').waitFor({ timeout: 5000 });
    const totalHoursText = await page.locator('.total-big .num').innerText();
    assert(totalHoursText && totalHoursText !== '0', 'Total hours empty or zero');

    // Verify Financials Cost Badge
    const costBadge = await page.locator('.total-cost-badge').innerText();
    assert(costBadge && costBadge.includes('$'), 'Cost badge missing USD symbol: ' + costBadge);
    console.log(`✓ [${engineName}] Review view loaded: ${totalHoursText}h · Cost: "${costBadge.trim().replace(/\s+/g, ' ')}"`);
  } catch (e) {
    logIssue(engineName, 'Review View', 'Failed inspecting review & cost badge', e.message);
  }

  // 3. Test Currency & Billing Rate update in Review Step
  try {
    // Select EUR currency
    await page.locator('#est-currency').selectOption('EUR');
    await page.waitForTimeout(300);
    const updatedBadge = await page.locator('.total-cost-badge').innerText();
    assert(updatedBadge.includes('€'), 'Currency change to EUR did not update cost badge: ' + updatedBadge);
    console.log(`✓ [${engineName}] Currency change to EUR: "${updatedBadge.trim().replace(/\s+/g, ' ')}"`);

    // Select BDT currency
    await page.locator('#est-currency').selectOption('BDT');
    await page.waitForTimeout(300);
    const bdtBadge = await page.locator('.total-cost-badge').innerText();
    assert(bdtBadge.includes('৳'), 'Currency change to BDT did not update cost badge: ' + bdtBadge);
    console.log(`✓ [${engineName}] Currency change to BDT: "${bdtBadge.trim().replace(/\s+/g, ' ')}"`);

    // Switch back to USD
    await page.locator('#est-currency').selectOption('USD');
    await page.waitForTimeout(200);
  } catch (e) {
    logIssue(engineName, 'Commercials Step', 'Failed updating currency/rates', e.message);
  }

  // 4. Test Stepper Component interactions
  try {
    const rateInput = page.locator('#est-rate');
    const prevRate = await rateInput.inputValue();
    await page.locator('[data-stepper="est-rate"] button[aria-label^="Increase"]').click();
    await page.waitForTimeout(200);
    const nextRate = await rateInput.inputValue();
    assert(Number(nextRate) > Number(prevRate), `Stepper increment failed: ${prevRate} -> ${nextRate}`);
    console.log(`✓ [${engineName}] Stepper increment verified: ${prevRate} -> ${nextRate}`);
  } catch (e) {
    logIssue(engineName, 'Stepper Component', 'Stepper increment interaction failed', e.message);
  }

  // 5. Test Settings Panel
  try {
    await page.locator('.navtab', { hasText: 'Settings' }).click();
    await page.locator('#set-agency').waitFor({ timeout: 5000 });
    await page.locator('#set-currency').selectOption('GBP');
    await page.waitForTimeout(200);
    const setCurr = await page.locator('#set-currency').inputValue();
    assert(setCurr === 'GBP', 'Settings currency select failed: ' + setCurr);
    console.log(`✓ [${engineName}] Settings panel rendered with Financials settings`);
  } catch (e) {
    logIssue(engineName, 'Settings Panel', 'Settings view failed', e.message);
  }

  // 6. Test Build & Option Toggling
  try {
    await page.locator('.navtab', { hasText: 'Estimates' }).click();
    await page.locator('.est-row', { hasText: 'Acme corporate site' }).click();
    await page.locator('.step', { hasText: 'Build' }).click();
    await page.locator('.lib-row').first().waitFor({ timeout: 5000 });
    const libCount = await page.locator('.lib-row').count();
    assert(libCount > 0, 'No library rows shown in Build');

    // Check inspector cost badge on Build step
    const inspCost = await page.locator('.insp-cost-badge').innerText();
    assert(inspCost && inspCost.length > 0, 'Inspector cost badge missing in Build step');
    console.log(`✓ [${engineName}] Build step with inspector cost badge verified: "${inspCost.trim()}"`);
  } catch (e) {
    logIssue(engineName, 'Build Step', 'Build step or inspector failed', e.message);
  }

  await browser.close();
  console.log(`[${engineName}] Completed with ${errors.length} page errors.\n`);
}

(async () => {
  await runBrowserTests('Chromium', chromium);
  await runBrowserTests('WebKit (Safari)', webkit);

  console.log('\n========================================');
  console.log(`COMPATIBILITY SUMMARY: ${findings.length} issues found`);
  console.log('========================================');

  if (findings.length > 0) {
    console.log(JSON.stringify(findings, null, 2));
    process.exit(1);
  } else {
    console.log('ALL COMPATIBILITY CHECKS PASSED ON CHROMIUM & WEBKIT');
    process.exit(0);
  }
})();
