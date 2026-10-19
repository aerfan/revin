// Canary Test Suite: Interactive Client Proposal Portal, Presentation Mode & Digital Sign-off
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

// Setup realistic estimate with packages and tiered items
const svc = Object.assign({ id: 'website' }, seed['services/website']);
const est = E.createEstimate(svc, 'website', seed['config/settings'], { name: 'Apollo SaaS Redesign', client: 'Apollo Cloud Inc', userId: 'u_me' });
['header', 'footer', 'home', 'about', 'services', 'contact'].forEach((id) => est.items.push(E.copyItem(svc, svc.items.find((x) => x.id === id), est)));
est.packages = { enabled: true, names: ['Essential', 'Standard', 'Enterprise'] };
est.items[0].tier = 0; // Header -> Essential
est.items[1].tier = 0; // Footer -> Essential
est.items[2].tier = 0; // Home -> Essential
est.items[3].tier = 1; // About -> Standard
est.items[4].tier = 1; // Services -> Standard
est.items[5].tier = 2; // Contact -> Enterprise
est.hourlyRate = 125;
est.costRate = 60; // Internal cost rate that must be hidden from client
est.currency = 'USD';
est.status = 'draft';
const res = E.compute(est);
est.totalHours = E.round(res.total, 1);
est.totalCost = res.totalCost;
est.updatedAt = Date.now();

const SEED = Object.assign({}, seed, { 'estimates/est-apollo': est });

(async () => {
  console.log('========================================================');
  console.log('Starting Canary Interactive Client Proposal Portal Tests');
  console.log('========================================================\n');

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    try { if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' }); } catch (_) {}
    return route.abort();
  });

  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED })};\n${mock}`);
  await page.goto('https://app.test/');

  // 1. Open estimate and verify internal editor financials
  await page.locator('.est-row', { hasText: 'Apollo SaaS' }).click();
  await page.locator('.total-big').waitFor();
  console.log('✓ Estimate opened in editor review step');

  // Verify internal margin is visible in editor
  const reviewMarginBadge = await page.locator('.cost-margin').innerText();
  assert(reviewMarginBadge.includes('margin'), 'Internal margin badge should exist in internal editor');
  console.log(`✓ Internal estimator mode verified: ${reviewMarginBadge}`);

  // 2. Toggle to Client Mode using top bar button
  const toggleBtn = page.locator('#btn-toggle-client-mode');
  await toggleBtn.waitFor();
  await toggleBtn.click();
  await page.locator('.paper').waitFor();
  console.log('✓ Switched to Client Mode via 1-click toolbar button');

  // 3. Verify sensitive internals are strictly hidden in proposal
  const pageText = await page.locator('.paper').innerText();
  assert(!pageText.includes('margin'), 'Margin details MUST be hidden in client proposal');
  assert(!pageText.includes('Internal cost'), 'Cost rate MUST be hidden in client proposal');
  assert(!pageText.includes('Labor:'), 'Internal labor costs MUST be hidden in client proposal');
  console.log('✓ Verified: All internal cost rates, labor costs, and margins are strictly suppressed');

  // 4. Verify package tiers rendered and interactively selectable
  const tierCards = page.locator('.paper-pk > div');
  const tierCount = await tierCards.count();
  assert.strictEqual(tierCount, 3, 'Must render 3 package tier options');
  console.log(`✓ 3 interactive package tiers rendered (${await tierCards.first().locator('b').innerText()} / ${await tierCards.nth(1).locator('b').innerText()} / ${await tierCards.nth(2).locator('b').innerText()})`);

  // Click on Essential tier (index 0)
  await tierCards.first().click();
  await page.waitForTimeout(300);
  const activeTotal = await page.locator('.paper-table tr.tot td.n').innerText();
  console.log(`✓ Selected Essential tier. Recalculated total investment: ${activeTotal}`);

  // 5. Test Presentation Mode (full screen distraction-free)
  await page.getByRole('button', { name: 'Presentation mode' }).click();
  await page.locator('.prop-clean-bar').waitFor();
  assert(await page.locator('.proposal-layout.clean-mode').count() === 1, 'Clean mode layout should be active');
  console.log('✓ Client Presentation Mode (distraction-free full width) active');

  await page.getByRole('button', { name: 'Show options' }).click();
  await page.waitForTimeout(200);

  // 6. Digital Acceptance & Sign-off Flow
  await page.locator('#prop-sign-name').fill('Sarah Connor');
  await page.locator('#prop-sign-email').fill('sarah@apollocloud.com');
  await page.locator('#prop-sign-org').fill('Apollo Cloud Inc');

  const signBtn = page.locator('#btn-prop-accept');
  assert(await signBtn.isDisabled(), 'Accept button should be disabled before checking agreement checkbox');

  await page.locator('#prop-sign-agree').check();
  assert(!await signBtn.isDisabled(), 'Accept button should become enabled once agreement is checked');
  await signBtn.click();
  await page.waitForTimeout(500);

  // Verify certificate seal
  await page.locator('.paper-signed-cert').waitFor();
  const certText = await page.locator('.paper-signed-cert').innerText();
  assert(certText.includes('Digitally Accepted & Signed'), 'Acceptance certificate header must be displayed');
  assert(certText.includes('Sarah Connor'), 'Signee name must be recorded in certificate');
  assert(certText.includes('sarah@apollocloud.com'), 'Signee email must be recorded in certificate');
  console.log('✓ Digital Acceptance completed: Certificate seal rendered with verified signee metadata');

  // 7. Verify proposal revocation
  await page.locator('.paper-signed-cert button', { hasText: 'Revoke' }).click();
  await page.locator('.modal').waitFor();
  await page.locator('.modal button', { hasText: 'Revoke signature' }).click();
  await page.waitForTimeout(500);
  await page.locator('.paper-sign-card').waitFor();
  console.log('✓ Signature revocation verified: Estimate safely reopened for amendments');

  assert.strictEqual(errors.length, 0, 'No client-side runtime errors allowed');
  await context.close();
  await browser.close();

  console.log('\n========================================================');
  console.log('ALL CANARY CLIENT PROPOSAL & PRESENTATION TESTS PASSED');
  console.log('========================================================');
})().catch((err) => {
  console.error('\nCANARY PROPOSAL TEST FAILED:', err);
  process.exit(1);
});
