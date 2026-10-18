/* Design Hours Estimator: calculation + export engine (pure functions, no DOM). */
(function (root, factory) {
  var E = factory();
  if (typeof module === 'object' && module.exports) module.exports = E;
  else root.Engine = E;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRIORITIES = [
    { id: 'must', name: 'Must have', short: 'Must' },
    { id: 'should', name: 'Should have', short: 'Should' },
    { id: 'could', name: 'Could have', short: 'Could' },
    { id: 'wont', name: "Won't have", short: "Won't" },
  ];
  var STATUSES = [
    { id: 'draft', name: 'Draft' },
    { id: 'review', name: 'In review' },
    { id: 'sent', name: 'Sent' },
    { id: 'won', name: 'Won' },
    { id: 'lost', name: 'Lost' },
  ];
  var REGISTER_KINDS = [
    { id: 'assumptions', name: 'Assumptions', hint: 'What this estimate takes for granted' },
    { id: 'exclusions', name: 'Exclusions', hint: 'What is not included' },
    { id: 'dependencies', name: 'Dependencies', hint: 'What the work relies on from the client or others' },
    { id: 'risks', name: 'Risks', hint: 'What could change the effort' },
  ];
  var DEFAULT_LABELS = { category: 'Category', item: 'Item', items: 'Items', sub: 'Sub-item', subs: 'Sub-items' };

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function round(n, p) { var f = Math.pow(10, p === undefined ? 2 : p); return Math.round(num(n) * f) / f; }
  // Display format: thousands separators and up to two decimals, so 2.25 never shows as 2.3
  // and the numbers on screen add up the same way the exported spreadsheet does.
  var NF = null;
  function fmtNum(n) {
    var v = round(n, 2);
    if (!NF) { try { NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }); } catch (e) { NF = { format: function (x) { return String(x); } }; } }
    return NF.format(v);
  }
  // Plain form for editable fields (no separators, so it parses back exactly).
  function plainNum(n) { return String(round(n, 2)); }
  // Lower-case the first letter of a sentence fragment unless it starts an acronym or brand (SEO, UI kit, iOS, KYC).
  function lcFirst(t) { var w = String(t).split(/\s/)[0]; return /^[A-Z][a-z]*$/.test(w.replace(/[^A-Za-z]/g, '')) && (w.length > 1 || w === 'A') && !/^[A-Z][a-z]*[A-Z]/.test(w) ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
  function fmtHours(n) { return fmtNum(n) + 'h'; }
  var CURRENCIES = [
    { id: 'USD', symbol: '$', name: 'US Dollar ($)', pos: 'prefix' },
    { id: 'EUR', symbol: '€', name: 'Euro (€)', pos: 'prefix' },
    { id: 'GBP', symbol: '£', name: 'British Pound (£)', pos: 'prefix' },
    { id: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)', pos: 'prefix' },
    { id: 'AUD', symbol: 'A$', name: 'Australian Dollar (A$)', pos: 'prefix' },
    { id: 'BDT', symbol: '৳', name: 'Bangladeshi Taka (৳)', pos: 'prefix' },
    { id: 'SGD', symbol: 'S$', name: 'Singapore Dollar (S$)', pos: 'prefix' },
    { id: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)', pos: 'prefix' },
    { id: 'INR', symbol: '₹', name: 'Indian Rupee (₹)', pos: 'prefix' },
    { id: 'CHF', symbol: 'CHF ', name: 'Swiss Franc (CHF)', pos: 'prefix' },
  ];
  function currencyInfo(currId) {
    var c = CURRENCIES.filter(function (x) { return x.id === currId; })[0];
    return c || CURRENCIES[0];
  }
  function fmtMoney(amount, currId) {
    var c = currencyInfo(currId);
    var v = Math.round(num(amount));
    var neg = v < 0;
    var absStr = fmtNum(Math.abs(v));
    var sign = neg ? '−' : '';
    return c.pos === 'suffix' ? sign + absStr + ' ' + c.symbol : sign + c.symbol + absStr;
  }
  function uid(prefix) { return (prefix || 'k') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'item';
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lines(text) { return txt(text).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function labelsOf(est) { var l = (est && est.snapshot && est.snapshot.labels) || {}; var o = {}; for (var k in DEFAULT_LABELS) o[k] = (typeof l[k] === 'string' && l[k]) || DEFAULT_LABELS[k]; return o; }

  // ---------------------------------------------------------------- data hardening
  // Documents can be edited by other people, older versions or by hand. Every public function
  // normalises its input first, so wrong types or null rows never crash the app.
  var CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
  function arr(x) { return Array.isArray(x) ? x.filter(function (v) { return v && typeof v === 'object' && !Array.isArray(v); }) : []; }
  function strs(x) { return Array.isArray(x) ? x.filter(function (v) { return typeof v === 'string'; }) : []; }
  function obj(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
  function txt(x) { return x === undefined || x === null ? '' : Array.isArray(x) ? x.map(String).join('\n') : String(x); }
  function normItem(it) {
    return Object.assign({}, it, {
      name: txt(it.name), description: txt(it.description), includes: txt(it.includes), excludes: txt(it.excludes),
      note: txt(it.note), categoryName: txt(it.categoryName) || 'Custom',
      subs: arr(it.subs).map(function (s) { return Object.assign({}, s, { name: txt(s.name), description: txt(s.description), includes: txt(s.includes), excludes: txt(s.excludes) }); }),
    });
  }
  function normalize(est) {
    if (est && est.__norm) return est;
    est = obj(est);
    var snap = obj(est.snapshot), scope = obj(est.scope), reg = obj(est.register);
    var rate = num(est.hourlyRate, snap.hourlyRate !== undefined ? snap.hourlyRate : 100);
    var curr = txt(est.currency || snap.currency || 'USD');
    var e = Object.assign({}, est, {
      name: txt(est.name), client: txt(est.client), serviceName: txt(est.serviceName),
      hourlyRate: rate, currency: curr,
      snapshot: Object.assign({}, snap, {
        labels: obj(snap.labels),
        optionGroups: arr(snap.optionGroups).map(function (g) { return Object.assign({}, g, { name: txt(g.name), options: arr(g.options).map(function (o) { return Object.assign({}, o, { name: txt(o.name) }); }) }); }),
        complexity: arr(snap.complexity), phases: strs(snap.phases), gapRules: arr(snap.gapRules),
        hourlyRate: num(snap.hourlyRate, rate), currency: txt(snap.currency || curr),
      }),
      scope: { values: obj(scope.values), choice: obj(scope.choice) },
      items: arr(est.items).map(normItem),
      customDeliverables: arr(est.customDeliverables).map(function (c) { return Object.assign({}, c, { name: txt(c.name) }); }),
      overhead: arr(est.overhead).map(function (o) { return Object.assign({}, o, { name: txt(o.name) }); }),
      register: {}, hiddenAuto: strs(est.hiddenAuto), dismissedSuggestions: strs(est.dismissedSuggestions),
    });
    REGISTER_KINDS.forEach(function (k) { e.register[k.id] = arr(reg[k.id]).map(function (r) { return Object.assign({}, r, { text: txt(r.text) }); }); });
    Object.defineProperty(e, '__norm', { value: true, enumerable: false });
    return e;
  }
  // Settings are edited in the CMS; repair wrong types so new estimates are always well formed.
  function normalizeSettings(st) {
    st = obj(st);
    var cx = arr(st.complexity).filter(function (c) { return typeof c.id === 'string' && c.id; }).map(function (c) { return Object.assign({}, c, { name: txt(c.name) || c.id, multiplier: num(c.multiplier, 1) }); });
    var seenPh = {}, ph = strs(st.phases).map(function (p) { return p.trim(); }).filter(function (p) { var k = p.toLowerCase(); if (!p || seenPh[k]) return false; seenPh[k] = 1; return true; });
    return Object.assign({}, st, {
      agencyName: txt(st.agencyName), bufferPercent: num(st.bufferPercent, 10),
      hourlyRate: num(st.hourlyRate, 100), currency: txt(st.currency) || 'USD',
      complexity: cx.length ? cx : clone(DEFAULT_COMPLEXITY),
      overhead: arr(st.overhead).map(function (o) { return Object.assign({}, o, { id: txt(o.id) || uid('oh'), name: txt(o.name), rule: o.rule === 'percent' ? 'percent' : 'fixed', value: num(o.value), enabled: o.enabled !== false, description: txt(o.description) }); }),
      phases: ph.length ? ph : ['Phase 1'],
      defaultAssumptions: strs(st.defaultAssumptions), defaultExclusions: strs(st.defaultExclusions),
    });
  }
  function normalizeService(s) {
    s = obj(s);
    return Object.assign({}, s, {
      name: txt(s.name), description: txt(s.description), labels: obj(s.labels),
      categories: arr(s.categories).map(function (c) { return Object.assign({}, c, { name: txt(c.name) }); }),
      items: arr(s.items).map(function (i) { return Object.assign({}, i, { name: txt(i.name), defaultSubs: strs(i.defaultSubs), description: txt(i.description), includes: txt(i.includes), excludes: txt(i.excludes) }); }),
      subItems: arr(s.subItems).map(function (i) { return Object.assign({}, i, { name: txt(i.name), description: txt(i.description), includes: txt(i.includes), excludes: txt(i.excludes) }); }),
      optionGroups: arr(s.optionGroups).map(function (g) { return Object.assign({}, g, { name: txt(g.name), options: arr(g.options).map(function (o) { return Object.assign({}, o, { name: txt(o.name) }); }) }); }),
      starterPacks: arr(s.starterPacks).map(function (k) { return Object.assign({}, k, { name: txt(k.name), items: strs(k.items) }); }),
      gapRules: arr(s.gapRules).filter(function (r) { return r.trigger && r.suggest && typeof r.trigger === 'object' && typeof r.suggest === 'object'; }),
    });
  }
  function fileBase(est) {
    var s = txt(est && est.name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
    return (s || 'estimate') + '-hours';
  }

  // ---------------------------------------------------------------- options
  function chosenOption(group, scope) {
    var choice = scope && scope.choice && scope.choice[group.id];
    var opts = group.options || [];
    if (choice && opts.some(function (o) { return o.id === choice; })) return choice;
    var d = opts.filter(function (o) { return o.default; })[0] || opts[0];
    return d ? d.id : null;
  }
  function optionValue(group, option, scope) {
    if (group.selection === 'single') return chosenOption(group, scope) === option.id;
    if (option.locked && option.input !== 'quantity') return true;
    var values = (scope && scope.values) || {};
    var v = values[option.id];
    if (option.input === 'quantity') {
      var q = v === undefined || v === null ? num(option.default, 0) : num(v, 0);
      return Math.max(num(option.min, 0), q);
    }
    return v === undefined || v === null ? !!option.default : !!v;
  }
  function optionUnits(group, option, scope) {
    var v = optionValue(group, option, scope);
    if (group.selection !== 'single' && option.input === 'quantity') return Math.max(0, num(v) - num(option.free, 0));
    return v ? 1 : 0;
  }
  function optionActive(group, option, scope) {
    var v = optionValue(group, option, scope);
    if (group.selection !== 'single' && option.input === 'quantity') return num(v) > num(option.free, 0);
    return !!v;
  }
  function defaultScope(groups) {
    var scope = { values: {}, choice: {} };
    (groups || []).forEach(function (g) {
      if (g.selection === 'single') { var c = chosenOption(g, null); if (c) scope.choice[g.id] = c; return; }
      (g.options || []).forEach(function (o) { scope.values[o.id] = optionValue(g, o, null); });
    });
    return scope;
  }
  function ruleHint(option, labels, isSingle) {
    var v = num(option.value);
    var qty = !isSingle && option.input === 'quantity';
    var hint = '';
    if (option.rule === 'percent') hint = '+' + fmtNum(v) + '% of base design' + (qty ? ' each' : '');
    else if (option.rule === 'fixed') hint = fmtHours(v) + (qty ? ' each' : '');
    else if (option.rule === 'perItem') hint = fmtHours(v) + ' per ' + String((labels && labels.item) || 'item').toLowerCase() + (qty ? ', each' : '');
    if (qty && num(option.free) > 0) hint += (hint ? ' · ' : '') + 'first ' + fmtNum(option.free) + ' included';
    return hint;
  }

  // ---------------------------------------------------------------- items
  function complexityMap(est) {
    var m = {};
    ((est.snapshot && est.snapshot.complexity) || []).forEach(function (c) { m[c.id] = num(c.multiplier, 1); });
    return m;
  }
  function complexityName(est, id) {
    var c = ((est.snapshot && est.snapshot.complexity) || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : (id || 'Standard');
  }
  function itemUnitHours(it) {
    return num(it.hours) + (it.subs || []).reduce(function (s, x) { return s + num(x.hours); }, 0);
  }
  function itemMultiplier(it, cmap) { var m = cmap[it.complexity]; return m === undefined ? 1 : m; }
  function libItemHours(service, li) {
    var subs = (service && service.subItems) || [];
    return num(li.hours) + (li.defaultSubs || []).reduce(function (s, id) {
      var x = subs.filter(function (q) { return q.id === id; })[0]; return s + (x ? num(x.hours) : 0);
    }, 0);
  }
  function categoryName(service, id) {
    var c = ((service && service.categories) || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : 'Custom';
  }
  function copySub(sx) {
    return { key: uid('s'), libId: sx.id || null, name: sx.name, hours: num(sx.hours), description: sx.description || '', includes: sx.includes || '', excludes: sx.excludes || '' };
  }
  function copyItem(service, li, est) {
    var subs = (service.subItems || []);
    var phases = (est && est.snapshot && est.snapshot.phases) || [];
    return {
      key: uid('i'), libId: li.id, custom: false,
      categoryId: li.categoryId, categoryName: categoryName(service, li.categoryId),
      name: li.name, hours: num(li.hours), allowMultiple: !!li.allowMultiple,
      qty: 1, complexity: 'standard', priority: 'must', phase: phases[0] || 'Phase 1',
      subs: (li.defaultSubs || []).map(function (id) { return subs.filter(function (q) { return q.id === id; })[0]; }).filter(Boolean).map(copySub),
      description: li.description || '', includes: li.includes || '', excludes: li.excludes || '', note: '',
    };
  }
  function customItem(name, hours, categoryId, categoryNameStr, est) {
    var phases = (est && est.snapshot && est.snapshot.phases) || [];
    return {
      key: uid('i'), libId: null, custom: true, categoryId: categoryId || 'custom', categoryName: categoryNameStr || 'Custom',
      name: name, hours: num(hours), allowMultiple: true, qty: 1, complexity: 'standard', priority: 'must',
      phase: phases[0] || 'Phase 1', subs: [], description: '', includes: '', excludes: '', note: '',
    };
  }

  // ---------------------------------------------------------------- estimate creation
  function createEstimate(service, serviceId, settings, meta) {
    service = normalizeService(service); settings = normalizeSettings(settings);
    settings = settings || {};
    var groups = clone(service.optionGroups || []);
    var now = Date.now();
    var rate = num(settings.hourlyRate, 100);
    var curr = txt(settings.currency || 'USD');
    return {
      name: (meta && meta.name) || 'Untitled estimate',
      client: (meta && meta.client) || '',
      status: 'draft',
      serviceId: serviceId, serviceName: service.name,
      totalHours: 0,
      totalCost: 0,
      hourlyRate: rate,
      currency: curr,
      createdBy: (meta && meta.userId) || null, updatedBy: (meta && meta.userId) || null,
      createdAt: now, updatedAt: now,
      snapshot: {
        labels: clone(service.labels || DEFAULT_LABELS),
        optionGroups: groups,
        complexity: clone(settings.complexity || DEFAULT_COMPLEXITY),
        phases: clone(settings.phases && settings.phases.length ? settings.phases : ['Phase 1']),
        gapRules: clone(service.gapRules || []),
        hourlyRate: rate,
        currency: curr,
        takenAt: now,
      },
      scope: defaultScope(groups),
      items: [],
      customDeliverables: [],
      overhead: clone((settings.overhead || []).map(function (o) { return { id: o.id, name: o.name, rule: o.rule, value: num(o.value), enabled: o.enabled !== false, description: o.description || '' }; })),
      bufferPercent: num(settings.bufferPercent, 10),
      register: {
        assumptions: (settings.defaultAssumptions || []).map(function (t) { return { id: uid('a'), text: t }; }),
        exclusions: (settings.defaultExclusions || []).map(function (t) { return { id: uid('x'), text: t }; }),
        dependencies: [], risks: [],
      },
      hiddenAuto: [], dismissedSuggestions: [], step: 'scope',
    };
  }
  var DEFAULT_COMPLEXITY = [
    { id: 'simple', name: 'Simple', multiplier: 0.75 },
    { id: 'standard', name: 'Standard', multiplier: 1 },
    { id: 'complex', name: 'Complex', multiplier: 1.5 },
  ];

  // Compare an estimate's rate snapshot with the live library/settings.
  function ratesSignature(groups, complexity, phases, overhead) {
    return JSON.stringify({
      g: (groups || []).map(function (g) { return [g.id, g.name, g.selection, (g.options || []).map(function (o) { return [o.id, o.name, o.input, o.rule, num(o.value), !!o.locked, num(o.free), num(o.min), num(o.max), o.default]; })]; }),
      c: (complexity || []).map(function (c) { return [c.id, c.name, num(c.multiplier)]; }),
      p: phases || [],
      o: (overhead || []).map(function (o) { return [o.id, o.name, o.rule, num(o.value)]; }),
    });
  }
  function ratesOutdated(est, service, settings) {
    if (!service || !settings) return false;
    est = normalize(est); service = normalizeService(service); settings = normalizeSettings(settings);
    var a = ratesSignature(est.snapshot.optionGroups, est.snapshot.complexity, est.snapshot.phases, est.overhead);
    var b = ratesSignature(service.optionGroups, settings.complexity, settings.phases, settings.overhead);
    return a !== b;
  }
  function refreshRates(est, service, settings) {
    est = normalize(est); service = normalizeService(service); settings = normalizeSettings(settings);
    var n = clone(est);
    n.snapshot.optionGroups = clone(service.optionGroups || []);
    n.snapshot.complexity = clone(settings.complexity || DEFAULT_COMPLEXITY);
    n.snapshot.phases = clone(settings.phases && settings.phases.length ? settings.phases : ['Phase 1']);
    n.snapshot.gapRules = clone(service.gapRules || []);
    n.snapshot.labels = clone(service.labels || DEFAULT_LABELS);
    n.snapshot.takenAt = Date.now();
    // keep chosen scope values where options still exist, default the rest
    var fresh = defaultScope(n.snapshot.optionGroups);
    var vals = (est.scope && est.scope.values) || {}, choice = (est.scope && est.scope.choice) || {};
    n.snapshot.optionGroups.forEach(function (g) {
      if (g.selection === 'single') { if (choice[g.id] && g.options.some(function (o) { return o.id === choice[g.id]; })) fresh.choice[g.id] = choice[g.id]; }
      else g.options.forEach(function (o) { if (vals[o.id] !== undefined && !o.locked) fresh.values[o.id] = vals[o.id]; });
    });
    n.scope = fresh;
    var prev = {}; (est.overhead || []).forEach(function (o) { prev[o.id] = o; });
    n.overhead = (settings.overhead || []).map(function (o) {
      return { id: o.id, name: o.name, rule: o.rule, value: num(o.value), enabled: prev[o.id] ? prev[o.id].enabled : o.enabled !== false, description: o.description || '' };
    });
    var phases = n.snapshot.phases;
    n.items = n.items.map(function (it) { if (phases.indexOf(it.phase) < 0) it.phase = phases[0]; return it; });
    return n;
  }

  // ---------------------------------------------------------------- compute
  function compute(est, opts) {
    est = normalize(est);
    opts = opts || {};
    var include = opts.priorities ? opts.priorities : null;
    var cmap = complexityMap(est);
    var items = (est.items || []).map(function (it) {
      var pr = it.priority || 'must';
      var included = include ? include.indexOf(pr) >= 0 : pr !== 'wont';
      if (opts.maxTier !== undefined && tierOf(it) > opts.maxTier) included = false;
      var unit = itemUnitHours(it), mult = itemMultiplier(it, cmap), qty = Math.max(0, num(it.qty, 1));
      return { item: it, unit: unit, mult: mult, qty: qty, total: unit * qty * mult, included: included };
    });
    var inc = items.filter(function (x) { return x.included; });
    var base = inc.reduce(function (s, x) { return s + x.total; }, 0);
    var itemCount = inc.reduce(function (s, x) { return s + x.qty; }, 0);
    var optionLines = [];
    ((est.snapshot && est.snapshot.optionGroups) || []).forEach(function (g) {
      (g.options || []).forEach(function (o) {
        if (!optionActive(g, o, est.scope)) return;
        var units = optionUnits(g, o, est.scope);
        var rule = o.rule || 'none', value = num(o.value), hours = 0;
        if (rule === 'percent') hours = base * value / 100 * units;
        else if (rule === 'fixed') hours = value * units;
        else if (rule === 'perItem') hours = value * itemCount * units;
        optionLines.push({ groupId: g.id, groupName: g.name, optionId: o.id, name: o.name, rule: rule, value: value, units: units, quantity: optionValue(g, o, est.scope), isQuantity: g.selection !== 'single' && o.input === 'quantity', itemCount: itemCount, hours: hours });
      });
    });
    var customLines = (est.customDeliverables || []).filter(function (c) { return c && c.name; }).map(function (c) {
      var qty = Math.max(0, num(c.qty, 1)); return { key: c.key, name: c.name, qty: qty, unit: num(c.hours), hours: qty * num(c.hours) };
    });
    var optionHours = optionLines.reduce(function (s, x) { return s + x.hours; }, 0);
    var customHours = customLines.reduce(function (s, x) { return s + x.hours; }, 0);
    var designSubtotal = base + optionHours + customHours;
    var overheadLines = (est.overhead || []).filter(function (o) { return o.enabled; }).map(function (o) {
      var hours = o.rule === 'percent' ? designSubtotal * num(o.value) / 100 : num(o.value);
      return { id: o.id, name: o.name, rule: o.rule, value: num(o.value), hours: hours };
    });
    var overhead = overheadLines.reduce(function (s, x) { return s + x.hours; }, 0);
    var subtotal = designSubtotal + overhead;
    var bufferPercent = num(est.bufferPercent);
    var buffer = subtotal * bufferPercent / 100;
    var total = subtotal + buffer;
    var rate = num(est.hourlyRate, (est.snapshot && est.snapshot.hourlyRate) !== undefined ? est.snapshot.hourlyRate : 100);
    var curr = txt(est.currency || (est.snapshot && est.snapshot.currency) || 'USD');
    return {
      items: items, base: base, itemCount: itemCount,
      optionLines: optionLines, optionHours: optionHours,
      customLines: customLines, customHours: customHours,
      adaptations: optionHours + customHours,
      designSubtotal: designSubtotal, overheadLines: overheadLines, overhead: overhead,
      subtotal: subtotal, bufferPercent: bufferPercent, buffer: buffer, total: total,
      hourlyRate: rate, currency: curr,
      baseCost: Math.round(base * rate),
      designSubtotalCost: Math.round(designSubtotal * rate),
      overheadCost: Math.round(overhead * rate),
      subtotalCost: Math.round(subtotal * rate),
      bufferCost: Math.round(buffer * rate),
      totalCost: Math.round(total * rate),
    };
  }

  function scenarios(est) {
    est = normalize(est);
    var sets = [
      { id: 'must', label: 'Must only', priorities: ['must'] },
      { id: 'should', label: 'Must + Should', priorities: ['must', 'should'] },
      { id: 'could', label: 'Must + Should + Could', priorities: ['must', 'should', 'could'] },
    ];
    return sets.map(function (s) {
      var r = compute(est, { priorities: s.priorities });
      return { id: s.id, label: s.label, total: r.total, totalCost: r.totalCost, count: r.items.filter(function (x) { return x.included; }).length };
    });
  }

  function phaseBreakdown(est, res) {
    est = normalize(est);
    res = res || compute(est);
    var phases = ((est.snapshot && est.snapshot.phases) || []).slice();
    if (!phases.length) phases.push('Phase 1');
    res.items.forEach(function (x) { if (x.included && x.item.phase && phases.indexOf(x.item.phase) < 0) phases.push(x.item.phase); });
    var rows = phases.map(function (p, i) {
      var mine = res.items.filter(function (x) { return x.included && (x.item.phase || phases[0]) === p; });
      var b = mine.reduce(function (s, x) { return s + x.total; }, 0);
      return { phase: p, base: b, count: mine.length };
    });
    rows.forEach(function (r, i) {
      r.share = res.base > 0 ? r.base / res.base : (i === 0 ? 1 : 0);
      r.total = res.total * r.share;
      r.totalCost = Math.round(r.total * (res.hourlyRate || 100));
    });
    return rows;
  }

  function deliverables(est, res) {
    est = normalize(est);
    res = res || compute(est);
    var labels = labelsOf(est);
    var inc = res.items.filter(function (x) { return x.included; });
    var nItems = inc.reduce(function (s, x) { return s + x.qty; }, 0);
    var nSubs = inc.reduce(function (s, x) { return s + (x.item.subs || []).length * x.qty; }, 0);
    var out = [];
    var t = fmtNum(nItems) + ' ' + (nItems === 1 ? labels.item : labels.items).toLowerCase();
    if (nSubs) t += ' · ' + fmtNum(nSubs) + ' ' + (nSubs === 1 ? labels.sub : labels.subs).toLowerCase();
    out.push({ group: (est.serviceName || 'Design') + ' design', text: t });
    ((est.snapshot && est.snapshot.optionGroups) || []).forEach(function (g) {
      var parts = [];
      (g.options || []).forEach(function (o) {
        if (!optionActive(g, o, est.scope)) return;
        var v = optionValue(g, o, est.scope);
        parts.push(g.selection !== 'single' && o.input === 'quantity' ? o.name + ' (' + fmtNum(v) + ')' : o.name);
      });
      if (parts.length) out.push({ group: g.name, text: parts.join(' · ') });
    });
    var cd = (est.customDeliverables || []).filter(function (c) { return c && c.name; });
    if (cd.length) out.push({ group: 'Custom deliverables', text: cd.map(function (c) { return num(c.qty, 1) > 1 ? c.name + ' (' + fmtNum(c.qty) + ')' : c.name; }).join(' · ') });
    return out;
  }

  // Assumptions/exclusions generated from library item definitions (B1).
  function autoRegister(est) {
    est = normalize(est);
    var a = [], x = [], seen = {};
    function add(list, id, text) { if (!text || seen[text]) return; seen[text] = 1; list.push({ id: id, text: text, auto: true }); }
    (est.items || []).forEach(function (it) {
      if ((it.priority || 'must') === 'wont') return;
      var inc = lines(it.includes), exc = lines(it.excludes);
      if (inc.length) add(a, 'auto:inc:' + it.key, it.name + ' includes ' + lcFirst(inc.join('; ')));
      if (exc.length) add(x, 'auto:exc:' + it.key, it.name + ': ' + exc.join('; '));
      (it.subs || []).forEach(function (s) {
        var si = lines(s.includes), se = lines(s.excludes);
        if (si.length) add(a, 'auto:inc:' + it.key + ':' + s.key, it.name + ' › ' + s.name + ' includes ' + lcFirst(si.join('; ')));
        if (se.length) add(x, 'auto:exc:' + it.key + ':' + s.key, it.name + ' › ' + s.name + ': ' + se.join('; '));
      });
    });
    return { assumptions: a, exclusions: x };
  }
  function registerFor(est, kind, includeHidden) {
    est = normalize(est);
    var auto = autoRegister(est);
    var hidden = est.hiddenAuto || [];
    var manual = ((est.register && est.register[kind]) || []).filter(function (e) { return e && e.text; });
    var gen = (auto[kind] || []).filter(function (e) { return includeHidden || hidden.indexOf(e.id) < 0; });
    return { auto: gen, manual: manual, all: gen.concat(manual) };
  }
  function outOfScope(est) {
    est = normalize(est);
    var cmap = complexityMap(est);
    return (est.items || []).filter(function (it) { return it.priority === 'wont'; }).map(function (it) {
      return { name: it.name, category: it.categoryName, hours: itemUnitHours(it) * Math.max(0, num(it.qty, 1)) * itemMultiplier(it, cmap) };
    });
  }

  // ---------------------------------------------------------------- gap checker (A3)
  function gapSuggestions(est, service) {
    est = normalize(est); if (service) service = normalizeService(service);
    var rules = (service && service.gapRules) || (est.snapshot && est.snapshot.gapRules) || [];
    var groups = (est.snapshot && est.snapshot.optionGroups) || [];
    var chosen = {};
    (est.items || []).forEach(function (it) { if (it.libId) chosen[it.libId] = it; });
    var dismissed = est.dismissedSuggestions || [];
    function findOpt(gid, oid) {
      var g = groups.filter(function (q) { return q.id === gid; })[0];
      var o = g && (g.options || []).filter(function (q) { return q.id === oid; })[0];
      return g && o ? { g: g, o: o } : null;
    }
    function libName(id) {
      var li = ((service && service.items) || []).filter(function (q) { return q.id === id; })[0];
      return li ? li.name : (chosen[id] ? chosen[id].name : null);
    }
    var out = [];
    rules.forEach(function (r) {
      if (!r || !r.trigger || !r.suggest || dismissed.indexOf(r.id) >= 0) return;
      var on = false, trig = '';
      if (r.trigger.kind === 'item') { on = !!chosen[r.trigger.ref] && chosen[r.trigger.ref].priority !== 'wont'; trig = libName(r.trigger.ref) || ''; }
      else if (r.trigger.kind === 'option') { var f = findOpt(r.trigger.group, r.trigger.ref); on = !!f && optionActive(f.g, f.o, est.scope); trig = f ? f.o.name : ''; }
      if (!on) return;
      if (r.suggest.kind === 'item') {
        var li = ((service && service.items) || []).filter(function (q) { return q.id === r.suggest.ref; })[0];
        if (!li || chosen[li.id]) return;
        out.push({ id: r.id, kind: 'item', ref: li.id, label: li.name, trigger: trig, message: r.message || '' });
      } else if (r.suggest.kind === 'option') {
        var s = findOpt(r.suggest.group, r.suggest.ref);
        if (!s || optionActive(s.g, s.o, est.scope)) return;
        out.push({ id: r.id, kind: 'option', group: s.g.id, ref: s.o.id, label: s.o.name, trigger: trig, message: r.message || '' });
      }
    });
    return out;
  }

  // ---------------------------------------------------------------- C2 packages
  // Each item belongs to the cheapest package that includes it (0 Basic, 1 Standard, 2 Premium).
  // The estimate's total is always the full scope; packages are cumulative cuts of it.
  var TIER_NAMES = ['Basic', 'Standard', 'Premium'];
  function tierOf(it) { var t = Math.round(num(it && it.tier, 0)); return t < 0 ? 0 : t > 2 ? 2 : t; }
  function packagesOf(est) {
    var p = obj(est && est.packages), names = strs(p.names).slice(0, 3);
    for (var i = 0; i < 3; i++) names[i] = (names[i] && names[i].trim()) || TIER_NAMES[i];
    return { enabled: !!p.enabled, names: names };
  }
  function packageBreakdown(est) {
    est = normalize(est);
    var pk = packagesOf(est);
    return pk.names.map(function (name, t) {
      var r = compute(est, { maxTier: t });
      var inc = r.items.filter(function (x) { return x.included; });
      return { tier: t, name: name, total: r.total, totalCost: r.totalCost, base: r.base, baseCost: r.baseCost, count: inc.length,
        added: inc.filter(function (x) { return tierOf(x.item) === t; }).map(function (x) { return { key: x.item.key, name: x.item.name, hours: x.total, cost: Math.round(x.total * r.hourlyRate) }; }) };
    });
  }

  // ---------------------------------------------------------------- E1 versions: what changed between two saves
  function diffEstimates(before, after) {
    before = normalize(before); after = normalize(after);
    var rb = compute(before), ra = compute(after);
    var mb = {}; rb.items.forEach(function (x) { mb[x.item.key] = x; });
    var seen = {}, rows = [];
    function eff(x) { return x && x.included ? x.total : 0; }
    function cxName(e, id) { return complexityName(e, id); }
    ra.items.forEach(function (x) {
      var k = x.item.key, o = mb[k]; seen[k] = 1;
      if (!o) { if (eff(x)) rows.push({ status: 'added', name: x.item.name, before: 0, after: eff(x), delta: eff(x), notes: [] }); return; }
      var notes = [];
      if (o.qty !== x.qty) notes.push('qty ' + fmtNum(o.qty) + ' → ' + fmtNum(x.qty));
      if ((o.item.complexity || 'standard') !== (x.item.complexity || 'standard')) notes.push(cxName(before, o.item.complexity) + ' → ' + cxName(after, x.item.complexity));
      if ((o.item.priority || 'must') !== (x.item.priority || 'must')) notes.push('priority ' + (o.item.priority || 'must') + ' → ' + (x.item.priority || 'must'));
      if (round(o.unit, 4) !== round(x.unit, 4)) notes.push('hours ' + fmtHours(o.unit) + ' → ' + fmtHours(x.unit));
      var d = eff(x) - eff(o);
      if (Math.abs(d) > 0.0001 || notes.length) rows.push({ status: !eff(x) && eff(o) ? 'removed' : !eff(o) && eff(x) ? 'added' : 'changed', name: x.item.name, before: eff(o), after: eff(x), delta: d, notes: notes });
    });
    rb.items.forEach(function (x) { if (!seen[x.item.key] && eff(x)) rows.push({ status: 'removed', name: x.item.name, before: eff(x), after: 0, delta: -eff(x), notes: [] }); });
    var lines = [['Base design', 'base'], ['Adaptations & add-ons', 'adaptations'], ['Project overhead', 'overhead'], ['Buffer', 'buffer'], ['Total', 'total']].map(function (l) { return { label: l[0], before: rb[l[1]], after: ra[l[1]], delta: ra[l[1]] - rb[l[1]] }; });
    return { rows: rows, lines: lines, before: rb.total, after: ra.total, delta: ra.total - rb.total,
      counts: { added: rows.filter(function (x) { return x.status === 'added'; }).length, removed: rows.filter(function (x) { return x.status === 'removed'; }).length, changed: rows.filter(function (x) { return x.status === 'changed'; }).length } };
  }

  // ---------------------------------------------------------------- D2 traceability
  function requirementsOf(est) { return arr(est && est.requirements).filter(function (q) { return typeof q.id === 'string' && q.id; }).map(function (q) { return { id: q.id, text: txt(q.text), source: txt(q.source) }; }); }
  function traceMatrix(est) {
    est = normalize(est);
    var res = compute(est), reqs = requirementsOf(est);
    var byReq = {}; reqs.forEach(function (q) { byReq[q.id] = []; });
    var unlinked = [];
    res.items.forEach(function (x) {
      var ids = strs(x.item.reqs).filter(function (id) { return byReq[id]; });
      if (!ids.length) { unlinked.push(x); return; }
      ids.forEach(function (id) { byReq[id].push(x); });
    });
    return { rows: reqs.map(function (q) { return { req: q, items: byReq[q.id].map(function (x) { return { key: x.item.key, name: x.item.name, hours: x.included ? x.total : 0, included: x.included }; }) }; }),
      unlinked: unlinked.map(function (x) { return { key: x.item.key, name: x.item.name, hours: x.included ? x.total : 0 }; }) };
  }

  // ---------------------------------------------------------------- calibration from past projects
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, s = String(text || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }
  function normName(t) { return String(t || '').toLowerCase().replace(/\(custom\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  // Rows: either this tool's own CSV export, or any sheet with an item/page name column and an hours column.
  function pastRows(table) {
    if (!table.length) return { rows: [], format: 'empty' };
    var h = table[0].map(function (c) { return String(c).trim().toLowerCase(); });
    var out = [];
    if (h[0] === 'type' && h.indexOf('unit hours') >= 0) { // our export: total per item = sum of its design rows / qty
      var acc = {};
      table.slice(1).forEach(function (r) {
        if (r[0] !== 'Design') return;
        var name = r[2], qty = num(r[4], 1) || 1, hours = num(r[8]) / (num(r[7], 1) || 1);
        var k = name + '|' + qty; acc[k] = acc[k] || { name: name, qty: qty, hours: 0 }; acc[k].hours += hours;
      });
      Object.keys(acc).forEach(function (k) { out.push({ name: acc[k].name, hours: acc[k].hours / acc[k].qty }); });
      return { rows: out, format: 'estimator' };
    }
    var ni = h.findIndex(function (c) { return /item|page|feature|screen|name|task/.test(c); }), hi = h.findIndex(function (c) { return /actual|hour|hrs|time|effort/.test(c); }), qi = h.findIndex(function (c) { return /^qty$|quantity|count/.test(c); });
    var start = 1;
    if (ni < 0 || hi < 0) { ni = 0; hi = 1; start = isFinite(Number(table[0][1])) ? 0 : 1; }
    table.slice(start).forEach(function (r) { var hrs = Number(String(r[hi] || '').replace(/[^0-9.\-]/g, '')); var qty = qi >= 0 ? num(r[qi], 1) || 1 : 1; if (r[ni] && isFinite(hrs) && hrs > 0) out.push({ name: String(r[ni]).trim(), hours: hrs / qty }); });
    return { rows: out, format: 'generic' };
  }
  // ---------------------------------------------------------------- F1 actuals
  // est.actuals = { items: { [itemKey]: hours }, other: hours, note }. Hours actually spent, per included item.
  function actualsOf(est) {
    var a = obj(obj(est).actuals), items = {};
    Object.keys(obj(a.items)).forEach(function (k) { var v = Number(a.items[k]); if (isFinite(v) && v >= 0) items[k] = v; });
    var other = Number(a.other);
    return { items: items, other: isFinite(other) && other >= 0 ? other : null, note: txt(a.note) };
  }
  function hasActuals(est) { var a = actualsOf(est); return Object.keys(a.items).length > 0 || a.other !== null; }
  function actualsSummary(est, res) {
    est = normalize(est); res = res || compute(est);
    var a = actualsOf(est), rows = [], estI = 0, actI = 0, tracked = 0;
    res.items.forEach(function (x) {
      if (!x.included) return;
      var act = a.items[x.item.key];
      var has = act !== undefined;
      if (has) { tracked++; estI += x.total; actI += act; }
      rows.push({ key: x.item.key, name: x.item.name, category: x.item.categoryName || '', libId: x.item.libId || null, qty: x.qty, mult: x.mult, estimated: x.total, actual: has ? act : null, delta: has ? act - x.total : null, pct: has && x.total > 0 ? (act - x.total) / x.total * 100 : null });
    });
    var other = res.total - res.base; // everything that isn't an item: options, overhead, buffer
    var actualTotal = actI + (a.other || 0);
    var complete = tracked === rows.length && rows.length > 0 && a.other !== null;
    return {
      rows: rows, tracked: tracked, count: rows.length, complete: complete, note: a.note,
      itemsEstimated: estI, itemsActual: actI, itemsDelta: actI - estI, itemsPct: estI > 0 ? (actI - estI) / estI * 100 : null,
      otherEstimated: other, otherActual: a.other,
      estimated: res.total, actual: actualTotal, delta: actualTotal - res.total, pct: complete && res.total > 0 ? (actualTotal - res.total) / res.total * 100 : null,
    };
  }
  // Timesheet CSV → hours per included item (rows for the same item are summed).
  function matchActuals(est, table) {
    est = normalize(est);
    var res = compute(est), items = res.items.filter(function (x) { return x.included; }).map(function (x) { return x.item; });
    var out = {}, unmatched = [], other = 0;
    if (!table.length) return { items: out, unmatched: unmatched, matched: 0 };
    var h = table[0].map(function (c) { return String(c).trim().toLowerCase(); });
    var ni = h.findIndex(function (c) { return /item|page|feature|screen|name|task/.test(c); }), hi = h.findIndex(function (c) { return /actual|hour|hrs|time|effort/.test(c); }), start = 1;
    if (ni < 0 || hi < 0) { ni = 0; hi = 1; start = isFinite(Number(table[0][1])) ? 0 : 1; }
    table.slice(start).forEach(function (r) {
      var name = String(r[ni] || '').trim(), hrs = Number(String(r[hi] || '').replace(/[^0-9.\-]/g, ''));
      if (!name || !isFinite(hrs) || hrs <= 0) return;
      var n = normName(name);
      var it = items.filter(function (x) { return normName(x.name) === n; })[0] || items.filter(function (x) { var m = normName(x.name); return m && n && ((' ' + m + ' ').indexOf(' ' + n + ' ') >= 0 || (' ' + n + ' ').indexOf(' ' + m + ' ') >= 0); })[0];
      if (!it) { if (unmatched.indexOf(name) < 0) unmatched.push(name); other += hrs; return; }
      out[it.key] = round((out[it.key] || 0) + hrs, 2);
    });
    return { items: out, unmatched: unmatched, unmatchedHours: round(other, 2), matched: Object.keys(out).length };
  }
  // Rows for calibrate(): actual hours per library item at quantity 1 and Standard complexity.
  function trackedRows(estimates, serviceId) {
    var out = [], projects = 0;
    (estimates || []).forEach(function (e) {
      if (!e || (serviceId && e.serviceId !== serviceId) || !hasActuals(e)) return;
      var s = actualsSummary(e), used = false;
      s.rows.forEach(function (r) { if (r.actual === null || r.actual <= 0 || !r.libId) return; var k = (r.qty || 1) * (r.mult || 1); if (k <= 0) return; out.push({ name: r.name, libId: r.libId, hours: r.actual / k }); used = true; });
      if (used) projects++;
    });
    return { rows: out, projects: projects };
  }
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
  function calibrate(service, rows) {
    service = normalizeService(service);
    var items = service.items || [], idx = {};
    items.forEach(function (it) { idx[normName(it.name)] = it; });
    var found = {}, unmatched = [], byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    rows.forEach(function (r) {
      var n = normName(r.name), it = (r.libId && byId[r.libId]) || idx[n];
      if (!it && n) it = items.filter(function (x) { var m = normName(x.name); return m && ((' ' + m + ' ').indexOf(' ' + n + ' ') >= 0 || (' ' + n + ' ').indexOf(' ' + m + ' ') >= 0); })[0];
      if (!it) { unmatched.push(r.name); return; }
      (found[it.id] = found[it.id] || []).push(r.hours);
    });
    var out = items.filter(function (it) { return found[it.id]; }).map(function (it) {
      var subs = libItemHours(service, it) - num(it.hours), med = median(found[it.id]);
      return { id: it.id, name: it.name, current: libItemHours(service, it), samples: found[it.id].length, median: round(med, 2), min: Math.min.apply(null, found[it.id]), max: Math.max.apply(null, found[it.id]), subs: subs, suggestedBase: Math.max(0, Math.round((med - subs) * 2) / 2) };
    });
    var seenU = {}; unmatched = unmatched.filter(function (u) { if (seenU[u]) return false; seenU[u] = 1; return true; });
    return { items: out, unmatched: unmatched };
  }

  // ---------------------------------------------------------------- rows for export
  function designRows(est, res) {
    est = normalize(est);
    var rows = [];
    res.items.forEach(function (x) {
      if (!x.included) return;
      var it = x.item, pr = PRIORITIES.filter(function (p) { return p.id === (it.priority || 'must'); })[0];
      var common = { group: it.categoryName || 'Custom', item: it.name + (it.custom ? ' (custom)' : ''), qty: x.qty, mult: x.mult, complexity: complexityName(est, it.complexity), priority: pr ? pr.short : '', phase: it.phase || '', notes: it.note || '' };
      var subs = it.subs || [];
      if (!subs.length) { rows.push(Object.assign({ detail: '', unit: num(it.hours) }, common)); return; }
      if (num(it.hours) > 0) rows.push(Object.assign({ detail: 'Base hours', unit: num(it.hours) }, common));
      subs.forEach(function (s, i) { rows.push(Object.assign({}, common, { detail: s.name + (s.libId ? '' : ' (custom)'), unit: num(s.hours), notes: i === 0 ? common.notes : '' })); });
    });
    return rows;
  }
  function ruleLabel(rule) { return rule === 'percent' ? '% of base design' : rule === 'fixed' ? 'Fixed hours' : rule === 'perItem' ? 'Hours per item' : 'No extra hours'; }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(round(v, 2));
    var s = String(v).replace(CTRL, '');
    // A cell that starts with = + - @ (or a tab/CR) would run as a formula in Excel or Sheets.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function buildCsv(est) {
    est = normalize(est);
    var res = compute(est);
    var out = [['Type', 'Group', 'Item', 'Detail', 'Qty', 'Unit hours', 'Rate %', 'Multiplier', 'Hours', 'Priority', 'Phase', 'Notes']];
    designRows(est, res).forEach(function (r) {
      out.push(['Design', r.group, r.item, r.detail, r.qty, r.unit, '', r.mult, r.unit * r.qty * r.mult, r.priority, r.phase, r.notes]);
    });
    out.push(['Subtotal', '', 'Base design hours', '', '', '', '', '', res.base, '', '', '']);
    res.optionLines.forEach(function (o) {
      if (o.rule === 'none') return;
      if (o.rule === 'percent') out.push(['Scope option', o.groupName, o.name, o.isQuantity ? 'Quantity ' + fmtNum(o.quantity) : '', o.units, '', o.value, '', o.hours, '', '', '% of base design hours']);
      else if (o.rule === 'fixed') out.push(['Scope option', o.groupName, o.name, o.isQuantity ? 'Quantity ' + fmtNum(o.quantity) : '', o.units, o.value, '', '', o.hours, '', '', '']);
      else out.push(['Scope option', o.groupName, o.name, '', o.units, o.value, '', o.itemCount, o.hours, '', '', 'Hours per item × items']);
    });
    res.customLines.forEach(function (c) { out.push(['Custom deliverable', '', c.name, '', c.qty, c.unit, '', '', c.hours, '', '', '']); });
    out.push(['Subtotal', '', 'Design subtotal', '', '', '', '', '', res.designSubtotal, '', '', '']);
    res.overheadLines.forEach(function (o) {
      if (o.rule === 'percent') out.push(['Overhead', '', o.name, '', '', '', o.value, '', o.hours, '', '', '% of design subtotal']);
      else out.push(['Overhead', '', o.name, '', 1, o.value, '', '', o.hours, '', '', '']);
    });
    out.push(['Subtotal', '', 'Subtotal', '', '', '', '', '', res.subtotal, '', '', '']);
    out.push(['Buffer', '', 'Buffer', '', '', '', res.bufferPercent, '', res.buffer, '', '', '% of subtotal']);
    out.push(['Total', '', 'Total hours', '', '', '', '', '', res.total, '', '', '']);
    if (packagesOf(est).enabled) packageBreakdown(est).forEach(function (pk) { out.push(['Package', '', pk.name, pk.count + ' ' + (pk.count === 1 ? 'item' : 'items'), '', '', '', '', pk.total, '', '', 'Includes everything in the packages before it']); });
    return '﻿' + out.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  // ---------------------------------------------------------------- XLSX (ExcelJS)
  async function buildXlsx(ExcelJS, est, meta) {
    meta = meta || {};
    est = normalize(est);
    var res = compute(est);
    var wb = new ExcelJS.Workbook();
    wb.creator = meta.agency || 'Design Hours Estimator';
    wb.created = new Date();
    var INK = 'FF161A22', MUTED = 'FF677084', LINE = 'FFDFE3EA', BAND = 'FFF3F4F7', RED = 'FFE5336B', SOFT = 'FFFDE8EF';
    var font = 'Arial';
    // A formula cell; the cached result lets previewers show values before recalculation.
    function xs(v) { return typeof v === 'string' ? v.replace(CTRL, '') : v; }
    function F(formula, result) { return meta.noCache ? { formula: formula } : { formula: formula, result: round(result, 4) }; }
    var ss = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
    var bs = wb.addWorksheet('Breakdown', { views: [{ state: 'frozen', ySplit: 1 }] });
    var as = wb.addWorksheet('Assumptions', { views: [{ showGridLines: false }] });

    // ---- Breakdown
    bs.columns = [
      { header: 'Type', key: 'type', width: 18 }, { header: 'Group', key: 'group', width: 24 },
      { header: 'Item', key: 'item', width: 32 }, { header: 'Detail', key: 'detail', width: 30 },
      { header: 'Qty', key: 'qty', width: 7 }, { header: 'Unit hours', key: 'unit', width: 11 },
      { header: 'Rate', key: 'rate', width: 9 }, { header: 'Multiplier', key: 'mult', width: 11 },
      { header: 'Hours', key: 'hours', width: 11 }, { header: 'Priority', key: 'priority', width: 11 },
      { header: 'Phase', key: 'phase', width: 18 }, { header: 'Notes', key: 'notes', width: 44 },
    ];
    var head = bs.getRow(1);
    head.eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }; c.alignment = { vertical: 'middle' }; });
    head.height = 20;
    var r = 2;
    function put(values, f) {
      var row = bs.getRow(r);
      values.forEach(function (v, i) { if (v !== undefined && v !== null && v !== '') row.getCell(i + 1).value = xs(v); });
      if (f) row.getCell(9).value = F(f.formula, f.result);
      row.getCell(5).numFmt = '0.##;-0.##;0'; row.getCell(6).numFmt = '0.0#'; row.getCell(8).numFmt = '0.0#'; row.getCell(9).numFmt = '0.0';
      row.eachCell({ includeEmpty: false }, function (c) { if (!c.font || !c.font.bold) c.font = Object.assign({ name: font }, c.font || {}); });
      r++; return row;
    }
    function pct(cell, v) { cell.value = v / 100; cell.numFmt = (Math.round(v) === v) ? '0%' : '0.0%'; }
    function emphasize(row, strong) {
      for (var i = 1; i <= 12; i++) {
        var c = row.getCell(i);
        c.font = { name: font, bold: true, color: { argb: INK }, size: strong ? 12 : 10 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: strong ? SOFT : BAND } };
        c.border = { top: { style: 'thin', color: { argb: strong ? RED : LINE } } };
      }
    }
    var designStart = r;
    designRows(est, res).forEach(function (d) {
      put(['Design', d.group, d.item, d.detail, d.qty, d.unit, null, d.mult, null, d.priority, d.phase, d.notes],
        { formula: 'E' + r + '*F' + r + '*H' + r, result: d.qty * d.unit * d.mult });
    });
    var designEnd = r - 1;
    var baseRow = r;
    emphasize(put(['Subtotal', '', 'Base design hours'], { formula: designEnd >= designStart ? 'SUM(I' + designStart + ':I' + designEnd + ')' : '0', result: res.base }));
    var addStart = r;
    res.optionLines.forEach(function (o) {
      if (o.rule === 'none') return;
      var row;
      if (o.rule === 'percent') {
        row = put(['Scope option', o.groupName, o.name, o.isQuantity ? 'Quantity ' + fmtNum(o.quantity) : '', o.units, null, null, null, null, '', '', '% of base design hours'], { formula: '$I$' + baseRow + '*G' + r + '*E' + r, result: o.hours });
        pct(row.getCell(7), o.value);
      } else if (o.rule === 'fixed') {
        put(['Scope option', o.groupName, o.name, o.isQuantity ? 'Quantity ' + fmtNum(o.quantity) : '', o.units, o.value], { formula: 'E' + r + '*F' + r, result: o.hours });
      } else {
        put(['Scope option', o.groupName, o.name, '', o.units, o.value, null, o.itemCount, null, '', '', 'Hours per item × number of items'], { formula: 'E' + r + '*F' + r + '*H' + r, result: o.hours });
      }
    });
    res.customLines.forEach(function (c) { put(['Custom deliverable', '', c.name, '', c.qty, c.unit], { formula: 'E' + r + '*F' + r, result: c.hours }); });
    var addEnd = r - 1;
    var designSubRow = r;
    emphasize(put(['Subtotal', '', 'Design subtotal'], { formula: 'I' + baseRow + (addEnd >= addStart ? '+SUM(I' + addStart + ':I' + addEnd + ')' : ''), result: res.designSubtotal }));
    var ohStart = r;
    res.overheadLines.forEach(function (o) {
      if (o.rule === 'percent') { var row = put(['Overhead', '', o.name, '', null, null, null, null, null, '', '', '% of design subtotal'], { formula: '$I$' + designSubRow + '*G' + r, result: o.hours }); pct(row.getCell(7), o.value); }
      else put(['Overhead', '', o.name, '', 1, o.value], { formula: 'E' + r + '*F' + r, result: o.hours });
    });
    var ohEnd = r - 1;
    var subRow = r;
    emphasize(put(['Subtotal', '', 'Subtotal'], { formula: 'I' + designSubRow + (ohEnd >= ohStart ? '+SUM(I' + ohStart + ':I' + ohEnd + ')' : ''), result: res.subtotal }));
    var bufRow = r;
    var brow = put(['Buffer', '', 'Buffer', '', null, null, null, null, null, '', '', '% of subtotal'], { formula: '$I$' + subRow + '*G' + r, result: res.buffer });
    pct(brow.getCell(7), res.bufferPercent);
    var totRow = r;
    emphasize(put(['Total', '', 'Total hours'], { formula: 'I' + subRow + '+I' + bufRow, result: res.total }), true);
    bs.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, designEnd), column: 12 } };

    // ---- Summary
    ss.columns = [{ width: 34 }, { width: 20 }, { width: 14 }, { width: 16 }, { width: 40 }];
    var sr = 1;
    function srow(vals) { var row = ss.getRow(sr++); vals.forEach(function (v, i) { if (v !== undefined && v !== null) row.getCell(i + 1).value = xs(v); }); row.eachCell(function (c) { c.font = Object.assign({ name: font }, c.font || {}); }); return row; }
    function sectionTitle(t) { sr++; var row = srow([t]); row.getCell(1).font = { name: font, bold: true, size: 12, color: { argb: INK } }; row.getCell(1).border = { bottom: { style: 'thin', color: { argb: RED } } }; return row; }
    var t = srow([est.name || 'Untitled estimate']); t.getCell(1).font = { name: font, bold: true, size: 18, color: { argb: INK } }; t.height = 26;
    var st = srow([(meta.agency ? meta.agency + ' · ' : '') + 'Design hours estimate']); st.getCell(1).font = { name: font, color: { argb: MUTED } };
    sr++;
    var info = [['Client', est.client || '—'], ['Service', est.serviceName || ''], ['Status', (STATUSES.filter(function (s) { return s.id === est.status; })[0] || { name: 'Draft' }).name], ['Prepared by', meta.preparedBy || '—'], ['Date', meta.date || new Date().toISOString().slice(0, 10)]];
    info.forEach(function (p) { var row = srow(p); row.getCell(1).font = { name: font, color: { argb: MUTED } }; });
    sectionTitle('Totals');
    var totals = [
      ['Base design hours', 'Breakdown!I' + baseRow, res.base],
      ['Adaptations & add-ons', 'Breakdown!I' + designSubRow + '-Breakdown!I' + baseRow, res.adaptations],
      ['Design subtotal', 'Breakdown!I' + designSubRow, res.designSubtotal],
      ['Project overhead', 'Breakdown!I' + subRow + '-Breakdown!I' + designSubRow, res.overhead],
      ['Buffer (' + fmtNum(res.bufferPercent) + '%)', 'Breakdown!I' + bufRow, res.buffer],
      ['Total hours', 'Breakdown!I' + totRow, res.total],
    ];
    totals.forEach(function (p, i) {
      var row = srow([p[0]]); var c = row.getCell(2); c.value = F(p[1], p[2]); c.numFmt = '0.0 "h"';
      if (i === totals.length - 1) { row.getCell(1).font = { name: font, bold: true, size: 13 }; c.font = { name: font, bold: true, size: 13, color: { argb: RED } }; row.getCell(1).border = row.getCell(2).border = { top: { style: 'thin', color: { argb: INK } } }; }
    });
    sectionTitle('Scope scenarios');
    var sh = srow(['Scenario', 'Total hours', 'Items']); sh.eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: MUTED } }; });
    scenarios(est).forEach(function (s) { var row = srow([s.label, round(s.total, 1), s.count]); row.getCell(2).numFmt = '0.0 "h"'; });
    var note = srow(['Scenarios are calculated at export time from item priorities.']); note.getCell(1).font = { name: font, italic: true, color: { argb: MUTED }, size: 9 };
    if (packagesOf(est).enabled) {
      sectionTitle('Packages');
      var pkh = srow(['Package', 'Total hours', 'Items', 'Adds']); pkh.eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: MUTED } }; });
      packageBreakdown(est).forEach(function (pk) { var row = srow([pk.name, round(pk.total, 1), pk.count, pk.added.map(function (a) { return a.name; }).join(', ')]); row.getCell(2).numFmt = '0.0 "h"'; row.getCell(4).alignment = { wrapText: true, vertical: 'top' }; ss.mergeCells(row.number, 4, row.number, 5); });
    }
    sectionTitle('Hours by phase');
    var ph = srow(['Phase', 'Base design hours', 'Share', 'Total hours']); ph.eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: MUTED } }; });
    var pb = phaseBreakdown(est, res);
    pb.forEach(function (p) {
      var row = srow([p.phase]);
      var rr = row.number;
      if (designEnd >= designStart) {
        row.getCell(2).value = F('SUMIFS(Breakdown!$I$' + designStart + ':$I$' + designEnd + ',Breakdown!$K$' + designStart + ':$K$' + designEnd + ',A' + rr + ')', p.base);
        row.getCell(3).value = F('IF(Breakdown!$I$' + baseRow + '=0,0,B' + rr + '/Breakdown!$I$' + baseRow + ')', p.share);
        row.getCell(4).value = F('C' + rr + '*Breakdown!$I$' + totRow, p.total);
      } else { row.getCell(2).value = 0; row.getCell(3).value = p.share; row.getCell(4).value = round(p.total, 4); }
      row.getCell(2).numFmt = '0.0 "h"'; row.getCell(3).numFmt = '0%'; row.getCell(4).numFmt = '0.0 "h"';
    });
    sectionTitle('Deliverables');
    deliverables(est, res).forEach(function (d) { var row = srow([d.group, d.text]); row.getCell(1).font = { name: font, color: { argb: MUTED } }; ss.mergeCells(row.number, 2, row.number, 5); row.getCell(2).alignment = { wrapText: true, vertical: 'top' }; });

    // ---- Assumptions
    as.columns = [{ width: 26 }, { width: 44 }, { width: 18 }, { width: 22 }, { width: 14 }];
    var ar = 1;
    function arow(vals) { var row = as.getRow(ar++); vals.forEach(function (v, i) { if (v !== undefined && v !== null) row.getCell(i + 1).value = xs(v); }); row.eachCell(function (c) { c.font = Object.assign({ name: font }, c.font || {}); }); return row; }
    function atitle(tt) { if (ar > 1) ar++; var row = arow([tt]); row.getCell(1).font = { name: font, bold: true, size: 12, color: { argb: INK } }; row.getCell(1).border = { bottom: { style: 'thin', color: { argb: RED } } }; }
    atitle('Scope options');
    var oh = arow(['Group', 'Option', 'Selection', 'Rule', 'Rate / hours']); oh.eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: MUTED } }; });
    ((est.snapshot && est.snapshot.optionGroups) || []).forEach(function (g) {
      (g.options || []).forEach(function (o) {
        if (!optionActive(g, o, est.scope)) return;
        var v = optionValue(g, o, est.scope);
        var sel = g.selection !== 'single' && o.input === 'quantity' ? 'Quantity ' + fmtNum(v) : 'Selected';
        var rate = o.rule === 'percent' ? fmtNum(o.value) + '%' : o.rule === 'none' ? '—' : fmtHours(o.value);
        arow([g.name, o.name, sel, ruleLabel(o.rule), rate]);
      });
    });
    (est.customDeliverables || []).filter(function (c) { return c && c.name; }).forEach(function (c) { arow(['Custom deliverable', c.name, 'Quantity ' + fmtNum(num(c.qty, 1)), 'Fixed hours', fmtHours(c.hours)]); });
    arow(['Complexity', ((est.snapshot && est.snapshot.complexity) || []).map(function (c) { return c.name + ' ×' + fmtNum(c.multiplier); }).join(' · ')]);
    arow(['Buffer', fmtNum(res.bufferPercent) + '% of subtotal']);
    REGISTER_KINDS.forEach(function (k) {
      var list = registerFor(est, k.id).all;
      atitle(k.name);
      if (!list.length) { var e = arow(['None recorded']); e.getCell(1).font = { name: font, italic: true, color: { argb: MUTED } }; return; }
      list.forEach(function (e, i) { var row = arow([String(i + 1), e.text]); as.mergeCells(row.number, 2, row.number, 5); row.getCell(2).alignment = { wrapText: true, vertical: 'top' }; row.getCell(1).alignment = { horizontal: 'right', vertical: 'top' }; row.getCell(1).font = { name: font, color: { argb: MUTED } }; });
    });
    var oos = outOfScope(est);
    atitle("Out of scope (Won't have)");
    if (!oos.length) { var e2 = arow(['None']); e2.getCell(1).font = { name: font, italic: true, color: { argb: MUTED } }; }
    oos.forEach(function (o) { var row = arow([o.category, o.name, null, null, round(o.hours, 1)]); row.getCell(5).numFmt = '0.0 "h"'; });

    // ---- Traceability (only when requirements were recorded)
    var tm = traceMatrix(est);
    if (tm.rows.length) {
      var ts = wb.addWorksheet('Traceability', { views: [{ state: 'frozen', ySplit: 1 }] });
      ts.columns = [{ header: 'Req', width: 8 }, { header: 'Requirement', width: 60 }, { header: 'Covered by', width: 40 }, { header: 'Hours', width: 11 }];
      ts.getRow(1).eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }; });
      tm.rows.forEach(function (row) {
        var list = row.items.length ? row.items : [null];
        list.forEach(function (it, i) {
          var rr = ts.addRow([i ? '' : row.req.id, i ? '' : xs(row.req.text), it ? xs(it.name) + (it.included ? '' : " (won't have)") : 'Not covered', it ? round(it.hours, 1) : null]);
          rr.eachCell(function (c) { c.font = { name: font, color: it ? undefined : { argb: RED } }; c.alignment = { wrapText: true, vertical: 'top' }; });
          rr.getCell(4).numFmt = '0.0 "h"';
        });
      });
      if (tm.unlinked.length) { ts.addRow([]); var ul = ts.addRow(['', 'Items not linked to a requirement']); ul.getCell(2).font = { name: font, bold: true }; tm.unlinked.forEach(function (u) { var rr = ts.addRow(['', '', xs(u.name), round(u.hours, 1)]); rr.getCell(4).numFmt = '0.0 "h"'; rr.eachCell(function (c) { c.font = { name: font }; }); }); }
    }

    // ---- Actuals (only when hours were tracked)
    if (hasActuals(est)) {
      var ac = actualsSummary(est, res);
      var acs = wb.addWorksheet('Actuals', { views: [{ state: 'frozen', ySplit: 1 }] });
      acs.columns = [{ header: 'Group', width: 18 }, { header: 'Item', width: 36 }, { header: 'Estimated', width: 12 }, { header: 'Actual', width: 12 }, { header: 'Difference', width: 12 }, { header: 'Difference %', width: 13 }];
      acs.getRow(1).eachCell(function (c) { c.font = { name: font, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }; });
      function acRow(vals, bold) {
        var r = acs.addRow(vals), n = r.number;
        if (vals[3] !== null && vals[3] !== undefined) { r.getCell(5).value = { formula: 'D' + n + '-C' + n }; r.getCell(6).value = { formula: 'IF(C' + n + '>0,(D' + n + '-C' + n + ')/C' + n + ',"")' }; }
        [3, 4, 5].forEach(function (i) { r.getCell(i).numFmt = '0.0 "h"'; }); r.getCell(6).numFmt = '+0%;-0%;0%';
        r.eachCell(function (c) { c.font = { name: font, bold: !!bold }; });
        return r;
      }
      ac.rows.forEach(function (x) { acRow([xs(x.category), xs(x.name), round(x.estimated, 2), x.actual === null ? null : round(x.actual, 2)]); });
      acRow(['', 'Scope options, overhead and buffer', round(ac.otherEstimated, 2), ac.otherActual === null ? null : round(ac.otherActual, 2)]);
      var last = acs.rowCount;
      var tr = acRow(['', 'Total', null, null], true);
      tr.getCell(3).value = { formula: 'SUM(C2:C' + last + ')' }; tr.getCell(4).value = { formula: 'SUM(D2:D' + last + ')' };
      tr.getCell(5).value = { formula: 'D' + tr.number + '-C' + tr.number }; tr.getCell(6).value = { formula: 'IF(C' + tr.number + '>0,(D' + tr.number + '-C' + tr.number + ')/C' + tr.number + ',"")' };
      if (!ac.complete) { acs.addRow([]); var nr = acs.addRow(['', 'Blank cells were not tracked; the total actual counts tracked lines only.']); nr.getCell(2).font = { name: font, italic: true, color: { argb: MUTED } }; }
      if (ac.note) { var nn = acs.addRow(['', xs(ac.note)]); nn.getCell(2).font = { name: font, color: { argb: MUTED } }; nn.getCell(2).alignment = { wrapText: true }; }
    }
    return wb.xlsx.writeBuffer();
  }

  // ---------------------------------------------------------------- G3 client proposal
  // One model feeds both the in-app preview and the Word document, so they always match.
  function proposalModel(est, meta) {
    est = normalize(est); meta = meta || {};
    var res = compute(est), pr = obj(est.proposal), labels = labelsOf(est);
    var cap = Math.max(1, num(pr.capacity, 40));
    var showHours = pr.showLineHours !== false;
    var cats = [], byCat = {};
    res.items.forEach(function (x) {
      if (!x.included) return;
      var it = x.item, c = it.categoryName || 'Custom';
      if (!byCat[c]) { byCat[c] = { name: c, items: [], hours: 0 }; cats.push(byCat[c]); }
      byCat[c].items.push({ name: it.name, qty: x.qty, hours: x.total, description: txt(it.description), includes: lines(it.includes), subs: (it.subs || []).map(function (s) { return s.name; }), tier: tierOf(it) });
      byCat[c].hours += x.total;
    });
    var regs = {}; REGISTER_KINDS.forEach(function (k) { regs[k.id] = registerFor(est, k.id).all.map(function (e) { return e.text; }); });
    var pk = packagesOf(est);
    return {
      title: est.name || 'Untitled estimate', client: est.client || '', service: est.serviceName || '',
      hourlyRate: res.hourlyRate, currency: res.currency, totalCost: res.totalCost,
      agency: meta.agency || '', preparedBy: meta.preparedBy || '', date: meta.date || '', validDays: Math.max(0, Math.round(num(pr.validDays, 30))),
      intro: txt(pr.intro).trim() || ('This proposal sets out the design work for ' + (est.name || 'the project') + (est.client ? ' for ' + est.client : '') + ': what is included, what each part takes and the assumptions behind the estimate.'),
      total: res.total, capacity: cap, weeks: res.total / cap, showHours: showHours, labels: labels,
      summary: [['Design', res.designSubtotal], ['Project management, meetings and iterations', res.overhead], ['Contingency (' + fmtNum(res.bufferPercent) + '%)', res.buffer]],
      packages: pk.enabled ? packageBreakdown(est).map(function (p) { return { name: p.name, total: p.total, weeks: p.total / cap, count: p.count, added: p.added.map(function (a) { return a.name; }), names: pk.names }; }) : null,
      packageNames: pk.names,
      scope: cats, deliverables: deliverables(est, res),
      timeline: phaseBreakdown(est, res).filter(function (p) { return p.total > 0; }).map(function (p) { return { phase: p.phase, hours: p.total, weeks: p.total / cap }; }),
      register: regs, outOfScope: outOfScope(est).map(function (o) { return o.name; }),
    };
  }
  async function buildDocx(D, est, meta) {
    var m = proposalModel(est, meta);
    var INK = '161A22', MUTED = '677084', BRAND = '0C8468', LINE = 'DFE3EA';
    var P = D.Paragraph, T = D.TextRun, H = D.HeadingLevel;
    function para(text, o) { o = o || {}; return new P({ spacing: { after: o.after === undefined ? 120 : o.after }, children: [new T({ text: xs(text), bold: o.bold, color: o.color || INK, size: o.size || 21, italics: o.italic })], alignment: o.align }); }
    function xs(v) { return String(v == null ? '' : v).replace(CTRL, ''); }
    function h(text, lvl) { return new P({ heading: lvl || H.HEADING_2, spacing: { before: 280, after: 120 }, children: [new T({ text: xs(text), bold: true, color: INK, size: lvl === H.HEADING_1 ? 40 : 28 })] }); }
    function bullet(text) { return new P({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new T({ text: xs(text), size: 21, color: INK })] }); }
    function cell(text, o) { o = o || {}; return new D.TableCell({ width: { size: o.w || 50, type: D.WidthType.PERCENTAGE }, shading: o.fill ? { fill: o.fill, type: D.ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new P({ alignment: o.right ? D.AlignmentType.RIGHT : undefined, children: [new T({ text: xs(text), bold: o.bold, size: 20, color: o.color || INK })] })] }); }
    function table(rows, widths) {
      var border = { style: D.BorderStyle.SINGLE, size: 4, color: LINE };
      return new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: rows.map(function (r, i) { return new D.TableRow({ tableHeader: i === 0, children: r.map(function (v, j) { return cell(v, { w: widths[j], bold: i === 0 || r.bold, fill: i === 0 ? 'F3F4F7' : undefined, right: j > 0 && typeof v === 'string' && /h$|weeks?$/.test(v), color: i === 0 ? MUTED : INK }); }) }); }) });
    }
    function hrs(v) { return fmtHours(round(v, 1)); }
    function wk(v) { return fmtNum(round(v, 1)) + (round(v, 1) === 1 ? ' week' : ' weeks'); }
    var kids = [];
    if (m.agency) kids.push(para(m.agency.toUpperCase(), { color: BRAND, bold: true, size: 18 }));
    kids.push(h(m.title, H.HEADING_1));
    kids.push(para([m.client ? 'Prepared for ' + m.client : '', m.date ? m.date : '', m.preparedBy ? 'by ' + m.preparedBy : ''].filter(Boolean).join(' · '), { color: MUTED }));
    kids.push(para(m.intro, { after: 200 }));
    kids.push(h('Summary'));
    var sum = [['', 'Hours']].concat(m.summary.map(function (s) { return [s[0], hrs(s[1])]; }));
    var totalRow = ['Total', hrs(m.total)]; totalRow.bold = true; sum.push(totalRow);
    kids.push(table(sum, [70, 30]));
    kids.push(para('About ' + wk(m.weeks) + ' at ' + fmtNum(m.capacity) + ' design hours a week.', { color: MUTED, after: 160 }));
    if (m.packages) {
      kids.push(h('Packages'));
      kids.push(table([['Package', 'Includes', 'Hours', 'Duration']].concat(m.packages.map(function (p, i) { return [p.name, (function () { var list = p.added.length > 8 ? p.added.slice(0, 8).join(', ') + ' and ' + (p.added.length - 8) + ' more' : p.added.join(', '); return i ? 'Everything in ' + m.packageNames[i - 1] + (list ? ', plus ' + list : '') : (p.count + ' ' + (p.count === 1 ? m.labels.item : m.labels.items).toLowerCase() + (list ? ': ' + list : '')); })(), hrs(p.total), wk(p.weeks)]; })), [18, 52, 15, 15]));
    }
    kids.push(h('Scope'));
    m.scope.forEach(function (c) {
      kids.push(new P({ spacing: { before: 200, after: 80 }, children: [new T({ text: xs(c.name), bold: true, size: 23, color: INK })].concat(m.showHours ? [new T({ text: '  ' + hrs(c.hours), size: 20, color: MUTED })] : []) }));
      c.items.forEach(function (it) {
        var line = it.name + (it.qty > 1 ? ' ×' + fmtNum(it.qty) : '') + (m.packages && it.tier ? ' (' + m.packageNames[it.tier] + ')' : '') + (m.showHours ? ' — ' + hrs(it.hours) : '');
        kids.push(bullet(line));
        var detail = [it.description].concat(it.subs.length ? [m.labels.subs + ': ' + it.subs.join(', ')] : []).concat(it.includes.length ? ['Includes ' + lcFirst(it.includes.join('; '))] : []).filter(Boolean).join(' ');
        if (detail) kids.push(new P({ indent: { left: 720 }, spacing: { after: 80 }, children: [new T({ text: xs(detail), size: 19, color: MUTED })] }));
      });
    });
    kids.push(h('Deliverables'));
    m.deliverables.forEach(function (d) { kids.push(bullet(d.group + ': ' + d.text)); });
    if (m.timeline.length > 1 || m.timeline.length === 1) {
      kids.push(h('Timeline'));
      kids.push(table([['Phase', 'Hours', 'Duration']].concat(m.timeline.map(function (t) { return [t.phase, hrs(t.hours), wk(t.weeks)]; })), [60, 20, 20]));
    }
    REGISTER_KINDS.forEach(function (k) { var list = m.register[k.id]; if (!list.length) return; kids.push(h(k.name)); list.forEach(function (t) { kids.push(bullet(t)); }); });
    if (m.outOfScope.length) { kids.push(h('Not included')); m.outOfScope.forEach(function (t) { kids.push(bullet(t)); }); }
    kids.push(h('Validity and acceptance'));
    kids.push(para('This estimate is valid for ' + m.validDays + ' days' + (m.date ? ' from ' + m.date : '') + '. Hours are estimates based on the scope above; changes to scope are estimated separately.'));
    kids.push(para(' ', { after: 400 }));
    kids.push(table([['Accepted for ' + (m.client || 'the client'), 'Date'], ['\n\nSignature', '']], [70, 30]));
    var doc = new D.Document({ creator: m.agency || 'Design Hours Estimator', title: m.title, styles: { default: { document: { run: { font: 'Arial' } } } }, sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, children: kids }] });
    return typeof window !== 'undefined' && D.Packer.toBlob ? D.Packer.toBlob(doc) : D.Packer.toBuffer(doc);
  }

  return {
    PRIORITIES: PRIORITIES, STATUSES: STATUSES, REGISTER_KINDS: REGISTER_KINDS, DEFAULT_LABELS: DEFAULT_LABELS, DEFAULT_COMPLEXITY: DEFAULT_COMPLEXITY,
    CURRENCIES: CURRENCIES, currencyInfo: currencyInfo, fmtMoney: fmtMoney,
    num: num, round: round, fmtNum: fmtNum, plainNum: plainNum, lcFirst: lcFirst, fmtHours: fmtHours, uid: uid, slug: slug, clone: clone, lines: lines, labelsOf: labelsOf,
    optionValue: optionValue, optionUnits: optionUnits, optionActive: optionActive, chosenOption: chosenOption, defaultScope: defaultScope, ruleHint: ruleHint, ruleLabel: ruleLabel,
    itemUnitHours: itemUnitHours, libItemHours: libItemHours, complexityMap: complexityMap, categoryName: categoryName,
    copyItem: copyItem, copySub: copySub, customItem: customItem, createEstimate: createEstimate,
    ratesOutdated: ratesOutdated, refreshRates: refreshRates,
    compute: compute, scenarios: scenarios, phaseBreakdown: phaseBreakdown, deliverables: deliverables,
    autoRegister: autoRegister, registerFor: registerFor, outOfScope: outOfScope, gapSuggestions: gapSuggestions,
    designRows: designRows, buildCsv: buildCsv, buildXlsx: buildXlsx,
    proposalModel: proposalModel, buildDocx: buildDocx, TIER_NAMES: TIER_NAMES, tierOf: tierOf, packagesOf: packagesOf, packageBreakdown: packageBreakdown, diffEstimates: diffEstimates,
    requirementsOf: requirementsOf, traceMatrix: traceMatrix, parseCsv: parseCsv, pastRows: pastRows, calibrate: calibrate,
    actualsOf: actualsOf, hasActuals: hasActuals, actualsSummary: actualsSummary, trackedRows: trackedRows, matchActuals: matchActuals,
    normalize: normalize, normalizeService: normalizeService, normalizeSettings: normalizeSettings, fileBase: fileBase,
  };
});
