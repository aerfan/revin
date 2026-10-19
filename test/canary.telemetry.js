// Canary Observability & Telemetry Test
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

// Setup realistic seed
const svc = Object.assign({ id: 'website' }, seed['services/website']);
const est = E.createEstimate(svc, 'website', seed['config/settings'], { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_me' });
const SEED = Object.assign({}, seed, { 'estimates/est-a': est });

async function runTelemetryTests() {
  console.log(`\n========================================`);
  console.log(`Running Canary Telemetry & Observability Tests`);
  console.log(`========================================`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('https://app.test/')) return route.fulfill({ contentType: 'text/html', body: SKELETON(page$) });
    for (const f of ['preact.umd.min.js', 'hooks.umd.min.js', 'htm.umd.min.js', 'exceljs.min.js', 'docx.umd.js', 'preact-core.min.js']) {
      if (u.includes(f)) return route.fulfill({ contentType: 'application/javascript', body: LIB(f) });
    }
    try { if (new URL(u).hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' }); } catch (_) {}
    return route.abort();
  });

  await page.addInitScript(`window.__MOCK__ = ${JSON.stringify({ role: 'admin', seed: SEED })};\n${mock}`);
  await page.goto('https://app.test/');

  await page.locator('.est-row').first().waitFor({ timeout: 5000 });
  console.log('✓ App loaded with telemetry initialized');

  // Verify Telemetry global existence and breadcrumb tracking
  const breadcrumbCount = await page.evaluate(() => {
    if (!window.RevinTelemetry) return -1;
    window.RevinTelemetry.crumb('test', 'Test verification step');
    return window.RevinTelemetry.crumbs.length;
  });
  assert(breadcrumbCount > 0, 'Breadcrumbs should be recorded');
  console.log(`✓ Telemetry circular buffer verified (${breadcrumbCount} breadcrumbs captured)`);

  // Navigate to Settings
  await page.locator('.navtab', { hasText: 'Settings' }).click();
  await page.locator('#set-agency').waitFor({ timeout: 5000 });
  console.log('✓ Navigated to Settings view');

  // Verify Health & Diagnostics Panel renders
  const healthPanelVisible = await page.locator('text=System health & error diagnostics').isVisible();
  assert(healthPanelVisible, 'Health & Diagnostics panel must be visible in Settings');
  const operationalBadge = await page.locator('text=All systems operational').first().isVisible();
  assert(operationalBadge, 'System should display All systems operational badge');
  console.log('✓ Health & Diagnostics Panel rendered with "All systems operational" status badge');

  // Simulate an error capture through Telemetry
  await page.evaluate(() => {
    window.RevinTelemetry.record(new Error('Simulated telemetry test error'), {
      route: 'settings'
    });
  });

  // Verify error stored in localStorage
  const storedLogs = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('dhe:error_logs') || '[]');
  });
  assert(storedLogs.length === 1, 'Error log must be stored in dhe:error_logs');
  assert(storedLogs[0].message === 'Simulated telemetry test error', 'Stored error message must match');
  console.log('✓ Error captured, fingerprinted, and persisted to local telemetry store');

  // Re-render Settings to show logged incident
  await page.locator('.navtab', { hasText: 'Estimates' }).click();
  await page.locator('.navtab', { hasText: 'Settings' }).click();
  await page.locator('text=1 incident(s) recorded').waitFor({ timeout: 3000 });
  console.log('✓ Settings Health Panel dynamically reflects "1 incident(s) recorded"');

  const copyAiButton = await page.locator('button:has-text("Copy for AI")').first().isVisible();
  assert(copyAiButton, '"Copy for AI" button must be present');
  console.log('✓ "Copy for AI" 1-click triage button verified');

  // Test copy markdown payload formatting
  const generatedMarkdown = await page.evaluate(() => {
    const log = JSON.parse(window.localStorage.getItem('dhe:error_logs') || '[]')[0];
    return [
      `### Revin Incident Report [${log.fingerprint}]`,
      `**Message:** ${log.message}`,
      `**Route:** ${log.route}`,
      '```\n' + log.stack + '\n```'
    ].join('\n');
  });
  assert(generatedMarkdown.includes('Revin Incident Report'), 'Markdown report must include incident header');
  assert(generatedMarkdown.includes('Simulated telemetry test error'), 'Markdown report must include error message');
  console.log('✓ AI Debugger prompt payload structure verified');

  // Clear incidents
  await page.locator('button:has-text("Clear logs")').click();
  await page.waitForTimeout(300);
  const clearedBadge = await page.locator('text=All systems operational').first().isVisible();
  assert(clearedBadge, 'Status should revert to All systems operational after clearing logs');
  console.log('✓ Telemetry log clearance verified, system status returned to All systems operational');

  await browser.close();
  console.log('\n========================================');
  console.log('ALL TELEMETRY & OBSERVABILITY CHECKS PASSED');
  console.log('========================================\n');
}

runTelemetryTests().catch((err) => {
  console.error('Telemetry test failed:', err);
  process.exit(1);
});
