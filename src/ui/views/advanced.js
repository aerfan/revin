// ================================================================== v2: packages, versions, traceability, briefs, proposal
  function PackagesPanel(p) {
    var d = p.draft, pk = E.packagesOf(d), labels = p.labels;
    var rows = pk.enabled ? E.packageBreakdown(d) : null;
    function setPk(fn) { p.change(function (n) { n.packages = Object.assign({ enabled: false, names: E.TIER_NAMES.slice() }, n.packages || {}); n.packages.names = E.packagesOf(n).names.slice(); fn(n.packages); }); }
    return html`<section class="panel panel-pad">
      <${CardHead} icon="pack" color="purple" title="Packages" desc="Offer the client Basic, Standard and Premium versions of this scope. Each item sits in the smallest package that includes it; set it in Build."
        right=${html`<label class="check-line" style="font-size:13px"><${Switch} id="pk-on" label="Offer packages" checked=${pk.enabled} onChange=${function (v) { setPk(function (x) { x.enabled = v; }); }} /> Offer packages</label>`} />
      ${pk.enabled ? html`<div class="pk-grid">${rows.map(function (r, i) {
        return html`<div class=${'pk-col' + (i === 2 ? ' top' : '')} key=${i}>
          <input class="input sm pk-name" maxlength="40" aria-label=${'Package ' + (i + 1) + ' name'} value=${pk.names[i]} onInput=${function (e) { var v = e.target.value; setPk(function (x) { x.names[i] = v; }); }} />
          <div class="pk-total"><span class="num">${E.fmtNum(E.round(r.total, 1))}</span><span class="u">h</span></div>
          <div class="pk-meta">${E.fmtNum(r.count)} ${lower(plural(r.count, labels.item, labels.items))}${i ? html` · <span class="up">+${E.fmtHours(E.round(r.total - rows[i - 1].total, 1))}</span>` : null}</div>
          <div class="pk-adds"><b>${i ? 'Adds' : 'Includes'}</b> ${r.added.length ? r.added.slice(0, 5).map(function (a) { return a.name; }).join(', ') + (r.added.length > 5 ? ' and ' + (r.added.length - 5) + ' more' : '') : html`<span class="muted">${i ? 'nothing yet. Open an item in Build and choose ' + pk.names[i] + '.' : 'nothing yet'}</span>`}</div>
        </div>`;
      })}</div>` : html`<p class="muted" style="font-size:13px">Off: the client sees one estimate with everything in scope.</p>`}
    </section>`;
  }

  function DiffView(p) {
    var d = p.diff;
    var sign = function (v) { var r = E.round(v, 1); return (r > 0 ? '+' : r < 0 ? '−' : '±') + E.fmtHours(Math.abs(r)); };
    return html`<div class="diff">
      <div class="diff-sum">
        <span class=${'delta ' + (d.delta > 0.05 ? 'up' : d.delta < -0.05 ? 'down' : '')}>${sign(d.delta)}</span>
        <span>${E.fmtHours(E.round(d.before, 1))} → ${E.fmtHours(E.round(d.after, 1))}</span>
        <span class="muted">${d.counts.added} added · ${d.counts.removed} removed · ${d.counts.changed} changed</span>
      </div>
      ${d.rows.length ? html`<div class="table-wrap"><table class="bd">
        <thead><tr><th>Line</th><th>What changed</th><th class="n">Before</th><th class="n">Now</th><th class="n">Change</th></tr></thead>
        <tbody>${d.rows.map(function (r, i) {
          return html`<tr key=${i} class=${'df-' + r.status}><td><span class=${'df-tag ' + r.status}>${r.status}</span> <bdi>${r.name}</bdi></td><td class="why">${r.notes.join(' · ')}</td><td class="n">${r.before ? E.fmtHours(E.round(r.before, 1)) : '—'}</td><td class="n">${r.after ? E.fmtHours(E.round(r.after, 1)) : '—'}</td><td class=${'n ' + (r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : '')}>${sign(r.delta)}</td></tr>`;
        })}
        ${d.lines.slice(1, 4).filter(function (l) { return Math.abs(l.delta) > 0.05; }).map(function (l) { return html`<tr class="subtotal" key=${l.label}><td colspan="2">${l.label}</td><td class="n">${E.fmtHours(E.round(l.before, 1))}</td><td class="n">${E.fmtHours(E.round(l.after, 1))}</td><td class=${'n ' + (l.delta > 0 ? 'up' : 'down')}>${sign(l.delta)}</td></tr>`; })}
        </tbody></table></div>` : html`<p class="muted" style="font-size:13px;padding:4px 0">No line changes${Math.abs(d.delta) > 0.05 ? '; the difference comes from scope options, overhead or buffer.' : '.'}</p>`}
    </div>`;
  }

  function VersionsPanel(p) {
    var ctx = p.ctx, id = p.id;
    var sl = useState(null), list = sl[0], setList = sl[1];
    var sc = useState(null), cmp = sc[0], setCmp = sc[1];
    var sn = useState(''), label = sn[0], setLabel = sn[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    useEffect(function () {
      if (!ctx.caps || !ctx.caps.db) return;
      var un = null;
      try { un = ctx.caps.db.collection('estimates/' + id + '/versions').orderBy('createdAt', 'desc').limit(50).onSnapshot(function (snap) { setList(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })); }, function () { setList([]); }); } catch (e) { setList([]); }
      return function () { try { if (un) un(); } catch (e) { /* ignore */ } };
    }, [id]);
    async function saveVersion(name) {
      if (busy) return false;
      setBusy(true);
      var data = clean(p.draft); delete data.updatedAt;
      var doc = { label: name, createdAt: Date.now(), createdBy: (ctx.me && ctx.me.id) || null, totalHours: E.round(E.compute(p.draft).total, 1), data: data };
      var ok = await ctx.api.set('estimates/' + id + '/versions/' + newId('ver'), doc);
      setBusy(false);
      return ok;
    }
    var next = 'v' + ((list ? list.length : 0) + 1);
    function restore(v) {
      ctx.confirm({ title: 'Restore ' + v.label + '?', body: 'The current state is saved as a version first, so you can come back to it.', confirmLabel: 'Restore',
        onConfirm: async function () {
          var ok = await saveVersion('Before restoring ' + v.label); if (!ok) return;
          p.change(function (n) { ['items', 'scope', 'customDeliverables', 'overhead', 'bufferPercent', 'register', 'hiddenAuto', 'dismissedSuggestions', 'packages', 'requirements', 'snapshot', 'serviceId', 'serviceName'].forEach(function (k) { if (v.data[k] !== undefined) n[k] = E.clone(v.data[k]); }); });
          setCmp(null); ctx.toast('Restored ' + v.label);
        } });
    }
    var cur = E.compute(p.draft).total;
    return html`<section class="panel panel-pad">
      <${CardHead} icon="clock" color="teal" title="Versions" desc="Save the estimate as it stands before sending it, then compare what changed between quotes." />
      <form class="str-row" onSubmit=${async function (e) { e.preventDefault(); var t = label.trim() || next; if (await saveVersion(t)) { setLabel(''); ctx.toast('Saved ' + t); } }}>
        <input class="input" id="ver-label" maxlength="80" placeholder=${next + ', e.g. Sent to client 18 Oct'} value=${label} onInput=${function (e) { setLabel(e.target.value); }} />
        <button class="btn" type="submit" disabled=${busy}><${Icon} name="plus" /> Save version</button>
      </form>
      ${list === null ? html`<div class="skeleton" style="width:40%;margin-top:12px"></div>` : list.length ? html`<div class="ver-list">${list.map(function (v) {
        var d = cur - E.num(v.totalHours), open = cmp === v.id;
        return html`<div key=${v.id}>
          <div class="ver-row">
            <div class="grow"><div class="ver-name"><bdi>${v.label}</bdi></div><div class="opt-hint">${ago(v.createdAt)} · ${E.fmtHours(E.num(v.totalHours))}${Math.abs(d) > 0.05 ? html` · <span class=${d > 0 ? 'up' : 'down'}>now ${d > 0 ? '+' : '−'}${E.fmtHours(E.round(Math.abs(d), 1))}</span>` : ' · same total'}</div></div>
            <button class="btn sm" aria-expanded=${open ? 'true' : 'false'} onClick=${function () { setCmp(open ? null : v.id); }}>${open ? 'Hide' : 'Compare'}</button>
            <button class="btn sm ghost" onClick=${function () { restore(v); }}>Restore</button>
            <button class="icon-btn danger" aria-label=${'Delete version ' + v.label} onClick=${function () { ctx.confirm({ title: 'Delete version ' + v.label + '?', body: 'The estimate itself is not affected.', confirmLabel: 'Delete', danger: true, onConfirm: function () { ctx.api.del('estimates/' + id + '/versions/' + v.id); } }); }}><${Icon} name="trash" /></button>
          </div>
          ${open ? html`<div class="ver-diff"><div class="eyebrow" style="margin-bottom:8px">Changes since ${v.label}</div><${DiffView} diff=${E.diffEstimates(v.data || {}, p.draft)} /></div>` : null}
        </div>`;
      })}</div>` : html`<p class="muted" style="font-size:13px;margin-top:10px">No versions yet. Save one when you send the estimate, so the next round shows what changed.</p>`}
    </section>`;
  }

  // An hours field that may be left blank (blank = not tracked yet).
  function OptHours(p) {
    var st = useState(p.value === null || p.value === undefined ? '' : E.plainNum(p.value)), text = st[0], setText = st[1];
    var focused = useRef(false);
    useEffect(function () { if (!focused.current) setText(p.value === null || p.value === undefined ? '' : E.plainNum(p.value)); }, [p.value]);
    function commit(raw) {
      var s = String(raw).trim();
      if (!s) { setText(''); if (p.value !== null && p.value !== undefined) p.onChange(null); return; }
      var n = parseFloat(s.replace(',', '.'));
      if (!isFinite(n) || n < 0) { setText(p.value === null || p.value === undefined ? '' : E.plainNum(p.value)); return; }
      n = Math.min(100000, Math.round(n * 100) / 100);
      setText(E.plainNum(n)); if (n !== p.value) p.onChange(n);
    }
    return html`<span class="opt-hours"><input class="input sm" id=${p.id} inputmode="decimal" aria-label=${p.label} placeholder=${p.placeholder || '—'} value=${text}
      onFocus=${function () { focused.current = true; }}
      onInput=${function (e) { setText(e.target.value); }}
      onBlur=${function (e) { focused.current = false; commit(e.target.value); }}
      onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(e.target.value); } }} /><span class="unit">h</span></span>`;
  }

  // F1: what the project actually took, line by line. Feeds Library → Calibrate hours.
  function ActualsPanel(p) {
    var d = p.draft, labels = p.labels, ctx = p.ctx;
    var s = E.actualsSummary(d, p.res);
    var won = d.status === 'won';
    var so = useState(false), open = so[0], setOpen = so[1];
    var sm = useState(''), sheet = sm[0], setSheet = sm[1];
    var si = useState(false), imp = si[0], setImp = si[1];
    var show = open || won || s.tracked > 0 || s.otherActual !== null;
    function setActual(key, v) { p.change(function (n) { var a = n.actuals = Object.assign({ items: {} }, n.actuals || {}); a.items = Object.assign({}, a.items || {}); if (v === null) delete a.items[key]; else a.items[key] = v; }); }
    function setOther(v) { p.change(function (n) { var a = n.actuals = Object.assign({ items: {} }, n.actuals || {}); if (v === null) delete a.other; else a.other = v; }); }
    function importSheet(t) {
      var m = E.matchActuals(d, E.parseCsv(t));
      if (!m.matched) { ctx.toast('No lines matched this estimate. Check that the first column names the ' + lower(labels.items) + '.', 'error'); return; }
      p.change(function (n) { var a = n.actuals = Object.assign({ items: {} }, n.actuals || {}); a.items = Object.assign({}, a.items || {}, m.items); if (m.unmatchedHours) a.other = E.round((a.other || 0) + m.unmatchedHours, 2); });
      ctx.toast('Filled ' + m.matched + ' ' + lower(plural(m.matched, labels.item, labels.items)) + (m.unmatched.length ? '; ' + E.fmtHours(m.unmatchedHours) + ' from ' + m.unmatched.length + ' other ' + plural(m.unmatched.length, 'line', 'lines') + ' went to project time' : ''));
      setSheet(''); setImp(false);
    }
    function pct(v) { if (v === null || !isFinite(v)) return '—'; var r = Math.round(v); return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r) + '%'; }
    function cls(v) { return v === null ? '' : v > 10 ? 'over' : v < -10 ? 'under' : 'ok'; }
    var head = html`<${CardHead} icon="gauge" color="pink" title="Actual hours" desc=${'Record what the project really took. Tracked estimates improve the library: Library → Calibrate hours reads them automatically.'}
      right=${s.tracked || s.otherActual !== null ? html`<span class=${'pill ' + (s.complete ? 's-won' : 's-review')}>${s.complete ? 'Tracked' : s.tracked + ' of ' + s.count + ' tracked'}</span>` : null} />`;
    if (!show) return html`<section class="panel panel-pad">${head}
      <div class="row" style="gap:10px"><p class="muted grow" style="font-size:13px">Usually filled in once the project is won and delivered.</p><button class="btn sm" onClick=${function () { setOpen(true); }}><${Icon} name="plus" size=${14} /> Track actual hours</button></div>
    </section>`;
    return html`<section class="panel flush act-panel">
      <div class="panel-pad" style="padding-bottom:0">${head}</div>
      ${s.tracked ? html`<div class="act-sum">
        <div><span class="eyebrow">Estimated</span><b>${E.fmtHours(E.round(s.complete ? s.estimated : s.itemsEstimated, 1))}</b></div>
        <div><span class="eyebrow">Actual</span><b>${E.fmtHours(E.round(s.complete ? s.actual : s.itemsActual, 1))}</b></div>
        <div><span class="eyebrow">Difference</span><b class=${'act-d ' + cls(s.complete ? s.pct : s.itemsPct)}>${pct(s.complete ? s.pct : s.itemsPct)}</b></div>
        <p class="opt-hint">${s.complete ? 'Whole project, including scope options, overhead and buffer.' : 'Tracked ' + lower(labels.items) + ' only. Fill every line and project time to compare the whole project.'}</p>
      </div>` : null}
      ${s.rows.length ? html`<div class="table-wrap"><table class="bd act">
        <thead><tr><th>${labels.item}</th><th class="n">Estimated</th><th class="n">Actual</th><th class="n">Difference</th></tr></thead>
        <tbody>
          ${s.rows.map(function (r) { return html`<tr key=${r.key}>
            <td><bdi>${r.name}</bdi> <span class="paren">(<bdi>${r.category}</bdi>${r.qty !== 1 ? ', ×' + E.fmtNum(r.qty) : ''})</span></td>
            <td class="n">${E.fmtHours(E.round(r.estimated, 1))}</td>
            <td class="n"><${OptHours} id=${'act-' + r.key} label=${'Actual hours for ' + r.name} value=${r.actual} onChange=${function (v) { setActual(r.key, v); }} /></td>
            <td class=${'n act-d ' + cls(r.pct)}>${r.actual === null ? '' : pct(r.pct)}</td>
          </tr>`; })}
          <tr class="subtotal"><td>Project time <span class="paren">(scope options, overhead, buffer: meetings, feedback, handoff)</span></td>
            <td class="n">${E.fmtHours(E.round(s.otherEstimated, 1))}</td>
            <td class="n"><${OptHours} id="act-other" label="Actual project time" value=${s.otherActual} onChange=${setOther} /></td>
            <td class=${'n act-d ' + cls(s.otherActual === null || !s.otherEstimated ? null : (s.otherActual - s.otherEstimated) / s.otherEstimated * 100)}>${s.otherActual === null ? '' : pct(s.otherEstimated ? (s.otherActual - s.otherEstimated) / s.otherEstimated * 100 : null)}</td>
          </tr>
        </tbody></table></div>` : html`<p class="muted panel-pad" style="font-size:13px">Add ${lower(labels.items)} in Build first.</p>`}
      <div class="panel-pad act-foot">
        ${imp ? html`<div class="stack" style="gap:8px">
          <label class="opt-hint" for="act-sheet">Paste a timesheet: one column naming the ${lower(labels.item)}, one with hours. Rows for the same ${lower(labels.item)} are added up; anything that doesn't match goes to project time.</label>
          <textarea class="textarea" id="act-sheet" rows="5" placeholder=${'Task,Hours\nHome,9\nHome,6.5\nClient call,1'} value=${sheet} onInput=${function (e) { setSheet(e.target.value); }}></textarea>
          <div class="row" style="gap:8px"><label class="btn sm ghost" style="cursor:pointer"><${Icon} name="file" size=${14} /> Open CSV<input type="file" accept=".csv,.txt,text/csv" class="sr" onChange=${function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; f.text().then(importSheet); e.target.value = ''; }} /></label>
            <span class="spacer"></span><button class="btn sm ghost" onClick=${function () { setImp(false); setSheet(''); }}>Cancel</button><button class="btn sm primary" disabled=${!sheet.trim()} onClick=${function () { importSheet(sheet); }}>Fill from timesheet</button></div>
        </div>` : html`<div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn sm" onClick=${function () { setImp(true); }}><${Icon} name="file" size=${14} /> Import timesheet</button>
          ${s.tracked || s.otherActual !== null ? html`<button class="btn sm ghost" onClick=${function () { ctx.confirm({ title: 'Clear actual hours?', body: 'Removes every actual hour recorded on this estimate.', confirmLabel: 'Clear', danger: true, onConfirm: function () { p.change(function (n) { delete n.actuals; }); setOpen(false); } }); }}>Clear</button>` : null}
          ${!won ? html`<span class="opt-hint" style="margin-left:auto">Tip: set the status to Won when the project goes ahead.</span>` : null}
        </div>`}
      </div>
    </section>`;
  }

  function nextReqId(reqs) { var n = 0; reqs.forEach(function (q) { var m = /^R(\d+)$/.exec(q.id); if (m) n = Math.max(n, +m[1]); }); return n + 1; }
  function TracePanel(p) {
    var d = p.draft, reqs = E.requirementsOf(d), tm = E.traceMatrix(d);
    var st = useState(''), text = st[0], setText = st[1];
    function add(t) { p.change(function (n) { var list = E.requirementsOf(n); list.push({ id: 'R' + nextReqId(list), text: t, source: 'Manual' }); n.requirements = list; }); }
    function covered(id) { return tm.rows.filter(function (r) { return r.req.id === id; })[0]; }
    var uncovered = tm.rows.filter(function (r) { return !r.items.some(function (i) { return i.included; }); }).length;
    return html`<section class="panel panel-pad">
      <${CardHead} icon="link" color="blue" title="Requirements" desc="What the client asked for, and which items cover it. Analyze a brief in Build, or add them here." right=${reqs.length ? html`<span class=${'pill ' + (uncovered ? 's-review' : 's-won')}>${uncovered ? uncovered + ' not covered' : 'All covered'}</span>` : null} />
      ${reqs.length ? html`<div class="req-list">${reqs.map(function (q) {
        var row = covered(q.id), items = row ? row.items : [];
        return html`<div class="req-row" key=${q.id}>
          <span class="req-id">${q.id}</span>
          <div class="grow"><div class="req-text"><bdi>${q.text}</bdi></div>
            <div class="opt-hint">${items.length ? items.map(function (i) { return i.name + (i.included ? '' : " (won't have)"); }).join(', ') : html`<span class="req-miss">Not covered</span>`}</div></div>
          ${items.length ? null : html`<button class="btn sm" onClick=${function () { p.change(function (n) { var it = E.customItem(q.text.length > 70 ? q.text.slice(0, 67) + '…' : q.text, 4, 'custom', 'Custom', n); it.reqs = [q.id]; n.items.push(it); }); p.ctx.toast('Added a custom ' + lower(p.labels.item) + ' for ' + q.id); }}><${Icon} name="plus" size=${14} /> Custom ${lower(p.labels.item)}</button>`}
          <button class="icon-btn danger" aria-label=${'Remove requirement ' + q.id} onClick=${function () { p.change(function (n) { n.requirements = E.requirementsOf(n).filter(function (x) { return x.id !== q.id; }); n.items.forEach(function (it) { if (it.reqs) it.reqs = it.reqs.filter(function (z) { return z !== q.id; }); }); }); }}><${Icon} name="trash" /></button>
        </div>`;
      })}</div>` : null}
      ${tm.unlinked.length && reqs.length ? html`<p class="opt-hint" style="margin-top:8px">${tm.unlinked.length} ${lower(plural(tm.unlinked.length, p.labels.item, p.labels.items))} not linked to a requirement. Link them from each item in Build.</p>` : null}
      <form class="str-row" style="margin-top:10px" onSubmit=${function (e) { e.preventDefault(); var t = text.trim(); if (!t) return; add(t); setText(''); }}>
        <input class="input" id="req-new" maxlength="300" placeholder="Add a requirement, e.g. Customers can track their order" value=${text} onInput=${function (e) { setText(e.target.value); }} />
        <button class="btn" type="submit"><${Icon} name="plus" /> Add</button>
      </form>
    </section>`;
  }
  function ReqLinks(p) {
    var reqs = E.requirementsOf(p.draft), mine = (p.it.reqs || []).filter(function (id) { return reqs.some(function (q) { return q.id === id; }); });
    var rest = reqs.filter(function (q) { return mine.indexOf(q.id) < 0; });
    return html`<div class="ctl"><span class="ctl-label">Requirements</span>
      <div class="chips">
        ${mine.map(function (id) { var q = reqs.filter(function (x) { return x.id === id; })[0]; return html`<span class="chip req-chip" key=${id} title=${q.text}><b>${id}</b> <span class="req-chip-t">${q.text}</span><button type="button" class="x" aria-label=${'Unlink ' + id} onClick=${function () { p.upd(function (t) { t.reqs = (t.reqs || []).filter(function (z) { return z !== id; }); }); }}><${Icon} name="x" size=${12} /></button></span>`; })}
        ${rest.length ? html`<select class="select sm" style="width:auto;max-width:100%" aria-label="Link a requirement" value="" onChange=${function (e) { var v = e.target.value; if (!v) return; p.upd(function (t) { t.reqs = (t.reqs || []).concat(v); }); }}>
          <option value="">Link a requirement…</option>${rest.map(function (q) { return html`<option value=${q.id}>${q.id} · ${q.text.length > 60 ? q.text.slice(0, 57) + '…' : q.text}</option>`; })}</select>` : null}
      </div></div>`;
  }

  // A1: Claude reads a brief and maps it onto this service's library. The person reviews every line before anything is added.
  function briefPrompt(draft, service, text) {
    var cats = {}; (service.categories || []).forEach(function (c) { cats[c.id] = c.name; });
    var libLines = (service.items || []).map(function (li) { return li.id + ' | ' + (cats[li.categoryId] || 'Other') + ' | ' + li.name + (li.description ? ' — ' + String(li.description).slice(0, 110) : ''); }).join('\n');
    var groups = ((draft.snapshot && draft.snapshot.optionGroups) || []).map(function (g) { return g.id + ' (' + g.name + (g.selection === 'single' ? ', pick one' : '') + '): ' + (g.options || []).map(function (o) { return o.id + '=' + o.name + (o.input === 'quantity' && g.selection !== 'single' ? ' [number]' : ''); }).join('; '); }).join('\n');
    return [
      'You help a design agency scope ' + (service.name || 'design') + ' work from a client brief. Map the brief onto the agency\'s library.',
      '', 'LIBRARY (id | group | name — definition):', libLines,
      '', 'GROUP IDS: ' + (service.categories || []).map(function (c) { return c.id + '=' + c.name; }).join('; '),
      '', 'SCOPE OPTIONS (group id: option id=name):', groups || '(none)',
      '', 'BRIEF:', '"""', text, '"""', '',
      'Reply with only JSON in this shape:',
      '{"requirements":[{"id":"R1","text":"short quote or close paraphrase of one need in the brief, max 160 characters"}],',
      ' "matches":[{"libId":"a library id from the list","qty":1,"reqs":["R1"],"why":"max 80 characters"}],',
      ' "custom":[{"name":"page or feature name","hours":4,"group":"a group id or custom","reqs":["R2"],"why":"max 80 characters"}],',
      ' "scope":[{"group":"option group id","option":"option id","value":true,"reqs":["R3"]}],',
      ' "questions":["a real ambiguity to ask the client"]}',
      'Rules: one requirement per distinct need (at most 40). Use only library ids from the list. Use custom only when nothing in the library fits, with hours similar to comparable library items. qty above 1 only when the brief names several of the same page or feature. For [number] options give a number. At most 6 questions. Write in the brief\'s language.',
    ].join('\n');
  }
  var SAMPLE_ERR = {
    not_granted: 'Claude was not allowed for this page. Allow it when asked, then try again.', not_declared: 'Claude is not available for this app yet.',
    sampling_disabled: 'Claude is not available for this account.', rate_limited: 'Too many requests right now. Wait a minute and try again.',
    prompt_too_large: 'That brief is too long. Paste the most relevant part (about 40 pages of text at most).', invalid_json: 'Claude\'s answer could not be read. Try again.',
    refused: 'Claude could not analyze this brief.', empty_completion: 'Claude returned nothing. Try again.', session_expired: 'Your session expired. Reload the page and try again.',
  };
  function BriefPanel(p) {
    var ctx = p.ctx, service = p.service, draft = p.draft, labels = p.labels;
    var so = useState(false), open = so[0], setOpen = so[1];
    var st = useState(''), text = st[0], setText = st[1];
    var ss = useState('idle'), state = ss[0], setState = ss[1];
    var se = useState(''), err = se[0], setErr = se[1];
    var sr = useState(null), result = sr[0], setResult = sr[1];
    var sp = useState({}), pick = sp[0], setPick = sp[1];
    var ctl = useRef(null);
    var libById = {}; (service.items || []).forEach(function (li) { libById[li.id] = li; });
    var have = {}; draft.items.forEach(function (it) { if (it.libId) have[it.libId] = it; });
    function tidy(raw) {
      var r = raw && typeof raw === 'object' ? raw : {};
      var reqs = (Array.isArray(r.requirements) ? r.requirements : []).filter(function (q) { return q && q.id && q.text; }).slice(0, 40).map(function (q) { return { id: String(q.id), text: String(q.text).slice(0, 300) }; });
      var ids = {}; reqs.forEach(function (q) { ids[q.id] = 1; });
      var rq = function (a) { return (Array.isArray(a) ? a : []).map(String).filter(function (x) { return ids[x]; }); };
      var seen = {};
      var matches = (Array.isArray(r.matches) ? r.matches : []).filter(function (m) { if (!m || !libById[m.libId] || seen[m.libId]) return false; seen[m.libId] = 1; return true; }).map(function (m) { return { libId: m.libId, qty: Math.min(99, Math.max(1, Math.round(E.num(m.qty, 1)))), reqs: rq(m.reqs), why: String(m.why || '').slice(0, 120) }; });
      var catIds = (service.categories || []).map(function (c) { return c.id; });
      var custom = (Array.isArray(r.custom) ? r.custom : []).filter(function (c) { return c && String(c.name || '').trim(); }).slice(0, 30).map(function (c) { return { name: String(c.name).trim().slice(0, 200), hours: Math.min(1000, Math.max(0, E.round(E.num(c.hours, 4), 2))), group: catIds.indexOf(c.group) >= 0 ? c.group : 'custom', reqs: rq(c.reqs), why: String(c.why || '').slice(0, 120) }; });
      var groups = (draft.snapshot && draft.snapshot.optionGroups) || [];
      var scope = (Array.isArray(r.scope) ? r.scope : []).map(function (x) { var g = groups.filter(function (gg) { return gg.id === (x && x.group); })[0]; var o = g && (g.options || []).filter(function (oo) { return oo.id === x.option; })[0]; if (!o) return null; var qty = g.selection !== 'single' && o.input === 'quantity'; var v = qty ? Math.min(E.num(o.max, 99), Math.max(E.num(o.min, 0), Math.round(E.num(x.value, 1)))) : true; return { group: g.id, option: o.id, value: v, label: qty ? g.name + ': ' + o.name + ' ' + v : g.name + ': ' + o.name, reqs: rq(x && x.reqs) }; }).filter(Boolean);
      var questions = (Array.isArray(r.questions) ? r.questions : []).map(function (q) { return String(q).trim().slice(0, 300); }).filter(Boolean).slice(0, 6);
      return { requirements: reqs, matches: matches, custom: custom, scope: scope, questions: questions };
    }
    async function analyze() {
      var t = text.trim(); if (!t || state === 'busy') return;
      setErr(''); setResult(null); setState('busy');
      ctl.current = new AbortController();
      try {
        var raw = await ctx.sample.json(briefPrompt(draft, service, t.slice(0, 120000)), { signal: ctl.current.signal });
        var res = tidy(raw);
        var pk = {};
        res.matches.forEach(function (m, i) { pk['m' + i] = true; }); res.custom.forEach(function (c, i) { pk['c' + i] = true; }); res.scope.forEach(function (x, i) { pk['s' + i] = true; }); res.questions.forEach(function (q, i) { pk['q' + i] = true; });
        setPick(pk); setResult(res); setState('done');
      } catch (e) {
        setState('idle');
        if (e && e.code === 'cancelled') return;
        setErr(SAMPLE_ERR[e && e.code] || 'The brief could not be analyzed. Try again in a moment.');
      }
    }
    function apply() {
      var r = result; if (!r) return;
      var n0 = 0;
      p.change(function (n) {
        var list = E.requirementsOf(n), base = nextReqId(list), map = {};
        r.requirements.forEach(function (q, i) { var nid = 'R' + (base + i); map[q.id] = nid; list.push({ id: nid, text: q.text, source: 'Brief' }); });
        n.requirements = list;
        var m2 = function (a) { return a.map(function (x) { return map[x]; }).filter(Boolean); };
        r.matches.forEach(function (m, i) {
          if (!pick['m' + i]) return;
          var ex = n.items.filter(function (it) { return it.libId === m.libId; })[0];
          if (ex) { ex.reqs = (ex.reqs || []).concat(m2(m.reqs)).filter(function (v, j, a) { return a.indexOf(v) === j; }); return; }
          var it = E.copyItem(service, libById[m.libId], n); if (m.qty > 1) it.qty = m.qty; it.reqs = m2(m.reqs); n.items.push(it); n0++;
        });
        r.custom.forEach(function (c, i) { if (!pick['c' + i]) return; var it = E.customItem(c.name, c.hours, c.group, c.group === 'custom' ? 'Custom' : E.categoryName(service, c.group), n); it.reqs = m2(c.reqs); n.items.push(it); n0++; });
        r.scope.forEach(function (x, i) {
          if (!pick['s' + i]) return;
          var g = n.snapshot.optionGroups.filter(function (gg) { return gg.id === x.group; })[0]; if (!g) return;
          n.scope = n.scope || { values: {}, choice: {} };
          if (g.selection === 'single') { n.scope.choice = n.scope.choice || {}; n.scope.choice[g.id] = x.option; } else { n.scope.values = n.scope.values || {}; n.scope.values[x.option] = x.value; }
        });
        r.questions.forEach(function (q, i) { if (!pick['q' + i]) return; n.register = n.register || {}; n.register.dependencies = (n.register.dependencies || []).concat({ id: E.uid('d'), text: 'Open question: ' + q }); });
      });
      ctx.toast('Added ' + r.requirements.length + ' ' + plural(r.requirements.length, 'requirement', 'requirements') + ' and the lines you kept. Each is linked in Review → Requirements.');
      setResult(null); setText(''); setState('idle'); setOpen(false);
    }
    function toggle(k) { setPick(function (x) { var c = Object.assign({}, x); c[k] = !x[k]; return c; }); }
    function line(k, title, meta, extra) { return html`<label class="brief-line" key=${k}><input type="checkbox" class="cb" checked=${!!pick[k]} onChange=${function () { toggle(k); }} /><span class="grow"><span class="brief-t"><bdi>${title}</bdi>${extra || null}</span>${meta ? html`<span class="opt-hint">${meta}</span>` : null}</span></label>`; }
    if (!open) return html`<button class="brief-cta" onClick=${function () { setOpen(true); }}><${Tile} icon="sparkles" color="purple" /><span class="t"><b>Analyze a client brief</b><span>Paste a brief, RFP or call notes. Claude suggests ${lower(labels.items)} from your library and links each to the line it came from.</span></span><${Icon} name="arrowR" /></button>`;
    var nsel = Object.keys(pick).filter(function (k) { return pick[k] && k[0] !== 'q'; }).length;
    return html`<section class="panel panel-pad brief" aria-label="Brief analyzer">
      <${CardHead} icon="sparkles" color="purple" title="Analyze a client brief" desc="Claude reads the brief against this service's library. Nothing is added until you review it." right=${html`<button class="icon-btn" aria-label="Close brief analyzer" onClick=${function () { if (ctl.current) ctl.current.abort(); setOpen(false); }}><${Icon} name="x" /></button>`} />
      ${!result ? html`<div class="stack" style="gap:10px">
        <textarea class="textarea brief-text" id="brief-text" maxlength="120000" placeholder="Paste the brief, RFP or meeting notes here" value=${text} onInput=${function (e) { setText(e.target.value); }} disabled=${state === 'busy'}></textarea>
        <div class="row" style="gap:10px;align-items:center">
          <label class="btn sm ghost" style="cursor:pointer"><${Icon} name="file" size=${14} /> Open a .txt or .md file<input type="file" accept=".txt,.md,.markdown,.csv,text/plain" class="sr" onChange=${function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 2e6) { setErr('That file is larger than 2 MB. Paste the relevant part instead.'); return; } f.text().then(function (t) { setText(t.slice(0, 120000)); }); e.target.value = ''; }} /></label>
          <span class="spacer"></span>
          ${state === 'busy' ? html`<span class="thinking"><span class="dotpulse"></span>Reading the brief…</span><button class="btn sm" onClick=${function () { if (ctl.current) ctl.current.abort(); }}>Stop</button>`
            : html`<button class="btn primary" disabled=${!text.trim()} onClick=${analyze}><${Icon} name="sparkles" size=${15} /> Analyze</button>`}
        </div>
        ${err ? html`<div class="banner bad"><${Icon} name="alert" /><div class="grow">${err}</div></div>` : null}
      </div>` : html`<div class="brief-res">
        <p class="opt-hint" style="margin-bottom:10px">Found ${result.requirements.length} ${plural(result.requirements.length, 'requirement', 'requirements')}. Untick anything that doesn't belong.</p>
        ${result.matches.length ? html`<div class="eyebrow">From your library</div>${result.matches.map(function (m, i) { var li = libById[m.libId]; return line('m' + i, li.name, (m.reqs.length ? m.reqs.join(', ') + ' · ' : '') + (have[m.libId] ? 'already in this estimate, will be linked' : m.why), m.qty > 1 ? html`<span class="qty-badge">×${m.qty}</span>` : null); })}` : null}
        ${result.custom.length ? html`<div class="eyebrow">New custom ${lower(labels.items)}</div>${result.custom.map(function (c, i) { return line('c' + i, c.name, (c.reqs.length ? c.reqs.join(', ') + ' · ' : '') + E.fmtHours(c.hours) + (c.why ? ' · ' + c.why : '')); })}` : null}
        ${result.scope.length ? html`<div class="eyebrow">Scope options</div>${result.scope.map(function (x, i) { return line('s' + i, x.label, x.reqs.join(', ')); })}` : null}
        ${result.questions.length ? html`<div class="eyebrow">Questions for the client <span class="paren">(added to dependencies)</span></div>${result.questions.map(function (q, i) { return line('q' + i, q, ''); })}` : null}
        <details class="brief-reqs"><summary>Requirements found (${result.requirements.length})</summary><ol>${result.requirements.map(function (q) { return html`<li key=${q.id}><b>${q.id}</b> <bdi>${q.text}</bdi></li>`; })}</ol></details>
        <div class="row" style="margin-top:12px;gap:8px"><button class="btn ghost" onClick=${function () { setResult(null); setState('idle'); }}>Back to the brief</button><span class="spacer"></span><button class="btn primary" onClick=${apply}><${Icon} name="check" size=${15} /> Add ${nsel} ${plural(nsel, 'line', 'lines')} and the requirements</button></div>
      </div>`}
    </section>`;
  }

  function ProposalView(p) {
    var ctx = p.ctx, d = p.draft, pr = d.proposal || {};
    var sClean = useState(false), cleanMode = sClean[0], setCleanMode = sClean[1];
    var sTier = useState(null), selectedTier = sTier[0], setSelectedTier = sTier[1];
    var sName = useState(''), signName = sName[0], setSignName = sName[1];
    var sEmail = useState(''), signEmail = sEmail[0], setSignEmail = sEmail[1];
    var sOrg = useState(d.client || ''), signOrg = sOrg[0], setSignOrg = sOrg[1];
    var sAgree = useState(false), agreed = sAgree[0], setAgreed = sAgree[1];

    var m = E.proposalModel(d, {
      agency: ctx.settings.agencyName || '',
      preparedBy: (ctx.me && ctx.me.name) || '',
      date: today(),
      maxTier: selectedTier !== null ? selectedTier : undefined,
    });

    function set(k, v) { p.change(function (n) { n.proposal = Object.assign({}, n.proposal || {}); n.proposal[k] = v; }); }
    var hrs = function (v) { return E.fmtHours(E.round(v, 1)); };
    var wk = function (v) { var r = E.round(v, 1); return E.fmtNum(r) + (r === 1 ? ' week' : ' weeks'); };

    function signProposal() {
      var name = signName.trim().slice(0, 100);
      var email = signEmail.trim().slice(0, 120);
      var org = signOrg.trim().slice(0, 100);
      if (!name || !agreed) return;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        ctx.toast('Please enter a valid work email address', 'bad');
        return;
      }
      var tierLabel = selectedTier !== null && m.packageNames ? m.packageNames[selectedTier] : 'Full Scope';
      var acceptance = {
        name: name,
        email: email,
        org: org,
        timestamp: Date.now(),
        package: tierLabel,
        totalHours: E.round(m.total, 1),
        totalCost: m.totalCost,
      };
      p.change(function (n) {
        n.acceptance = acceptance;
        n.status = 'approved';
      });
      ctx.toast('Proposal accepted and digitally signed!', 'good');
      Telemetry.track('proposal_accepted', {
        package: String(tierLabel || '').slice(0, 50),
        total: Math.round(m.totalCost || 0)
      });

      // Dispatch outbound automation webhook if configured
      var wh = ctx.settings && ctx.settings.webhooks;
      if (wh && wh.enabled && wh.url) {
        try {
          var payload = E.formatWebhookPayload(Object.assign({}, d, {
            acceptance: acceptance,
            status: 'approved',
            total: m.total,
            totalCost: m.totalCost,
            currency: m.currency,
            milestones: m.milestones,
          }), 'proposal.accepted', { url: wh.url });

          E.dispatchWebhook(wh.url, payload, wh.secret).then(function (res) {
            if (res.ok) {
              Telemetry.crumb('webhook', 'Delivered to ' + wh.url.slice(0, 40));
            } else {
              Telemetry.record(new Error('Webhook returned HTTP ' + res.status), { route: 'proposal', severity: 'warn' });
            }
          }).catch(function (err) {
            Telemetry.record(err, { route: 'proposal', severity: 'warn' });
          });
        } catch (e) {
          Telemetry.record(e, { route: 'proposal', severity: 'warn' });
        }
      }
    }

    function revokeSignature() {
      ctx.confirm({
        title: 'Revoke proposal acceptance?',
        body: 'This reopens the estimate for editing and clears the digital signature record.',
        confirmLabel: 'Revoke signature',
        danger: true,
        onConfirm: function () {
          p.change(function (n) {
            n.acceptance = null;
            n.status = 'draft';
          });
          ctx.toast('Proposal signature revoked');
        },
      });
    }

    var tiers = m.packageTiers || [];
    var isAccepted = !!d.acceptance;

    return html`<div class=${'proposal-layout' + (cleanMode ? ' clean-mode' : '')}>
      <aside class="panel panel-pad prop-opts">
        <div class="crumbs" style="margin-bottom:6px"><button onClick=${function () { p.goStep('review'); }}><${Icon} name="arrowL" size=${12} /> Back to review</button></div>
        <h2 style="font-size:17px">Client proposal</h2>
        <p class="muted" style="font-size:13px;margin:2px 0 14px">What the client sees. Internal rates and margins are hidden in this view.</p>
        <button class="btn light" id="btn-prop-clean-mode" style="width:100%;margin-bottom:14px" onClick=${function () { setCleanMode(true); }}><${Icon} name="presentation" /> Presentation mode</button>
        <label class="field"><span>Introduction</span><textarea class="textarea" id="prop-intro" maxlength="2000" rows="5" placeholder=${m.intro} value=${pr.intro || ''} onInput=${function (e) { set('intro', e.target.value); }}></textarea></label>
        <label class="check-line" style="margin-top:12px"><${Switch} id="prop-hours" label="Show hours per line" checked=${pr.showLineHours !== false} onChange=${function (v) { set('showLineHours', v); }} /> Show hours per line</label>
        <label class="field" style="margin-top:12px"><span>Design hours per week (for durations)</span><${Stepper} id="prop-cap" value=${E.num(pr.capacity, 40)} step=${1} min=${1} max=${400} unit="h" label="Hours per week" onChange=${function (v) { set('capacity', v); }} /></label>
        <label class="field" style="margin-top:12px"><span>Valid for</span><${Stepper} id="prop-valid" value=${E.num(pr.validDays, 30)} step=${1} min=${0} max=${365} unit="days" label="Valid for days" onChange=${function (v) { set('validDays', v); }} /></label>
        <button class="btn primary" style="width:100%;margin-top:18px" disabled=${!!p.exporting} onClick=${function () { p.onExport('docx'); }}><${Icon} name="download" /> ${p.exporting === 'docx' ? 'Preparing document…' : 'Download Word document'}</button>
        <button class="btn light" style="width:100%;margin-top:8px" onClick=${function () { window.print(); }} title="Print or save as PDF"><${Icon} name="file" /> Print / PDF</button>
        <p class="opt-hint" style="margin-top:8px">Ready for client review, digital sign-off and exports.</p>
      </aside>
      <div style="min-width:0;width:100%">
        ${cleanMode ? html`<div class="prop-clean-bar">
          <div class="bar-title"><${Icon} name="presentation" /> <span><b>Client Presentation View</b> · Internal margins hidden</span></div>
          <div class="bar-actions">
            <button class="btn sm" onClick=${function () { window.print(); }}><${Icon} name="file" /> Print / PDF</button>
            <button class="btn sm light" onClick=${function () { setCleanMode(false); }}>Show options</button>
            <button class="btn sm" onClick=${function () { p.goStep('review'); }}><${Icon} name="arrowL" /> Back to editor</button>
          </div>
        </div>` : null}
        <article class="paper" aria-label="Proposal preview">
          ${m.agency ? html`<div class="paper-eyebrow">${m.agency}</div>` : null}
          <h1 class="paper-title"><bdi>${m.title}</bdi></h1>
          <p class="paper-meta">${[m.client ? 'Prepared for ' + m.client : '', m.date, m.preparedBy ? 'by ' + m.preparedBy : ''].filter(Boolean).join(' · ')}</p>
          <p class="paper-intro">${m.intro}</p>

          ${m.packages ? html`<h2>Packages</h2><div class="paper-pk">${m.packages.map(function (pk, i) {
            var isSel = selectedTier === i;
            return html`<div key=${i} class=${isSel ? 'selected' : ''} style="cursor:pointer" onClick=${function () { setSelectedTier(selectedTier === i ? null : i); }}>
              <b>${pk.name}</b>
              <span class="n">${hrs(pk.total)}</span>
              <span class="paper-note">${wk(pk.weeks)}${i ? ' · everything in ' + m.packageNames[i - 1] + (pk.added.length ? ', plus ' + pk.added.slice(0, 4).join(', ') + (pk.added.length > 4 ? ' and ' + (pk.added.length - 4) + ' more' : '') : '') : ''}</span>
              <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:700;font-size:13px;color:#0C8468">${E.fmtMoney(pk.totalCost, m.currency)}</span>
                <span class=${'pill ' + (isSel ? 's-approved' : 's-review')} style="font-size:11px">${isSel ? '✓ Active Tier' : 'Compare'}</span>
              </div>
            </div>`;
          })}</div>
          ${selectedTier !== null ? html`<div style="margin:8px 0 16px"><button class="btn sm light" onClick=${function () { setSelectedTier(null); }}><${Icon} name="refresh" size=${12} /> Reset to full scope</button></div>` : null}
          ` : null}

          <h2>Summary</h2>
          <table class="paper-table"><tbody>${m.summary.map(function (r) { return html`<tr key=${r[0]}><td>${r[0]}</td><td class="n">${hrs(r[1])}</td></tr>`; })}<tr class="tot"><td>Total Investment</td><td class="n" style="font-size:16px">${hrs(m.total)} · ${E.fmtMoney(m.totalCost, m.currency)}</td></tr></tbody></table>
          <p class="paper-note">Estimated duration: about ${wk(m.weeks)} at ${E.fmtNum(m.capacity)} design hours per week.</p>

          <h2>Scope</h2>
          ${m.scope.map(function (c) { return html`<div class="paper-cat" key=${c.name}><h3><bdi>${c.name}</bdi>${m.showHours ? html`<span class="n">${hrs(c.hours)}</span>` : null}</h3><ul>${c.items.map(function (it, i) { return html`<li key=${i}><span class="li-head"><bdi>${it.name}</bdi>${it.qty > 1 ? ' ×' + E.fmtNum(it.qty) : ''}${m.packages && it.tier ? html` <span class="mini pk">${m.packageNames[it.tier]}</span>` : null}${m.showHours ? html`<span class="n">${hrs(it.hours)}</span>` : null}</span>${it.description || it.subs.length ? html`<span class="li-sub">${it.description}${it.subs.length ? (it.description ? ' ' : '') + m.labels.subs + ': ' + it.subs.join(', ') + '.' : ''}</span>` : null}</li>`; })}</ul></div>`; })}
          ${m.scope.length ? null : html`<p class="paper-note">No ${lower(m.labels.items)} in scope yet.</p>`}

          <h2>Deliverables</h2><ul>${m.deliverables.map(function (x) { return html`<li key=${x.group}><b><bdi>${x.group}</bdi>:</b> <bdi>${x.text}</bdi></li>`; })}</ul>
          ${m.timeline.length ? html`<h2>Timeline by phase</h2><table class="paper-table"><tbody>${m.timeline.map(function (t) { return html`<tr key=${t.phase}><td>${t.phase}</td><td class="n">${hrs(t.hours)}</td><td class="n">${wk(t.weeks)}</td></tr>`; })}</tbody></table>` : null}

          ${(m.milestones || []).length ? html`<div>
            <h2>Payment milestone schedule</h2>
            <div class="paper-milestones">${m.milestones.map(function (ms) {
              return html`<div class="paper-ms-card" key=${ms.id}>
                <div class="paper-ms-head"><span class="paper-ms-pct">${ms.percent}%</span><span class="paper-ms-val">${E.fmtMoney(Math.round((m.totalCost * ms.percent) / 100), m.currency)}</span></div>
                <div class="paper-ms-name">${ms.name}</div>
              </div>`;
            })}</div>
          </div>` : null}

          ${E.REGISTER_KINDS.map(function (k) { var l = m.register[k.id]; return l.length ? html`<div key=${k.id}><h2>${k.name}</h2><ul>${l.map(function (t, i) { return html`<li key=${i}><bdi>${t}</bdi></li>`; })}</ul></div>` : null; })}
          ${m.outOfScope.length ? html`<h2>Not included</h2><ul>${m.outOfScope.map(function (t, i) { return html`<li key=${i}>${t}</li>`; })}</ul>` : null}

          <h2>Validity and acceptance</h2>
          <p>This estimate is valid for ${m.validDays} days from ${m.date}. Hours and figures are based on the agreed scope above; changes to scope are estimated separately.</p>

          ${isAccepted && d.acceptance && typeof d.acceptance === 'object' ? html`<div class="paper-signed-cert">
            <div class="signed-cert-head"><${Icon} name="sealCheck" size=${22} /> <span>Digitally Accepted & Signed</span></div>
            <dl class="signed-cert-grid">
              <div><dt>Accepted by</dt><dd>${d.acceptance.name || '—'}</dd></div>
              <div><dt>Email</dt><dd>${d.acceptance.email || '—'}</dd></div>
              <div><dt>Organization</dt><dd>${d.acceptance.org || d.client || '—'}</dd></div>
              <div><dt>Signed timestamp</dt><dd>${d.acceptance.timestamp && !isNaN(new Date(d.acceptance.timestamp).getTime()) ? new Date(d.acceptance.timestamp).toLocaleString() : '—'}</dd></div>
              <div><dt>Agreed package</dt><dd>${d.acceptance.package || 'Standard'}</dd></div>
              <div><dt>Contract value</dt><dd>${E.fmtMoney(d.acceptance.totalCost, m.currency)} (${hrs(d.acceptance.totalHours)})</dd></div>
            </dl>
            <div style="margin-top:8px"><button class="btn sm danger" onClick=${revokeSignature}><${Icon} name="refresh" size=${13} /> Revoke / Reopen estimate</button></div>
          </div>` : html`<div class="paper-sign-card">
            <h3>Digital Proposal Acceptance</h3>
            <p>Review the scope above and sign below to accept this proposal and initiate project scheduling.</p>
            <div class="paper-sign-fields">
              <label class="field"><span>Full Name</span><input class="input" id="prop-sign-name" maxlength="100" placeholder="Client Stakeholder Name" value=${signName} onInput=${function (e) { setSignName(e.target.value); }} /></label>
              <label class="field"><span>Work Email</span><input class="input" type="email" id="prop-sign-email" maxlength="120" placeholder="client@company.com" value=${signEmail} onInput=${function (e) { setSignEmail(e.target.value); }} /></label>
              <label class="field"><span>Organization</span><input class="input" id="prop-sign-org" maxlength="100" placeholder="Client Organization" value=${signOrg} onInput=${function (e) { setSignOrg(e.target.value); }} /></label>
            </div>
            <label class="check-line" style="margin-bottom:16px;cursor:pointer">
              <input type="checkbox" id="prop-sign-agree" checked=${agreed} onChange=${function (e) { setAgreed(e.target.checked); }} />
              <span>I confirm acceptance of this project proposal, scope, timeline, milestones, and commercial investment on behalf of <b>${signOrg || 'the client'}</b>.</span>
            </label>
            <button class="btn primary" id="btn-prop-accept" disabled=${!agreed || !signName.trim()} onClick=${signProposal}>
              <${Icon} name="sealCheck" /> Accept & Sign Proposal
            </button>
          </div>`}
        </article>
      </div>
    </div>`;
  }

  // Calibrate the library from what past projects actually took.
  function CalibrateTab(p) {
    var svc = p.svc, labels = p.labels;
    var st = useState(''), text = st[0], setText = st[1];
    var sr = useState(null), res = sr[0], setRes = sr[1];
    var sv = useState({}), vals = sv[0], setVals = sv[1];
    var sf = useState(''), fmt = sf[0], setFmt = sf[1];
    var su = useState(true), useT = su[0], setUseT = su[1];
    var tracked = E.trackedRows(p.ctx.estimates, svc.id);
    var useTr = useT && tracked.projects > 0;
    function run(t, useTracked) {
      var parsed = t && t.trim() ? E.pastRows(E.parseCsv(t)) : { rows: [], format: 'none' };
      var rows = parsed.rows.concat(useTracked ? tracked.rows : []);
      var c = E.calibrate(svc, rows);
      var v = {}; c.items.forEach(function (x) { v[x.id] = { on: Math.abs(x.median - x.current) >= 0.5, base: x.suggestedBase }; });
      setFmt(parsed.format); setRes(Object.assign({ rows: parsed.rows.length, tracked: useTracked ? tracked.projects : 0 }, c)); setVals(v);
    }
    function apply() {
      var n = 0;
      p.mut(function (s) { s.items.forEach(function (it) { var v = vals[it.id]; if (v && v.on) { it.hours = v.base; n++; } }); });
      p.ctx.toast('Updated ' + n + ' ' + lower(plural(n, labels.item, labels.items)) + '. Review, then Save changes.');
      setRes(null); setText('');
    }
    var nOn = Object.keys(vals).filter(function (k) { return vals[k].on; }).length;
    return html`<div class="stack">
      <section class="panel panel-pad">
        <${CardHead} icon="gauge" color="teal" title="Calibrate from past projects" desc=${'Replace placeholder hours with what ' + lower(labels.items) + ' really took. Paste or open a CSV of past work: this tool\'s CSV export, or any sheet with a name column and an hours column (timesheets work too).'} />
        <textarea class="textarea" id="cal-text" rows="6" placeholder=${'Item,Actual hours\nHome,22\nContact,7.5'} value=${text} onInput=${function (e) { setText(e.target.value); }}></textarea>
        <div class="row" style="margin-top:10px;gap:10px">
          <label class="btn sm ghost" style="cursor:pointer"><${Icon} name="file" size=${14} /> Open CSV<input type="file" accept=".csv,.txt,text/csv" class="sr" onChange=${function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; f.text().then(function (t) { setText(t); run(t, useTr); }); e.target.value = ''; }} /></label>
          <span class="spacer"></span>
          <button class="btn primary" disabled=${!text.trim() && !useTr} onClick=${function () { run(text, useTr); }}>Compare with the library</button>
        </div>
      </section>
      <section class="panel panel-pad cal-tracked">
        <${CardHead} icon="check" color="green" title="Tracked estimates" desc=${tracked.projects ? tracked.projects + ' ' + plural(tracked.projects, 'estimate', 'estimates') + ' for this service ' + plural(tracked.projects, 'has', 'have') + ' actual hours (' + tracked.rows.length + ' ' + plural(tracked.rows.length, 'line', 'lines') + '). Actuals are scaled back to quantity 1 at Standard complexity before comparing.' : 'None yet. Record actual hours on an estimate (Review → Actual hours) and they show up here automatically.'}
          right=${tracked.projects ? html`<label class="check-line" style="font-size:13px"><${Switch} id="cal-use-tracked" label="Include tracked estimates" checked=${useT} onChange=${setUseT} /> Include</label>` : null} />
      </section>
      ${res ? html`<section class="panel flush">
        <${CardHead} icon="table" color="blue" title=${res.items.length + ' ' + lower(plural(res.items.length, labels.item, labels.items)) + ' matched'} desc=${(res.rows ? res.rows + ' rows read' + (fmt === 'estimator' ? ' from an estimator export' : '') : '') + (res.rows && res.tracked ? ' plus ' : '') + (res.tracked ? res.tracked + ' tracked ' + plural(res.tracked, 'estimate', 'estimates') : '') + '. Hours are per ' + lower(labels.item) + ', including its ' + lower(labels.subs) + '; the new value replaces the base hours.'} />
        ${res.items.length ? html`<div class="table-wrap"><table class="bd cal">
          <thead><tr><th></th><th>${labels.item}</th><th class="n">Library now</th><th class="n">Past median</th><th class="n">Range</th><th>New base hours</th></tr></thead>
          <tbody>${res.items.map(function (x) { var v = vals[x.id] || {}; var d = x.median - x.current; return html`<tr key=${x.id}>
            <td><input type="checkbox" class="cb" aria-label=${'Update ' + x.name} checked=${!!v.on} onChange=${function () { setVals(function (o) { var c = Object.assign({}, o); c[x.id] = Object.assign({}, v, { on: !v.on }); return c; }); }} /></td>
            <td><bdi>${x.name}</bdi> <span class="paren">(${x.samples} ${plural(x.samples, 'project', 'projects')})</span></td>
            <td class="n">${E.fmtHours(x.current)}</td>
            <td class=${'n ' + (d > 0.25 ? 'up' : d < -0.25 ? 'down' : '')}>${E.fmtHours(x.median)}</td>
            <td class="n muted">${x.samples > 1 ? E.fmtNum(E.round(x.min, 1)) + '–' + E.fmtHours(E.round(x.max, 1)) : '—'}</td>
            <td><${Stepper} value=${E.num(v.base)} label=${x.name + ' new base hours'} unit="h" onChange=${function (n) { setVals(function (o) { var c = Object.assign({}, o); c[x.id] = Object.assign({}, v, { base: n, on: true }); return c; }); }} />${x.subs ? html`<span class="hint">+ ${E.fmtHours(x.subs)} ${lower(labels.subs)}</span>` : null}</td>
          </tr>`; })}</tbody></table></div>` : null}
        ${res.unmatched.length ? html`<p class="opt-hint" style="padding:12px 20px">Not matched (${res.unmatched.length}): ${res.unmatched.slice(0, 12).join(', ')}${res.unmatched.length > 12 ? '…' : ''}. Rename them to match the library, or add them as ${lower(labels.items)} first.</p>` : null}
        <div class="row" style="padding:12px 20px;border-top:1px solid var(--line)"><span class="spacer"></span><button class="btn primary" disabled=${!nOn} onClick=${apply}>Update ${nOn} ${lower(plural(nOn, labels.item, labels.items))}</button></div>
      </section>` : null}
    </div>`;
  }
