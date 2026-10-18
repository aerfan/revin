// F1 actuals: summary maths, timesheet matching, calibration feed, XLSX sheet.
const assert = require('assert');
const ExcelJS = require('exceljs');
const E = require('../src/engine.js');
const seed = require('../seed/seed.json');
const svc = seed['services/website'], settings = seed['config/settings'];
const lib = (id) => svc.items.find((i) => i.id === id);
function mk() {
  const est = E.createEstimate(svc, 'website', settings, { name: 'T', client: 'C', userId: 'u' });
  const add = (id, patch = {}) => { const it = Object.assign(E.copyItem(svc, lib(id), est), patch); est.items.push(it); return it; };
  return { est, add };
}
(async () => {
  const { est, add } = mk();
  const home = add('home'), contact = add('contact'), sd = add('service-detail', { qty: 3, complexity: 'complex' }), wont = add('pricing', { priority: 'wont' });
  const res = E.compute(est);
  const x = (k) => res.items.find((i) => i.item.key === k);
  assert.strictEqual(E.hasActuals(est), false);
  let s = E.actualsSummary(est);
  assert.strictEqual(s.count, 3, 'won\'t-have excluded'); assert.strictEqual(s.tracked, 0); assert.strictEqual(s.pct, null);

  est.actuals = { items: { [home.key]: x(home.key).total * 1.5, [contact.key]: 0, junk: -4, [wont.key + 'x']: 'abc' } };
  s = E.actualsSummary(est);
  assert.strictEqual(s.tracked, 2); assert.strictEqual(s.complete, false); assert.strictEqual(s.pct, null);
  assert.ok(Math.abs(s.itemsActual - x(home.key).total * 1.5) < 1e-9);
  const hr = s.rows.find((r) => r.key === home.key); assert.ok(Math.abs(hr.pct - 50) < 1e-9, 'home +50%');
  assert.strictEqual(s.rows.find((r) => r.key === contact.key).pct, -100);

  est.actuals.items[sd.key] = 60; est.actuals.other = 10;
  s = E.actualsSummary(est);
  assert.ok(s.complete); assert.ok(Math.abs(s.actual - (x(home.key).total * 1.5 + 60 + 10)) < 1e-9);
  assert.ok(Math.abs(s.pct - (s.actual - res.total) / res.total * 100) < 1e-9);

  // calibration feed: normalised to qty 1 and standard complexity, matched by libId
  const tr = E.trackedRows([est, { serviceId: 'mobile-app', actuals: { items: { a: 1 } } }, null], 'website');
  assert.strictEqual(tr.projects, 1);
  const sdRow = tr.rows.find((r) => r.libId === 'service-detail');
  assert.ok(Math.abs(sdRow.hours - 60 / (3 * x(sd.key).mult)) < 1e-9, 'scaled by qty × mult');
  const renamed = JSON.parse(JSON.stringify(est)); renamed.items.find((i) => i.key === home.key).name = 'Landing (renamed)';
  const c = E.calibrate(svc, E.trackedRows([renamed], 'website').rows);
  assert.ok(c.items.find((i) => i.id === 'home'), 'libId match survives renames');
  assert.strictEqual(c.items.find((i) => i.id === 'contact'), undefined, '0h actuals are not used as samples') ;
})().catch((e) => { throw e; });
(async () => {
  const { est, add } = mk();
  const home = add('home'), contact = add('contact'); add('footer');
  const sheet = 'Task,Hours,Person\nHome,9,A\nhome,6.5,B\nContact page,3\nClient call,1.5\nWeekly sync,2\nBad,abc\n,4\n';
  const m = E.matchActuals(est, E.parseCsv(sheet));
  assert.strictEqual(m.items[home.key], 15.5, 'rows summed, case-insensitive');
  assert.strictEqual(m.items[contact.key], 3, 'word containment');
  assert.deepStrictEqual(m.unmatched, ['Client call', 'Weekly sync']); assert.strictEqual(m.unmatchedHours, 3.5);
  assert.strictEqual(E.matchActuals(est, []).matched, 0);
  assert.strictEqual(E.matchActuals(est, E.parseCsv('Home;4\nContact;2')).matched, 2, 'headerless, semicolons');
  // XLSX gets an Actuals sheet only when tracked
  const wb0 = new ExcelJS.Workbook(); await wb0.xlsx.load(await E.buildXlsx(ExcelJS, est, {}));
  assert.ok(!wb0.getWorksheet('Actuals'));
  est.actuals = { items: m.items, other: 12, note: '=HYPERLINK("x") note' };
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await E.buildXlsx(ExcelJS, est, {}));
  const ws = wb.getWorksheet('Actuals'); assert.ok(ws, 'Actuals sheet');
  const vals = []; ws.eachRow((r) => vals.push(r.values.slice(1)));
  assert.ok(vals.some((v) => v[1] === 'Total' && v[2] && v[2].formula), 'total formula');
  assert.ok(vals.some((v) => v[1] === 'Home' && v[3] === 15.5));
  console.log('engine.f1: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
