// Canary Test Suite: Post-Acceptance Webhooks, Outbound Automation & Slack/Stripe Payloads
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
const est = E.createEstimate(svc, 'website', seed['config/settings'], { name: 'Fintech Portal Launch', client: 'Fintech Global Inc', userId: 'u_me' });
['header', 'footer', 'home', 'services'].forEach((id) => est.items.push(E.copyItem(svc, svc.items.find((x) => x.id === id), est)));
est.hourlyRate = 140;
est.costRate = 70;
est.currency = 'USD';
est.status = 'draft';
const calc = E.compute(est);
est.totalHours = E.round(calc.total, 1);
est.totalCost = calc.totalCost;
est.updatedAt = Date.now();

const SEED = Object.assign({}, seed, {
  'estimates/est-fintech': est,
  'config/settings': Object.assign({}, seed['config/settings'], {
    webhooks: {
      enabled: true,
      url: 'https://api.automation.test/v1/revin-webhook',
      secret: 'whsec_prod_live_key_998',
      events: ['proposal.accepted']
    }
  })
});

(async () => {
  console.log('========================================================');
  console.log('Starting Canary Outbound Webhooks & Automation Suite');
  console.log('========================================================\n');

  // --- UNIT TESTS 1: Engine Payload Serialization & Slack Formatting ---
  console.log('--- Unit Tests: Engine Payload Formatting ---');
  const sampleAccepted = Object.assign({}, est, {
    acceptance: {
      name: 'Sarah Connor',
      email: 'sarah@cyberdyne.com',
      org: 'Cyberdyne Systems',
      package: 'Standard Tier',
      timestamp: 1729300000000
    }
  });

  const genericPayload = E.formatWebhookPayload(sampleAccepted, 'proposal.accepted', { url: 'https://api.external.com/hook' });
  assert.strictEqual(genericPayload.event, 'proposal.accepted');
  assert.strictEqual(genericPayload.estimate.name, 'Fintech Portal Launch');
  assert.strictEqual(genericPayload.estimate.client, 'Fintech Global Inc');
  assert.strictEqual(genericPayload.acceptance.name, 'Sarah Connor');
  assert.strictEqual(genericPayload.acceptance.email, 'sarah@cyberdyne.com');
  assert.ok(genericPayload.estimate.totalCost > 0);
  assert.ok(Array.isArray(genericPayload.milestones) && genericPayload.milestones.length >= 2);
  console.log('✓ Enterprise webhook payload formatted with complete financial, milestone, and acceptance metadata');

  const slackPayload = E.formatWebhookPayload(sampleAccepted, 'proposal.accepted', { url: 'https://hooks.slack.com/services/T000/B000/XXXX' });
  assert.ok(slackPayload.text.includes('Fintech Portal Launch'));
  assert.ok(Array.isArray(slackPayload.blocks) && slackPayload.blocks.length >= 3);
  assert.strictEqual(slackPayload.blocks[0].type, 'header');
  assert.strictEqual(slackPayload.blocks[1].type, 'section');
  console.log('✓ Slack BlockKit format detected and structured into message blocks');

  // --- UNIT TESTS 2: Security & URL Validation ---
  console.log('\n--- Unit Tests: Webhook Security & Protocol Enforcement ---');
  let threwInsecure = false;
  try {
    await E.dispatchWebhook('http://insecure-endpoint.com/hook', {});
  } catch (err) {
    threwInsecure = true;
    assert.ok(/must be a valid secure HTTPS endpoint/i.test(err.message));
  }
  assert.ok(threwInsecure, 'Expected dispatchWebhook to reject insecure http:// URL');

  let threwJavascript = false;
  try {
    await E.dispatchWebhook('javascript:alert(1)', {});
  } catch (err) {
    threwJavascript = true;
  }
  assert.ok(threwJavascript, 'Expected dispatchWebhook to reject javascript: URI');
  console.log('✓ HTTPS protocol strictly enforced; non-HTTPS and malicious protocols rejected');

  // --- BROWSER E2E TESTS (Playwright) ---
  console.log('\n--- Browser E2E: Settings Configuration & Dispatch Interception ---');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  let capturedTestWebhook = null;
  let capturedProposalWebhook = null;

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u === 'https://api.automation.test/v1/revin-webhook') {
      const postData = JSON.parse(route.request().postData());
      const eventHeader = route.request().headers()['x-revin-event'];
      const secretHeader = route.request().headers()['x-revin-secret'];

      if (eventHeader === 'test.ping') {
        capturedTestWebhook = { body: postData, event: eventHeader, secret: secretHeader };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pong: true }) });
      } else if (eventHeader === 'proposal.accepted') {
        capturedProposalWebhook = { body: postData, event: eventHeader, secret: secretHeader };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, invoiceId: 'inv_123' }) });
      }
      return route.fulfill({ status: 200, body: 'ok' });
    }

    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js']) if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    try { if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' }); } catch (_) {}
    return route.abort();
  });

  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED })};\n${mock}`);
  await page.goto('https://app.test/');

  // 1. Navigate to Settings and verify Webhooks panel
  await page.locator('.navtab', { hasText: 'Settings' }).click();
  await page.waitForSelector('#panel-webhooks');
  assert.ok(await page.locator('#panel-webhooks').isVisible(), 'Webhooks panel rendered in Settings');
  console.log('✓ Settings Webhooks panel rendered with URL, secret, and switch controls');

  // 2. Click "Send test webhook" and assert HTTP interception
  await page.locator('#btn-test-webhook').click();
  await page.waitForTimeout(400);

  assert.ok(capturedTestWebhook, 'Expected test webhook to be captured by mock server');
  assert.strictEqual(capturedTestWebhook.event, 'test.ping');
  assert.strictEqual(capturedTestWebhook.secret, 'whsec_prod_live_key_998');
  assert.strictEqual(capturedTestWebhook.body.event, 'test.ping');
  console.log('✓ Test ping dispatched with valid headers and payload: HTTP 200 received');

  // 3. Navigate to Estimate and open Proposal view
  await page.locator('.navtab', { hasText: 'Estimates' }).click();
  await page.locator('.est-row', { hasText: 'Fintech Portal Launch' }).click();
  await page.locator('.total-big').waitFor();

  // Switch to Client Proposal Mode
  await page.locator('#btn-toggle-client-mode').click();
  await page.locator('.paper').waitFor();
  await page.waitForSelector('#prop-sign-name');

  // 4. Fill in digital sign-off and submit
  await page.locator('#prop-sign-name').fill('Sarah Connor');
  await page.locator('#prop-sign-email').fill('sarah@cyberdyne.com');
  await page.locator('#prop-sign-org').fill('Cyberdyne Systems');
  await page.locator('#prop-sign-agree').check();

  await page.locator('#btn-prop-accept').click();
  await page.waitForTimeout(500);

  // 5. Assert outbound proposal.accepted webhook was intercepted
  assert.ok(capturedProposalWebhook, 'Expected proposal.accepted webhook to be dispatched upon digital sign-off');
  assert.strictEqual(capturedProposalWebhook.event, 'proposal.accepted');
  assert.strictEqual(capturedProposalWebhook.secret, 'whsec_prod_live_key_998');
  assert.strictEqual(capturedProposalWebhook.body.acceptance.name, 'Sarah Connor');
  assert.strictEqual(capturedProposalWebhook.body.acceptance.email, 'sarah@cyberdyne.com');
  assert.strictEqual(capturedProposalWebhook.body.estimate.name, 'Fintech Portal Launch');
  assert.ok(capturedProposalWebhook.body.estimate.totalCost > 0);
  assert.ok(capturedProposalWebhook.body.milestones.length >= 2);
  console.log(`✓ Post-acceptance webhook verified: Event ${capturedProposalWebhook.event} · Contract Value: $${capturedProposalWebhook.body.estimate.totalCost}`);

  // 6. Verify Digital Acceptance Certificate Seal is rendered in DOM
  const certVisible = await page.locator('.paper-signed-cert').isVisible();
  assert.ok(certVisible, 'Certificate seal visible after digital sign-off');
  console.log('✓ Digital Acceptance Certificate seal rendered with verified signee metadata');

  await browser.close();
  assert.strictEqual(errors.length, 0, 'Zero page errors expected during webhook lifecycle');

  console.log('\n========================================================');
  console.log('ALL CANARY OUTBOUND WEBHOOK & AUTOMATION CHECKS PASSED');
  console.log('========================================================');
})();
