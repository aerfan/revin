// Engine test: a hand-calculated reference estimate, plus CSV/XLSX generation.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ExcelJS = require('exceljs');
const E = require('../src/engine.js');
const seed = require('../seed/seed.json');

const svc = seed['services/website'];
const settings = seed['config/settings'];
const est = E.createEstimate(svc, 'website', settings, { name: 'Acme corporate site', client: 'Acme Ltd', userId: 'u_test' });
const lib = (id) => svc.items.find((i) => i.id === id);
const add = (id, patch = {}) => { const it = Object.assign(E.copyItem(svc, lib(id), est), patch); est.items.push(it); return it; };

add('header'); add('footer'); add('home');
add('service-detail', { qty: 3, complexity: 'complex' });
add('contact', { priority: 'should' });
add('pricing', { priority: 'wont' });
add('blog-list', { phase: 'Phase 2' });
est.items.push(Object.assign(E.customItem('Interactive calculator', 8, 'core', 'Core pages', est), { note: 'Client wants a loan calculator, "monthly, yearly"' }));
Object.assign(est.scope.values, { mobile: true, tablet: true, languages: 2, rtl: true, 'design-system': true, illustrations: 4, handoff: true, qa: 1 });
est.scope.choice.theming = 'both';
est.customDeliverables.push({ key: 'c1', name: 'Brand workshop', qty: 1, hours: 8 });

const r = E.compute(est);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m}: got ${a}, expected ${b}`);
near(r.base, 87, 'base');
near(r.optionHours, 156.15, 'options');
near(r.designSubtotal, 251.15, 'design subtotal');
near(r.overhead, 66.7645, 'overhead');
near(r.subtotal, 317.9145, 'subtotal');
near(r.buffer, 31.79145, 'buffer');
near(r.total, 349.70595, 'total');
console.log('compute OK  total', E.fmtHours(r.total), '| base', r.base, '| options', r.optionHours);

// financials & multi-currency
assert.strictEqual(E.fmtMoney(1250, 'USD'), '$1,250');
assert.strictEqual(E.fmtMoney(1250, 'EUR'), '€1,250');
assert.strictEqual(E.fmtMoney(1250, 'GBP'), '£1,250');
assert.strictEqual(E.fmtMoney(1250, 'BDT'), '৳1,250');
assert.strictEqual(E.fmtMoney(-500, 'USD'), '−$500');
assert.strictEqual(r.hourlyRate, 100, 'default hourly rate');
assert.strictEqual(r.currency, 'USD', 'default currency');
assert.strictEqual(r.totalCost, Math.round(r.total * 100), 'total fee at default rate');
const estEUR = E.clone(est); estEUR.hourlyRate = 125; estEUR.currency = 'EUR';
const rEUR = E.compute(estEUR);
assert.strictEqual(rEUR.hourlyRate, 125);
assert.strictEqual(rEUR.currency, 'EUR');
assert.strictEqual(rEUR.totalCost, Math.round(rEUR.total * 125));
assert.strictEqual(E.fmtMoney(rEUR.totalCost, rEUR.currency), '€' + E.fmtNum(Math.round(rEUR.total * 125)));
console.log('financials OK rate', rEUR.hourlyRate, '| total fee', E.fmtMoney(rEUR.totalCost, rEUR.currency));

// option edge cases
const langGroup = est.snapshot.optionGroups.find((g) => g.id === 'localization');
const langOpt = langGroup.options.find((o) => o.id === 'languages');
assert.strictEqual(E.optionUnits(langGroup, langOpt, { values: { languages: 1 } }), 0, 'first language free');
assert.strictEqual(E.optionUnits(langGroup, langOpt, { values: { languages: 3 } }), 2, 'two extra languages');
assert.strictEqual(E.optionActive(langGroup, langOpt, { values: { languages: 1 } }), false);
const resp = est.snapshot.optionGroups.find((g) => g.id === 'responsive');
assert.strictEqual(E.optionValue(resp, resp.options[0], { values: { desktop: false } }), true, 'locked option stays on');

// scenarios are monotonic and the full scenario excludes only Won't
const sc = E.scenarios(est);
assert.ok(sc[0].total <= sc[1].total && sc[1].total <= sc[2].total, 'scenarios monotonic');
near(sc[2].total, r.total, 'must+should+could = total (no could items, wont excluded)');
assert.ok(sc[0].total < sc[1].total, 'should item adds hours');
console.log('scenarios OK', sc.map((s) => `${s.label}: ${E.fmtHours(s.total)}`).join(' | '));

// phases sum to total
const pb = E.phaseBreakdown(est, r);
near(pb.reduce((s, p) => s + p.total, 0), r.total, 'phases sum to total');
console.log('phases OK', pb.map((p) => `${p.phase}: ${E.fmtHours(p.total)}`).join(' | '));

// deliverables + register
const dl = E.deliverables(est, r);
assert.strictEqual(dl[0].text, '9 pages · 30 sections', 'deliverables counts include quantities');
assert.ok(dl.some((d) => d.group === 'Theming' && d.text === 'Light + Dark'));
assert.ok(dl.some((d) => d.group === 'Localization' && /Languages \(2\)/.test(d.text)));
const reg = E.registerFor(est, 'assumptions');
assert.ok(reg.auto.length >= 2, 'auto assumptions from item definitions');
assert.ok(E.registerFor(est, 'exclusions').auto.some((e) => /Header/.test(e.text)), 'header exclusion');
assert.deepStrictEqual(E.outOfScope(est).map((o) => o.name), ['Pricing']);
console.log('deliverables/register OK', dl.map((d) => d.group + ': ' + d.text).join(' | '));

// gap checker
const gaps = E.gapSuggestions(est, svc);
const ids = gaps.map((g) => g.id);
assert.ok(ids.includes('w-home-404') && ids.includes('w-contact-thanks') && ids.includes('w-blog-article'), 'gap rules fire: ' + ids);
assert.ok(!ids.includes('w-home-header'), 'satisfied rule hidden');
assert.ok(!ids.includes('w-lang-rtl'), 'RTL already on');
console.log('gaps OK', ids.join(', '));

// rates refresh
assert.strictEqual(E.ratesOutdated(est, svc, settings), false, 'fresh estimate not outdated');
const svc2 = JSON.parse(JSON.stringify(svc)); svc2.optionGroups[0].options[1].value = 50;
assert.strictEqual(E.ratesOutdated(est, svc2, settings), true, 'rate change detected');
const refreshed = E.refreshRates(est, svc2, settings);
assert.strictEqual(refreshed.scope.values.tablet, true, 'scope kept');
near(E.compute(refreshed).optionHours - r.optionHours, 87 * 0.10, 'refresh applies new mobile rate');
console.log('refresh OK');

// CSV
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
const csv = E.buildCsv(est);
fs.writeFileSync(path.join(outDir, 'estimate.csv'), csv);
const csvRows = csv.replace(/^﻿/, '').trim().split('\r\n');
assert.ok(csvRows[csvRows.length - 1].startsWith('Total,,Total hours'), 'csv total row');
assert.ok(csv.includes('"Client wants a loan calculator, ""monthly, yearly"""'), 'csv escaping');
console.log('csv OK rows', csvRows.length);

(async () => {
  const meta = { agency: 'Test Agency', preparedBy: 'Tester', date: '2026-10-17' };
  const buf = await E.buildXlsx(ExcelJS, est, meta);
  fs.writeFileSync(path.join(outDir, 'estimate.xlsx'), Buffer.from(buf));
  const buf2 = await E.buildXlsx(ExcelJS, est, Object.assign({ noCache: true }, meta));
  fs.writeFileSync(path.join(outDir, 'estimate-nocache.xlsx'), Buffer.from(buf2));
  // empty estimate must also export
  const empty = E.createEstimate(svc, 'website', settings, { name: 'Empty' });
  fs.writeFileSync(path.join(outDir, 'empty.xlsx'), Buffer.from(await E.buildXlsx(ExcelJS, empty, meta)));
  fs.writeFileSync(path.join(outDir, 'expected.json'), JSON.stringify({ total: r.total, base: r.base, designSubtotal: r.designSubtotal, subtotal: r.subtotal, phases: pb.map((p) => [p.phase, p.base, p.total]) }));
  console.log('xlsx written');
})().catch((e) => { console.error(e); process.exit(1); });
