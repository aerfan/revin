// Engine QA: seeded fuzzing, an independent oracle, invariants, corruption robustness, export checks.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ExcelJS = require('exceljs');
const E = require('../src/engine.js');
const seed = require('../seed/seed.json');

const OUT = path.join(__dirname, 'out', 'fuzz');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const N = Number(process.env.N || 400);
const findings = [];
let checks = 0;
function fail(cat, msg, ctx) { findings.push({ cat, msg, ctx }); }
function check(cond, cat, msg, ctx) { checks++; if (!cond) fail(cat, msg, ctx); }

// ---------- seeded PRNG ----------
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let rnd = mulberry32(20261017);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const half = (a, b) => ri(a * 2, b * 2) / 2;

const NAMES = [
  'Home', 'Checkout flow', 'Café menu', 'বিকাশ অ্যাপ', 'متجر إلكتروني', '日本語ページ', 'Emoji 🚀 launch',
  'Quote "test", with comma', 'Line\nbreak', '=HYPERLINK("http://evil","x")', '+SUM(1,1)', '-2+3', '@cmd', '\tTabbed',
  'Ctrl\u0001char\u0008s', '<img src=x onerror=alert(1)>', 'A'.repeat(300), '  padded  ', '', 'Ünïcödé Straße',
];
const services = Object.entries(seed).filter(([p]) => p.startsWith('services/')).map(([p, s]) => Object.assign({ id: p.split('/')[1] }, s));
const settings = seed['config/settings'];

function randomEstimate() {
  const svc = pick(services);
  const est = E.createEstimate(svc, svc.id, settings, { name: pick(NAMES), client: pick(NAMES), userId: 'u_x' });
  const phases = est.snapshot.phases;
  for (const li of svc.items) {
    if (!chance(0.45)) continue;
    const it = E.copyItem(svc, li, est);
    if (li.allowMultiple && chance(0.4)) it.qty = ri(1, 12);
    it.complexity = pick(['simple', 'standard', 'standard', 'complex']);
    it.priority = pick(['must', 'must', 'should', 'could', 'wont']);
    it.phase = pick(phases);
    if (chance(0.3)) it.hours = half(0, 12);
    it.subs = it.subs.filter(() => chance(0.85));
    it.subs.forEach((s) => { if (chance(0.2)) s.hours = half(0, 10); });
    if (chance(0.3) && svc.subItems.length) it.subs.push(E.copySub(pick(svc.subItems)));
    if (chance(0.15)) it.subs.push({ key: E.uid('s'), libId: null, name: pick(NAMES), hours: half(0, 8) });
    if (chance(0.2)) it.note = pick(NAMES);
    est.items.push(it);
  }
  const nCustom = chance(0.4) ? ri(1, 4) : 0;
  for (let i = 0; i < nCustom; i++) est.items.push(Object.assign(E.customItem(pick(NAMES) || 'Custom', half(0, 20), 'custom', 'Custom', est), { qty: ri(1, 3), complexity: pick(['simple', 'standard', 'complex']), priority: pick(['must', 'should', 'could', 'wont']), phase: pick(phases) }));
  for (const g of est.snapshot.optionGroups) {
    if (g.selection === 'single') { if (chance(0.7)) est.scope.choice[g.id] = pick(g.options).id; continue; }
    for (const o of g.options) {
      if (o.locked) continue;
      if (o.input === 'quantity') est.scope.values[o.id] = chance(0.5) ? ri(E.num(o.min), Math.min(E.num(o.max, 99), 12)) : E.num(o.default);
      else est.scope.values[o.id] = chance(0.5);
    }
  }
  const nCd = chance(0.4) ? ri(1, 3) : 0;
  for (let i = 0; i < nCd; i++) est.customDeliverables.push({ key: E.uid('c'), name: pick(NAMES), qty: ri(1, 5), hours: half(0, 16) });
  est.overhead.forEach((o) => { o.enabled = chance(0.8); if (chance(0.3)) o.value = o.rule === 'percent' ? ri(0, 40) : half(0, 20); });
  est.bufferPercent = pick([0, 5, 10, 12.5, 15, 20, 30]);
  if (chance(0.5)) est.register.risks.push({ id: 'r1', text: pick(NAMES) });
  if (chance(0.3)) est.hiddenAuto = E.autoRegister(est).assumptions.slice(0, 1).map((a) => a.id);
  return est;
}

// ---------- independent oracle (written from PRD §5, not from engine code) ----------
function oracle(est) {
  const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const mult = {}; (est.snapshot.complexity || []).forEach((c) => { mult[c.id] = n(c.multiplier, 1); });
  let base = 0, count = 0;
  for (const it of est.items) {
    if ((it.priority || 'must') === 'wont') continue;
    const unit = n(it.hours) + (it.subs || []).reduce((s, x) => s + n(x.hours), 0);
    const q = Math.max(0, n(it.qty, 1));
    const m = mult[it.complexity] === undefined ? 1 : mult[it.complexity];
    base += unit * q * m; count += q;
  }
  let opt = 0;
  for (const g of est.snapshot.optionGroups) {
    for (const o of g.options) {
      let units = 0;
      if (g.selection === 'single') {
        const ch = est.scope.choice && est.scope.choice[g.id];
        const valid = g.options.some((x) => x.id === ch);
        const chosen = valid ? ch : ((g.options.find((x) => x.default) || g.options[0]) || {}).id;
        units = chosen === o.id ? 1 : 0;
      } else if (o.input === 'quantity') {
        const raw = est.scope.values[o.id];
        const v = Math.max(n(o.min), raw === undefined || raw === null ? n(o.default) : n(raw));
        units = Math.max(0, v - n(o.free));
      } else if (o.locked) units = 1;
      else { const raw = est.scope.values[o.id]; units = (raw === undefined || raw === null ? !!o.default : !!raw) ? 1 : 0; }
      if (!units) continue;
      if (o.rule === 'percent') opt += base * n(o.value) / 100 * units;
      else if (o.rule === 'fixed') opt += n(o.value) * units;
      else if (o.rule === 'perItem') opt += n(o.value) * count * units;
    }
  }
  const cd = est.customDeliverables.filter((c) => c.name).reduce((s, c) => s + Math.max(0, n(c.qty, 1)) * n(c.hours), 0);
  const design = base + opt + cd;
  const oh = est.overhead.filter((o) => o.enabled).reduce((s, o) => s + (o.rule === 'percent' ? design * n(o.value) / 100 : n(o.value)), 0);
  const sub = design + oh;
  return { base, design, sub, total: sub * (1 + n(est.bufferPercent) / 100) };
}
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

// ---------- RFC 4180 CSV parser ----------
function parseCsv(text) {
  const rows = []; let row = [], field = '', i = 0, q = false;
  while (i < text.length) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; } field += c; i++; continue; }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 2; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

(async () => {
  const xlsxFiles = [];
  for (let k = 0; k < N; k++) {
    const est = randomEstimate();
    const tag = `#${k} ${est.serviceId}`;
    let r;
    try { r = E.compute(est); } catch (e) { fail('crash', 'compute threw: ' + e.message, tag); continue; }
    const o = oracle(est);
    check(close(r.total, o.total) && close(r.base, o.base) && close(r.designSubtotal, o.design), 'calc', `engine disagrees with oracle (engine ${r.total}, oracle ${o.total})`, tag);
    check(Number.isFinite(r.total) && r.total >= 0, 'calc', 'total not finite/non-negative', tag);
    check(close(r.total, r.subtotal + r.buffer) && close(r.subtotal, r.designSubtotal + r.overhead) && close(r.designSubtotal, r.base + r.optionHours + r.customHours), 'calc', 'subtotals do not add up', tag);
    const sc = E.scenarios(est);
    check(sc[0].total <= sc[1].total + 1e-9 && sc[1].total <= sc[2].total + 1e-9, 'calc', 'scenarios not monotonic', tag);
    check(close(sc[2].total, r.total), 'calc', 'Must+Should+Could should equal total', tag);
    const pb = E.phaseBreakdown(est, r);
    check(close(pb.reduce((s, p) => s + p.total, 0), r.total) && pb.every((p) => p.total >= -1e-9), 'calc', 'phases do not sum to total', tag);
    // monotonicity under perturbation
    const bigger = E.clone(est); bigger.bufferPercent = E.num(bigger.bufferPercent) + 5;
    check(E.compute(bigger).total >= r.total - 1e-9, 'calc', 'raising buffer lowered total', tag);
    const more = E.clone(est); more.items.push(E.customItem('Extra', 3, 'custom', 'Custom', more));
    check(E.compute(more).total >= r.total - 1e-9, 'calc', 'adding an item lowered total', tag);
    // deliverables / register / gaps
    try {
      const svc = services.find((s) => s.id === est.serviceId);
      E.deliverables(est, r); E.registerFor(est, 'assumptions'); E.outOfScope(est); E.gapSuggestions(est, svc);
    } catch (e) { fail('crash', 'helper threw: ' + e.message, tag); }
    // CSV
    let csv;
    try { csv = E.buildCsv(est); } catch (e) { fail('crash', 'buildCsv threw: ' + e.message, tag); continue; }
    check(csv.charCodeAt(0) === 0xFEFF, 'csv', 'missing UTF-8 BOM', tag);
    const rows = parseCsv(csv.slice(1)).filter((x) => x.length > 1 || x[0] !== '');
    check(rows.every((x) => x.length === 12), 'csv', 'row with wrong column count: ' + JSON.stringify(rows.find((x) => x.length !== 12)), tag);
    const last = rows[rows.length - 1];
    check(last[0] === 'Total' && Math.abs(parseFloat(last[8]) - E.round(r.total, 2)) < 0.006, 'csv', `CSV total ${last && last[8]} != ${E.round(r.total, 2)}`, tag);
    const injectable = rows.slice(1).flat().filter((v) => /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v));
    check(!injectable.length, 'security', 'CSV cell can run as a spreadsheet formula: ' + JSON.stringify(injectable[0]), tag);
    const names = est.items.filter((it) => it.priority !== 'wont').map((it) => (it.name + (it.custom ? ' (custom)' : '')).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));
    const csvItems = new Set(rows.filter((x) => x[0] === 'Design').map((x) => x[2]));
    check(names.every((nm) => csvItems.has(nm) || csvItems.has("'" + nm)), 'csv', 'item name did not round-trip through CSV', tag);
    // XLSX (every 8th sample)
    if (k % 8 === 0) {
      try {
        const buf = await E.buildXlsx(ExcelJS, est, { agency: pick(NAMES), preparedBy: pick(NAMES), date: '2026-10-17', noCache: k % 16 === 0 });
        const f = path.join(OUT, `est-${k}.xlsx`);
        fs.writeFileSync(f, Buffer.from(buf));
        xlsxFiles.push({ f, total: r.total, base: r.base, phases: pb.map((p) => [p.phase, p.total]), noCache: k % 16 === 0, tag });
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
        check(wb.worksheets.map((w) => w.name).join() === 'Summary,Breakdown,Assumptions', 'xlsx', 'unexpected sheets', tag);
      } catch (e) { fail('crash', 'buildXlsx threw: ' + e.message, tag); }
    }
  }

  // ---------- corruption robustness ----------
  const corrupt = [
    ['items is a string', (e) => { e.items = 'oops'; }],
    ['items contains null', (e) => { e.items.push(null); }],
    ['subs is null', (e) => { if (e.items[0]) e.items[0].subs = null; }],
    ['hours as text', (e) => { if (e.items[0]) e.items[0].hours = 'four'; }],
    ['qty negative', (e) => { if (e.items[0]) e.items[0].qty = -3; }],
    ['qty Infinity', (e) => { if (e.items[0]) e.items[0].qty = Infinity; }],
    ['unknown complexity', (e) => { if (e.items[0]) e.items[0].complexity = 'galactic'; }],
    ['scope missing', (e) => { delete e.scope; }],
    ['scope.values null', (e) => { e.scope.values = null; }],
    ['snapshot missing', (e) => { delete e.snapshot; }],
    ['optionGroups null', (e) => { e.snapshot.optionGroups = null; }],
    ['group options missing', (e) => { if (e.snapshot.optionGroups[0]) delete e.snapshot.optionGroups[0].options; }],
    ['overhead is object', (e) => { e.overhead = { a: 1 }; }],
    ['overhead entry null', (e) => { e.overhead.push(null); }],
    ['customDeliverables null', (e) => { e.customDeliverables = null; }],
    ['register missing', (e) => { delete e.register; }],
    ['register lists are strings', (e) => { e.register = { assumptions: 'x', exclusions: 5 }; }],
    ['bufferPercent text', (e) => { e.bufferPercent = 'ten'; }],
    ['phases empty', (e) => { e.snapshot.phases = []; }],
    ['phases null', (e) => { e.snapshot.phases = null; }],
    ['dismissedSuggestions string', (e) => { e.dismissedSuggestions = 'x'; }],
    ['hiddenAuto object', (e) => { e.hiddenAuto = {}; }],
    ['name is number', (e) => { e.name = 12345; e.client = null; }],
    ['item name missing', (e) => { if (e.items[0]) delete e.items[0].name; }],
    ['includes as array', (e) => { if (e.items[0]) e.items[0].includes = ['a', 'b']; }],
  ];
  const corruptResults = [];
  for (const [label, mutate] of corrupt) {
    rnd = mulberry32(label.length * 7919);
    let est;
    do { est = randomEstimate(); } while (!est.items.length);
    mutate(est);
    const svc = services.find((s) => s.id === est.serviceId);
    const steps = [
      ['compute', () => { const t = E.compute(est).total; if (!Number.isFinite(t)) throw new Error('total is ' + t); }],
      ['scenarios', () => E.scenarios(est)], ['phases', () => E.phaseBreakdown(est)], ['deliverables', () => E.deliverables(est)],
      ['register', () => E.registerFor(est, 'assumptions')], ['outOfScope', () => E.outOfScope(est)], ['gaps', () => E.gapSuggestions(est, svc)],
      ['csv', () => E.buildCsv(est)], ['xlsx', () => E.buildXlsx(ExcelJS, est, {})],
    ];
    const broke = [];
    for (const [nm, fn] of steps) { checks++; try { await fn(); } catch (e) { broke.push(nm + ': ' + e.message); } }
    corruptResults.push([label, broke]);
    if (broke.length) fail('robustness', `${label} → ${broke.join(' | ')}`);
  }

  // ---------- corrupted library / settings documents (CMS data edited by hand or by older versions) ----------
  const badSettings = [
    ['settings null', null], ['settings string', 'x'], ['overhead object', { overhead: { a: 1 } }], ['phases string', { phases: 'Phase 1' }],
    ['complexity string', { complexity: 'standard' }], ['register defaults wrong type', { defaultAssumptions: 'none', defaultExclusions: 5 }],
    ['buffer text', { bufferPercent: 'lots' }], ['overhead entries junk', { overhead: [null, 'x', { name: 'PM', rule: 'percent', value: '8' }] }],
  ];
  const badServices = [
    ['items null', (s) => { s.items = null; }], ['optionGroups object', (s) => { s.optionGroups = { a: 1 }; }],
    ['item entries junk', (s) => { s.items.push(null, 'x', 7); }], ['option entries null', (s) => { s.optionGroups[0].options.push(null); }],
    ['gapRules junk', (s) => { s.gapRules = [null, { id: 'g' }, { id: 'g2', trigger: null }]; }], ['labels string', (s) => { s.labels = 'x'; }],
    ['starterPacks junk', (s) => { s.starterPacks = [null, { id: 'p', items: 'header' }]; }],
  ];
  let libCombos = 0;
  for (const [label, st] of badSettings) for (const [sl, mut] of badServices) for (const base of services) {
    const svc = JSON.parse(JSON.stringify(base)); mut(svc);
    checks++; libCombos++;
    try {
      const est = E.createEstimate(svc, svc.id, st, { name: 'x' });
      if (Array.isArray(svc.items)) svc.items.filter((i) => i && typeof i === 'object').slice(0, 3).forEach((li) => est.items.push(E.copyItem(svc, li, est)));
      const tot = E.compute(est).total; if (!Number.isFinite(tot)) throw new Error('total ' + tot);
      E.ratesOutdated(est, svc, st); E.compute(E.refreshRates(est, svc, st)); E.buildCsv(est); E.gapSuggestions(est, svc);
    } catch (e) { fail('robustness', `settings "${label}" + service ${base.id} "${sl}" → ${e.message}`); }
  }

  // ---------- filenames ----------
  if (typeof E.fileBase === 'function') {
    for (const [nm, expectNotGeneric] of [['বিকাশ ওয়েবসাইট', true], ['متجر إلكتروني', true], ['Acme site', true], ['', false], ['???', false]]) {
      checks++;
      const fb = E.fileBase({ name: nm });
      if (expectNotGeneric && /^(item|estimate)-hours$/.test(fb)) fail('ux', `filename for "${nm}" lost the name: ${fb}`);
      if (/[\\/:*?"<>|]/.test(fb)) fail('ux', `filename has unsafe characters: ${fb}`);
    }
  } else {
    const slugged = E.slug('বিকাশ ওয়েবসাইট');
    checks++;
    if (slugged === 'item') fail('ux', 'Non-Latin estimate names export as "item-hours" because the slug drops every character');
  }

  // ---------- XML validity of every workbook (strict parser) ----------
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(xlsxFiles));
  const py = `
import json, zipfile, sys
import json, zipfile, sys
import xml.etree.ElementTree as ET
try:
    from openpyxl import load_workbook
    has_openpyxl = True
except ImportError:
    has_openpyxl = False
bad = []
for x in json.load(open(sys.argv[1])):
    try:
        z = zipfile.ZipFile(x['f'])
        for n in z.namelist():
            if n.endswith('.xml') or n.endswith('.rels'):
                ET.fromstring(z.read(n))
        if has_openpyxl:
            load_workbook(x['f'])
    except Exception as e:
        bad.append([x['tag'], type(e).__name__ + ': ' + str(e)[:160]])
print(json.dumps(bad))
`;
  const bad = JSON.parse(execFileSync('python3', ['-c', py, path.join(OUT, 'manifest.json')]).toString());
  checks += xlsxFiles.length;
  bad.forEach(([tag, err]) => fail('xlsx', 'workbook is not valid XML / does not open: ' + err, tag));

  // ---------- report ----------
  const byCat = {};
  findings.forEach((f) => { (byCat[f.cat] = byCat[f.cat] || []).push(f); });
  console.log(`Engine fuzz: ${N} random estimates, ${xlsxFiles.length} workbooks, ${corrupt.length} corrupted-estimate cases, ${libCombos} corrupted library/settings combinations, ${checks} checks`);
  for (const [cat, list] of Object.entries(byCat)) {
    const uniq = [...new Map(list.map((f) => [f.msg.replace(/\d+(\.\d+)?/g, '#').slice(0, 120), f])).values()];
    console.log(`\n[${cat}] ${list.length} failures, ${uniq.length} distinct`);
    uniq.slice(0, 12).forEach((f) => console.log('  -', f.msg.slice(0, 220), f.ctx ? `(${f.ctx})` : ''));
  }
  if (!findings.length) console.log('\nALL ENGINE FUZZ CHECKS PASSED');
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 1));
  process.exitCode = findings.length ? 1 : 0;
})();
