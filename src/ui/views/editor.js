// ================================================================== estimate editor
  function EstimateEditor(p) {
    var ctx = p.ctx, route = ctx.route, id = route.id;
    var remote = ctx.estimates ? ctx.estimates.filter(function (e) { return e.id === id; })[0] : null;
    var sd = useState(function () { return remote ? Object.assign(norm(remote), { id: id }) : (route.initial ? Object.assign(norm(route.initial), { id: id }) : null); });
    var raw = sd[0], setDraft = sd[1];
    var draft = useMemo(function () { return raw ? E.normalize(raw) : null; }, [raw]);
    var sv = useState('saved'), save = sv[0], setSave = sv[1];
    var sx = useState(null), exporting = sx[0], setExporting = sx[1];
    var sg = useState(false), gone = sg[0], setGone = sg[1];
    // latest: what you see; base: the last version known to be in the store (for merging a teammate's save);
    // mine: updatedAt stamps of our own writes, so their echo is not mistaken for someone else's change.
    var latest = useRef(raw), base = useRef(raw ? E.clone(raw) : null), mine = useRef([]);
    var timer = useRef(null), dirty = useRef(false), seen = useRef(!!remote), paused = useRef(false), goneRef = useRef(false);

    function schedule() {
      dirty.current = true; setSave('pending');
      clearTimeout(timer.current); timer.current = setTimeout(function () { flushRef.current(); }, 650);
    }
    var flushRef = useRef(null);

    useEffect(function () {
      if (!remote) {
        if (!seen.current || ctx.estimates === null || goneRef.current) return;
        // It left the live list. Hold autosave and check the store before treating it as deleted,
        // so an edit can never silently bring back an estimate a teammate removed.
        paused.current = true;
        var alive = true;
        Promise.resolve().then(function () { return ctx.caps.db.doc('estimates/' + id).get(); }).then(function (snap) {
          if (!alive) return;
          if (snap && snap.exists) { paused.current = false; if (dirty.current && !timer.current) schedule(); return; }
          clearTimeout(timer.current); timer.current = null;
          goneRef.current = true; setGone(true);
        }, function () { if (alive) { paused.current = false; if (dirty.current && !timer.current) schedule(); } });
        return function () { alive = false; };
      }
      seen.current = true;
      var resumed = paused.current || goneRef.current;
      paused.current = false;
      if (goneRef.current) { goneRef.current = false; setGone(false); }
      var r = Object.assign(norm(remote), { id: id });
      if (!latest.current) { latest.current = r; base.current = E.clone(r); setDraft(r); return; }
      if (mine.current.indexOf(r.updatedAt) >= 0) { base.current = r; if (resumed && dirty.current && !timer.current) schedule(); return; }
      if (base.current && sameJ(r, base.current)) { if (resumed && dirty.current && !timer.current) schedule(); return; }
      if (!dirty.current) { latest.current = r; base.current = E.clone(r); setDraft(r); return; }
      // You have unsaved edits and a teammate saved: keep everything you changed, take the rest from them.
      var m = merge3(base.current || {}, latest.current, r);
      if (!isPlain(m)) m = E.clone(latest.current);
      base.current = r;
      m.id = id; m.updatedAt = Date.now(); m.updatedBy = (ctx.me && ctx.me.id) || m.updatedBy || null;
      latest.current = m; setDraft(m); schedule();
    }, [remote]);

    var flush = useCallback(async function () {
      timer.current = null;
      var d = latest.current; if (!d || goneRef.current || paused.current) return;
      setSave('saving');
      var r = E.compute(d);
      var data = clean(Object.assign({}, d, { totalHours: E.round(r.total, 1), totalCost: r.totalCost }));
      mine.current.push(data.updatedAt); if (mine.current.length > 40) mine.current.shift();
      var ok = await ctx.api.set('estimates/' + id, data);
      if (!timer.current) {
        if (ok && latest.current === d) dirty.current = false;
        setSave(ok ? (dirty.current ? 'pending' : 'saved') : 'error');
      }
    }, [id, ctx.api]);
    flushRef.current = flush;
    useEffect(function () {
      // save straight away when the tab is hidden or closed, and when leaving the editor
      function onHide(e) { if ((e.type === 'pagehide' || document.visibilityState === 'hidden') && timer.current) { clearTimeout(timer.current); flush(); } }
      document.addEventListener('visibilitychange', onHide); window.addEventListener('pagehide', onHide);
      return function () {
        document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide);
        if (timer.current) { clearTimeout(timer.current); flush(); }
      };
    }, [flush]);

    var change = useCallback(function (fn) {
      if (ctx.readOnly) { ctx.toast('You have view-only access, so changes are not saved.', 'bad'); return; }
      if (!latest.current) return;
      var n = E.clone(latest.current);
      fn(n);
      n.updatedAt = Date.now(); n.updatedBy = (ctx.me && ctx.me.id) || n.updatedBy || null;
      latest.current = n; setDraft(n);
      if (goneRef.current) { dirty.current = true; return; }
      schedule();
    }, [flush, ctx.readOnly, ctx.me]);

    function restore() {
      if (!latest.current) return;
      goneRef.current = false; paused.current = false; setGone(false);
      var n = E.clone(latest.current); n.updatedAt = Date.now();
      latest.current = n; setDraft(n); dirty.current = true;
      clearTimeout(timer.current); timer.current = null; flush();
    }

    if (!draft) {
      if (ctx.estimates === null) return html`<div class="panel panel-pad" aria-busy="true"><div class="skeleton" style="width:40%"></div></div>`;
      return html`<div class="panel"><div class="empty"><h2>This estimate isn't available</h2><p>It may have been deleted, or you no longer have access to it.</p>
        <button class="btn" onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}><${Icon} name="arrowL" /> Back to estimates</button></div></div>`;
    }

    var step = route.step === 'proposal' || STEPS.some(function (s) { return s.id === route.step; }) ? route.step : 'scope';
    var service = ctx.services ? ctx.services[draft.serviceId] : null;
    var labels = E.labelsOf(draft);
    var res = E.compute(draft);
    function goStep(s) { ctx.setRoute({ view: 'estimate', id: id, step: s }); }

    async function doExport(kind) {
      if (exporting) return;
      setExporting(kind);
      try {
        if (kind === 'csv') await saveFile(ctx, fileBase(draft) + '.csv', new Blob([E.buildCsv(draft)], { type: 'text/csv' }));
        else if (kind === 'docx') {
          var D = await loadDocx();
          var blob = await E.buildDocx(D, draft, { agency: ctx.settings.agencyName || '', preparedBy: (ctx.me && ctx.me.name) || '', date: today() });
          await saveFile(ctx, fileBase(draft).replace(/-hours$/, '') + '-proposal.docx', blob);
        } else {
          var X = await loadExcel();
          var buf = await E.buildXlsx(X, draft, { agency: ctx.settings.agencyName || '', preparedBy: (ctx.me && ctx.me.name) || '', date: today() });
          await saveFile(ctx, fileBase(draft) + '.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        }
      } catch (e) { ctx.toast((e && e.message) || 'The file could not be created.', 'bad'); }
      finally { setExporting(null); }
    }

    var stepIdx = step === 'proposal' ? STEPS.length : STEPS.findIndex(function (s) { return s.id === step; });
    var body;
    if (step === 'service') body = html`<${ServiceStep} ctx=${ctx} draft=${draft} change=${change} goStep=${goStep} />`;
    else if (step === 'scope') body = html`<${ScopeStep} draft=${draft} res=${res} change=${change} labels=${labels} />`;
    else if (step === 'build') body = html`<${BuildStep} ctx=${ctx} draft=${draft} res=${res} change=${change} service=${service} labels=${labels} />`;
    else if (step === 'proposal') body = html`<${ProposalView} ctx=${ctx} draft=${draft} change=${change} onExport=${doExport} exporting=${exporting} goStep=${goStep} />`;
    else body = html`<${ReviewStep} ctx=${ctx} id=${id} draft=${draft} res=${res} change=${change} service=${service} labels=${labels} onExport=${doExport} exporting=${exporting} goStep=${goStep} />`;

    var saveLabel = gone ? 'Not saved' : save === 'saving' || save === 'pending' ? 'Saving…' : save === 'error' ? 'Not saved' : 'Saved';
    return html`<div class="editor">
      <h1 class="sr">${nm(draft.name, 'Untitled estimate')}</h1>
      ${gone ? html`<div class="banner bad with-actions" role="alert" style="margin-bottom:16px"><${Icon} name="alert" />
        <div class="grow"><b>This estimate was deleted by someone else.</b> Edits you make here are not being saved. Restore it to keep working on it.</div>
        <div class="banner-actions"><button class="btn sm" onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}>Back to estimates</button><button class="btn sm primary" onClick=${restore}>Restore it</button></div>
      </div>` : null}
      <div class="crumbs"><button onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}>Estimates</button><${Icon} name="chevR" size=${12} /><span><bdi>${draft.serviceName}</bdi></span></div>
      <div class="ed-head">
        <div class="ed-title">
          <${TitleText} cls="title-input" id="est-name" max="200" label="Estimate name" value=${draft.name} placeholder="Untitled estimate" onInput=${function (v) { change(function (n) { n.name = v; }); }} />
          <input class="client-input" id="est-client" maxlength="200" aria-label="Client" value=${draft.client} placeholder="Add client name" onInput=${function (e) { var v = e.target.value; change(function (n) { n.client = v; }); }} />
        </div>
        <div class="ed-meta">
          <button class="btn sm light" id="btn-toggle-client-mode" title=${step === 'proposal' ? 'Back to Editor' : 'Client Proposal View (Internal margins hidden)'} onClick=${function () { goStep(step === 'proposal' ? 'review' : 'proposal'); }}>
            <${Icon} name=${step === 'proposal' ? 'arrowL' : 'presentation'} size=${14} /> ${step === 'proposal' ? 'Editor View' : 'Client Mode'}
          </button>
          <span class=${'savestate ' + (save === 'error' || gone ? 'error' : '')} aria-live="polite"><${Icon} name=${save === 'error' || gone ? 'alert' : save === 'saved' ? 'check' : 'refresh'} size=${14} />${saveLabel}</span>
          <label class="sr" for="est-status">Status</label>
          <select class="select status-select" id="est-status" value=${draft.status || 'draft'} onChange=${function (e) { var v = e.target.value; change(function (n) { n.status = v; }); }}>
            ${E.STATUSES.map(function (s) { return html`<option value=${s.id}>${s.name}</option>`; })}
            ${statusOf(draft.status).id === 'other' ? html`<option value=${draft.status}>${statusOf(draft.status).name}</option>` : null}
          </select>
        </div>
      </div>
      <nav class="steps" aria-label="Estimate steps">
        ${STEPS.map(function (s, i) {
          return html`<button class=${'step' + (i < stepIdx ? ' done' : '')} key=${s.id} aria-current=${s.id === step ? 'step' : null} onClick=${function () { goStep(s.id); }}><span class="n">${i < stepIdx ? html`<${Icon} name="check" size=${12} sw=${2.4} />` : s.n}</span>${s.name}</button>`;
        })}
      </nav>
      ${step === 'proposal' ? html`<div class="ed-main">${body}</div>` : html`<div class="ed-body">
        <div class="ed-main">${body}</div>
        <${Inspector} draft=${draft} res=${res} step=${step} goStep=${goStep} onExport=${doExport} exporting=${exporting} labels=${labels} />
      </div>`}
    </div>`;
  }

  // ------------------------------------------------------------------ inspector
  function Inspector(p) {
    var so = useState(false), open = so[0], setOpen = so[1];
    var res = p.res, draft = p.draft;
    var idx = STEPS.findIndex(function (s) { return s.id === p.step; });
    var prev = STEPS[idx - 1], next = STEPS[idx + 1];
    var dl = E.deliverables(draft, res);
    return html`<aside class=${'inspector' + (open ? ' open' : '')} aria-label="Estimate summary">
      <div class="panel insp-card">
        <div class="insp-head">
          <div class="eyebrow insp-label">Total estimate</div>
          <div class="insp-total"><span class="num">${E.fmtNum(E.round(res.total, 1))}</span><span class="u">h</span></div>
          <div class="insp-cost-badge">${E.fmtMoney(res.totalCost, res.currency)} <span class="rate-sub">· ${E.fmtMoney(res.hourlyRate, res.currency)}/h</span></div>
          ${res.marginPercent !== null && res.marginPercent !== undefined ? html`<div class="insp-margin-badge" style="display:inline-block;margin-top:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:var(--green-sub, rgba(46,125,50,0.12));color:var(--green, #2e7d32)">Margin: ${res.marginPercent}% (${E.fmtMoney(res.grossProfit, res.currency)})</div>` : null}
          <div class="insp-sub">About ${E.fmtNum(E.round(res.total / 40, 1))} designer-weeks at 40h a week</div>
        </div>
        <button class="btn sm ghost insp-toggle" aria-expanded=${open ? 'true' : 'false'} onClick=${function () { setOpen(!open); }}>${open ? 'Hide' : 'Details'}</button>
        <dl class="insp-lines">
          <dt>Base design</dt><dd>${E.fmtHours(E.round(res.base, 1))}</dd>
          <dt>Adaptations & add-ons</dt><dd>${E.fmtHours(E.round(res.adaptations, 1))}</dd>
          <dt>Project overhead</dt><dd>${E.fmtHours(E.round(res.overhead, 1))}</dd>
          <dt>Buffer ${E.fmtNum(res.bufferPercent)}%</dt><dd>${E.fmtHours(E.round(res.buffer, 1))}</dd>
        </dl>
        <div class="insp-count">${dl[0] ? dl[0].text : ''}</div>
        <div class="insp-nav">
          ${prev ? html`<button class="btn" onClick=${function () { p.goStep(prev.id); }}><${Icon} name="arrowL" /><span>${prev.name}</span></button>` : null}
          ${next ? html`<button class="btn primary" onClick=${function () { p.goStep(next.id); }}><span>${next.name}</span><${Icon} name="arrowR" /></button>` : null}
        </div>
        <div class="insp-export">
          <button class="btn sm" disabled=${!!p.exporting} onClick=${function () { p.onExport('csv'); }}><${Icon} name="download" size=${14} />${p.exporting === 'csv' ? 'Exporting…' : 'CSV'}</button>
          <button class="btn sm" disabled=${!!p.exporting} onClick=${function () { p.onExport('xlsx'); }}><${Icon} name="download" size=${14} />${p.exporting === 'xlsx' ? 'Exporting…' : 'XLSX'}</button>
        </div>
      </div>
    </aside>`;
  }

  // ------------------------------------------------------------------ step: service
  function ServiceStep(p) {
    var ctx = p.ctx, draft = p.draft;
    var active = (ctx.serviceList || []).filter(function (s) { return s.active || s.id === draft.serviceId; });
    function pick(svc) {
      if (svc.id === draft.serviceId) { p.goStep('scope'); return; }
      ctx.confirm({
        title: 'Switch to ' + svc.name + '?',
        body: 'This clears the scope options and the ' + lower(E.labelsOf(draft).items) + ' you have added. Custom deliverables, overhead, buffer and the assumptions register stay.',
        confirmLabel: 'Switch service', danger: true,
        onConfirm: function () {
          var fresh = E.createEstimate(svc, svc.id, ctx.settings, {});
          p.change(function (n) {
            n.serviceId = svc.id; n.serviceName = svc.name; n.snapshot = fresh.snapshot; n.scope = fresh.scope;
            n.items = []; n.dismissedSuggestions = []; n.hiddenAuto = [];
          });
          p.goStep('scope');
        },
      });
    }
    return html`<section class="panel panel-pad">
        <${CardHead} icon="layers" color="green" title="Service" desc="The service decides which scope options and building blocks are available." />
        <div class="svc-grid">${active.map(function (svc) {
          var on = svc.id === draft.serviceId;
          return html`<button class="svc-card" key=${svc.id} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { pick(svc); }}>
            <${SvcTile} svc=${svc} size="lg" />
            <span class="t"><span class="svc-name">${svc.name}</span><span class="svc-desc">${svc.description}</span>
              <span class="svc-stats">${on ? html`<span class="hrs">Selected</span>` : serviceStats(svc).map(function (t) { return html`<span class="tag" key=${t}>${t}</span>`; })}</span>
            </span>
          </button>`;
        })}</div>
        ${!ctx.services || ctx.services[draft.serviceId] ? null : html`<div class="banner warn" style="margin-top:14px"><${Icon} name="alert" /><div class="grow">${draft.serviceName} is no longer in the library. This estimate keeps its own copy of the rates and items.</div></div>`}
      </section>`;
  }

  // ------------------------------------------------------------------ step: scope
  function ScopeStep(p) {
    var draft = p.draft, res = p.res, labels = p.labels;
    var groups = (draft.snapshot && draft.snapshot.optionGroups) || [];
    function lineFor(oid) { return res.optionLines.filter(function (l) { return l.optionId === oid; })[0]; }
    function setVal(oid, v) { p.change(function (n) { n.scope = n.scope || {}; n.scope.values = n.scope.values || {}; n.scope.values[oid] = v; }); }
    function setChoice(gid, oid) { p.change(function (n) { n.scope = n.scope || {}; n.scope.choice = n.scope.choice || {}; n.scope.choice[gid] = oid; }); }

    function single(g) {
      var chosen = E.chosenOption(g, draft.scope);
      var opts = g.options || [];
      function onKey(e) {
        var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d || !opts.length) return;
        e.preventDefault();
        var i = Math.max(0, opts.findIndex(function (o) { return o.id === chosen; }));
        var nx = opts[(i + d + opts.length) % opts.length], el = e.currentTarget;
        setChoice(g.id, nx.id);
        setTimeout(function () { var b = el.querySelector('[data-id="' + nx.id + '"]'); if (b) b.focus(); }, 30);
      }
      return html`<div class="choice-list" role="radiogroup" aria-label=${g.name} onKeyDown=${onKey}>
        ${opts.map(function (o) {
          var on = chosen === o.id, l = lineFor(o.id), hint = E.ruleHint(o, labels, true);
          return html`<button type="button" class="choice" key=${o.id} data-id=${o.id} role="radio" aria-checked=${on ? 'true' : 'false'} tabindex=${on ? '0' : '-1'} onClick=${function () { setChoice(g.id, o.id); }}>
            <span class="dot"></span>
            <span class="opt-main"><span class="opt-name">${o.name}</span>${hint ? html`<span class="opt-hint">${hint}</span>` : null}</span>
            ${on && l && l.hours > 0 ? html`<${Hrs} v=${l.hours} />` : null}
          </button>`;
        })}
      </div>`;
    }
    function multi(g) {
      return html`<div class="opt-list">
        ${(g.options || []).map(function (o) {
          var v = E.optionValue(g, o, draft.scope), l = lineFor(o.id), hint = E.ruleHint(o, labels, false);
          var ctl;
          if (o.locked && o.input !== 'quantity') ctl = html`<span class="locked"><${Icon} name="lock" size=${13} />Always included</span>`;
          else if (o.input === 'quantity') ctl = html`<${Stepper} id=${'opt-' + o.id} step=${1} min=${E.num(o.min, 0)} max=${E.num(o.max, 99)} value=${v} label=${o.name} onChange=${function (n) { setVal(o.id, n); }} />`;
          else ctl = html`<${Switch} id=${'opt-' + o.id} label=${o.name} checked=${v} onChange=${function (n) { setVal(o.id, n); }} />`;
          return html`<div class="opt-row" key=${o.id}>
            <div class="opt-main">
              <div class="opt-name">${o.name}${l && l.hours > 0 ? html`<${Hrs} v=${l.hours} />` : null}</div>
              ${hint ? html`<div class="opt-hint">${hint}</div>` : null}
              ${o.description ? html`<div class="opt-desc">${o.description}</div>` : null}
            </div>
            ${ctl}
          </div>`;
        })}
      </div>`;
    }
    var cds = draft.customDeliverables || [];
    function updCd(key, fn) { p.change(function (n) { var c = (n.customDeliverables || []).filter(function (x) { return x.key === key; })[0]; if (c) fn(c); }); }
    return html`<div class="scope-grid">
      ${groups.map(function (g, gi) {
        var gs = groupStyle(g, gi);
        return html`<section class="panel panel-pad" key=${g.id}>
          <${CardHead} icon=${gs.icon} color=${gs.color} title=${g.name} desc=${g.description} />
          ${g.selection === 'single' ? single(g) : multi(g)}
        </section>`;
      })}
      <section class="panel panel-pad">
        <${CardHead} icon="plus" color="pink" title="Custom deliverables" desc="Anything not listed above, with your own hours." />
        <div class="custom-rows">
          ${cds.map(function (c) {
            return html`<div class="custom-row" key=${c.key}>
              <input class="input sm" id=${'cd-' + c.key} maxlength="200" aria-label="Deliverable name" placeholder="e.g. Brand workshop" value=${c.name} autofocus=${!c.name}
                onInput=${function (e) { var v = e.target.value; updCd(c.key, function (x) { x.name = v; }); }} />
              <${Stepper} step=${1} min=${1} max=${99} value=${E.num(c.qty, 1)} label="Quantity" unit="×" onChange=${function (v) { updCd(c.key, function (x) { x.qty = v; }); }} />
              <${Stepper} value=${E.num(c.hours)} label="Hours each" unit="h" onChange=${function (v) { updCd(c.key, function (x) { x.hours = v; }); }} />
              <button type="button" class="icon-btn danger" aria-label=${'Remove ' + (c.name || 'deliverable')} onClick=${function () { p.change(function (n) { n.customDeliverables = n.customDeliverables.filter(function (x) { return x.key !== c.key; }); }); }}><${Icon} name="trash" /></button>
            </div>`;
          })}
          <div><button type="button" class="btn sm" onClick=${function () { p.change(function (n) { n.customDeliverables = (n.customDeliverables || []).concat({ key: E.uid('c'), name: '', qty: 1, hours: 4 }); }); }}><${Icon} name="plus" /> Add custom deliverable</button></div>
        </div>
      </section>
    </div>`;
  }

  // ------------------------------------------------------------------ step: build
  function BuildStep(p) {
    var ctx = p.ctx, draft = p.draft, res = p.res, service = p.service, labels = p.labels;
    var sq = useState(''), q = sq[0], setQ = sq[1];
    var so = useState(false), onlySel = so[0], setOnlySel = so[1];
    var se = useState({}), open = se[0], setOpen = se[1];
    var si = useState({}), info = si[0], setInfo = si[1];
    var sa = useState(false), allSugg = sa[0], setAllSugg = sa[1];
    var sc = useState({ name: '', hours: 4, cat: 'custom' }), cform = sc[0], setCform = sc[1];

    var byLib = {}; draft.items.forEach(function (it) { if (it.libId) byLib[it.libId] = it; });
    var resByKey = {}; res.items.forEach(function (x) { resByKey[x.item.key] = x; });
    var cats = service ? (service.categories || []) : [];
    var catIds = cats.map(function (c) { return c.id; });
    var suggestions = E.gapSuggestions(draft, service);
    var ql = q.trim().toLowerCase();
    var isAdmin = ctx.role === 'admin';

    function addLib(li) {
      var it = E.copyItem(service, li, draft);
      p.change(function (n) { n.items.push(it); });
      if (it.subs.length) setOpen(function (o) { var c = Object.assign({}, o); c[it.key] = true; return c; });
    }
    function removeItem(it) {
      var snapshot = E.clone(it), idx = draft.items.findIndex(function (x) { return x.key === it.key; });
      p.change(function (n) { n.items = n.items.filter(function (x) { return x.key !== it.key; }); });
      ctx.toast('Removed ' + it.name, null, { label: 'Undo', fn: function () { p.change(function (n) { if (!n.items.some(function (x) { return x.key === snapshot.key; })) n.items.splice(Math.min(idx, n.items.length), 0, snapshot); }); } });
    }
    function addPack(pack) {
      var added = 0;
      p.change(function (n) {
        (pack.items || []).forEach(function (lid) {
          if (n.items.some(function (i) { return i.libId === lid; })) return;
          var li = (service.items || []).filter(function (x) { return x.id === lid; })[0];
          if (li) { n.items.push(E.copyItem(service, li, n)); added++; }
        });
      });
      ctx.toast(added ? 'Added ' + added + ' ' + lower(plural(added, labels.item, labels.items)) + ' from ' + pack.name : 'Everything in ' + pack.name + ' is already added');
    }
    function acceptSuggestion(s) {
      if (s.kind === 'item') { var li = (service.items || []).filter(function (x) { return x.id === s.ref; })[0]; if (li) addLib(li); return; }
      p.change(function (n) {
        var g = n.snapshot.optionGroups.filter(function (x) { return x.id === s.group; })[0];
        var o = g && g.options.filter(function (x) { return x.id === s.ref; })[0];
        if (!g || !o) return;
        if (g.selection === 'single') { n.scope.choice = n.scope.choice || {}; n.scope.choice[g.id] = o.id; }
        else if (o.input === 'quantity') { n.scope.values[o.id] = Math.max(E.num(n.scope.values[o.id]), E.num(o.free) + 1); }
        else n.scope.values[o.id] = true;
      });
      ctx.toast('Turned on ' + s.label);
    }
    function dismiss(s) { p.change(function (n) { n.dismissedSuggestions = (n.dismissedSuggestions || []).concat(s.id); }); }

    async function saveToLibrary(it) {
      var live = ctx.services && ctx.services[draft.serviceId];
      if (!live) { ctx.toast('This service is no longer in the library.', 'bad'); return; }
      var svc = E.clone(live);
      var cat = (svc.categories || []).some(function (c) { return c.id === it.categoryId; }) ? it.categoryId : null;
      if (!cat) { if (!(svc.categories || []).some(function (c) { return c.id === 'custom'; })) svc.categories.push({ id: 'custom', name: 'Custom' }); cat = 'custom'; }
      var newLib = uniqueId(it.name, svc.items.map(function (x) { return x.id; }));
      var defaultSubs = [];
      (it.subs || []).forEach(function (s) {
        if (s.libId && svc.subItems.some(function (x) { return x.id === s.libId; })) { defaultSubs.push(s.libId); return; }
        var sid = uniqueId(s.name, svc.subItems.map(function (x) { return x.id; }));
        svc.subItems.push({ id: sid, name: s.name, hours: E.num(s.hours), description: '', includes: '', excludes: '' });
        defaultSubs.push(sid);
      });
      svc.items.push({ id: newLib, categoryId: cat, name: it.name, hours: E.num(it.hours), defaultSubs: defaultSubs, allowMultiple: !!it.allowMultiple, description: it.description || '', includes: it.includes || '', excludes: it.excludes || '' });
      var ok = await ctx.api.set('services/' + draft.serviceId, clean(svc));
      if (ok) {
        p.change(function (n) {
          var t = n.items.filter(function (x) { return x.key === it.key; })[0];
          if (t) { t.libId = newLib; t.custom = false; t.categoryId = cat; t.categoryName = E.categoryName(svc, cat); (t.subs || []).forEach(function (s, i) { if (!s.libId) s.libId = defaultSubs[i]; }); }
        });
        ctx.toast('Added ' + it.name + ' to the ' + svc.name + ' library');
      }
    }

    function matches(name, catName) { return !ql || lower(name).indexOf(ql) >= 0 || lower(catName).indexOf(ql) >= 0; }
    function row(li, it) {
      var key = it ? it.key : li.id, src = it || li, selected = !!it;
      var x = it ? resByKey[it.key] : null;
      var hours = selected ? (x ? x.total : 0) : E.libItemHours(service, li);
      var nsub = selected ? (it.subs || []).length : (li.defaultSubs || []).length;
      var wont = selected && it.priority === 'wont';
      var expanded = selected && !!open[it.key];
      var hasDef = src.description || src.includes || src.excludes;
      var phases = draft.snapshot.phases || [];
      var badges = [];
      if (selected) {
        if (it.complexity && it.complexity !== 'standard') { var cxn = (draft.snapshot.complexity || []).filter(function (c) { return c.id === it.complexity; }).map(function (c) { return c.name; })[0] || it.complexity; badges.push(html`<span class="mini cx" key="cx" title=${cxn}>${cxn}</span>`); }
        if (it.priority && it.priority !== 'must') badges.push(html`<span class=${'mini ' + it.priority} key="pr">${(E.PRIORITIES.filter(function (q2) { return q2.id === it.priority; })[0] || {}).short}</span>`);
        if (E.packagesOf(draft).enabled && E.tierOf(it) > 0) badges.push(html`<span class="mini pk" key="pk" title=${'From the ' + E.packagesOf(draft).names[E.tierOf(it)] + ' package'}>${E.packagesOf(draft).names[E.tierOf(it)]}${E.tierOf(it) < 2 ? '+' : ''}</span>`);
        if ((it.reqs || []).length) badges.push(html`<span class="mini rq" key="rq" title=${(it.reqs || []).join(', ')}>${(it.reqs || []).length === 1 ? it.reqs[0] : it.reqs.length + ' reqs'}</span>`);
        if (it.phase && phases.length > 1 && it.phase !== phases[0]) badges.push(html`<span class="mini ph" key="ph" title=${it.phase}>${it.phase}</span>`);
      }
      var detail = [];
      if (nsub) detail.push(nsub + ' ' + lower(plural(nsub, labels.sub, labels.subs)));
      if (it && it.custom) detail.push('custom');
      return html`<div key=${key}>
        <div class=${'lib-row' + (selected ? ' sel' : '') + (wont ? ' wont' : '')}>
          <label class="lib-main">
            <input type="checkbox" class="cb" id=${'pick-' + key} checked=${selected} onChange=${function () { if (selected) removeItem(it); else addLib(li); }} />
            <span class="lib-text">
              <span class="lib-name"><bdi>${src.name}</bdi>${it && it.qty > 1 ? html`<span class="qty-badge">×${it.qty}</span>` : null}${detail.length ? html`<span class="lib-sub"> (${detail.join(', ')})</span>` : null}</span>
              ${badges.length ? html`<span class="lib-meta">${badges}</span>` : null}
            </span>
          </label>
          ${hasDef ? html`<button type="button" class="icon-btn" aria-label=${'What ' + src.name + ' covers'} aria-expanded=${info[key] ? 'true' : 'false'} onClick=${function () { setInfo(function (s) { var c = Object.assign({}, s); c[key] = !s[key]; return c; }); }}><${Icon} name="info" /></button>` : null}
          <${Hrs} v=${hours} ghost=${!selected || wont} />
          ${selected ? html`<button type="button" class="icon-btn chev" aria-label=${(expanded ? 'Close ' : 'Edit ') + src.name} aria-expanded=${expanded ? 'true' : 'false'} onClick=${function () { setOpen(function (o) { var c = Object.assign({}, o); c[it.key] = !o[it.key]; return c; }); }}><${Icon} name="chevD" /></button>` : html`<span class="icon-btn" aria-hidden="true"></span>`}
        </div>
        ${info[key] ? html`<div class="def">
          ${src.description ? html`<span>${src.description}</span>` : null}
          ${E.lines(src.includes).length ? html`<span><b>Includes:</b> ${E.lines(src.includes).join('; ')}</span>` : null}
          ${E.lines(src.excludes).length ? html`<span><b>Excludes:</b> ${E.lines(src.excludes).join('; ')}</span>` : null}
        </div>` : null}
        ${expanded ? html`<${ItemPanel} it=${it} x=${x} draft=${draft} service=${service} labels=${labels} change=${p.change} onRemove=${function () { removeItem(it); }} isAdmin=${isAdmin} onSaveToLibrary=${saveToLibrary} />` : null}
      </div>`;
    }

    var sections = cats.map(function (c) {
      var libs = (service.items || []).filter(function (li) { return li.categoryId === c.id; });
      var customs = draft.items.filter(function (it) { return !it.libId && it.categoryId === c.id; });
      return { id: c.id, name: c.name, libs: libs, customs: customs };
    });
    var orphans = draft.items.filter(function (it) { return (it.libId && (!service || !(service.items || []).some(function (li) { return li.id === it.libId; }))) || (!it.libId && catIds.indexOf(it.categoryId) < 0); });
    if (orphans.length) sections.push({ id: '_other', name: service ? 'Custom' : 'In this estimate', libs: [], customs: orphans });

    var visibleSugg = allSugg ? suggestions : suggestions.slice(0, 3);
    var packs = service ? (service.starterPacks || []) : [];
    return html`
      ${!service ? html`<div class="banner warn"><${Icon} name="alert" /><div class="grow">${draft.serviceName} is no longer in the library, so only the ${lower(labels.items)} already in this estimate are shown.</div></div>` : null}
      ${ctx.sample && service ? html`<${BriefPanel} ctx=${ctx} draft=${draft} service=${service} change=${p.change} labels=${labels} />` : null}
      <div class="build-tools">
        <label class="search"><span class="sr">Search ${lower(labels.items)}</span><${Icon} name="search" />
          <input class="input" id="build-search" maxlength="100" placeholder=${'Search ' + lower(labels.items)} value=${q} onInput=${function (e) { setQ(e.target.value); }} />
        </label>
        <button class="chip" aria-pressed=${onlySel ? 'true' : 'false'} onClick=${function () { setOnlySel(!onlySel); }}>Selected only <span class="count">${draft.items.length}</span></button>
      </div>
      ${packs.length ? html`<div class="packs"><span class="eyebrow">Starter packs</span>${packs.map(function (pk) {
        return html`<button class="chip" key=${pk.id} title=${pk.description || ''} onClick=${function () { addPack(pk); }}><${Icon} name="pack" size=${14} />${pk.name}<span class="count">${(pk.items || []).length}</span></button>`;
      })}</div>` : null}
      ${suggestions.length ? html`<section class="panel suggest" aria-label="Suggestions">
        <div class="suggest-head"><${Tile} size="sm" icon="bulb" color="yellow" />${suggestions.length} ${plural(suggestions.length, 'suggestion', 'suggestions')} based on what you've added</div>
        <div class="suggest-list">${visibleSugg.map(function (s) {
          return html`<div class="suggest-item" key=${s.id}>
            <div class="suggest-text"><b>${s.label}</b> <span>(${s.message || ('Often goes with ' + s.trigger)})</span></div>
            <button class="btn sm" onClick=${function () { acceptSuggestion(s); }}><${Icon} name="plus" size=${14} />${s.kind === 'item' ? 'Add' : 'Turn on'}</button>
            <button class="btn sm ghost" onClick=${function () { dismiss(s); }}>Dismiss</button>
          </div>`;
        })}</div>
        ${suggestions.length > 3 ? html`<button class="link" style="margin-top:6px" onClick=${function () { setAllSugg(!allSugg); }}>${allSugg ? 'Show fewer' : 'Show all ' + suggestions.length}</button>` : null}
      </section>` : null}
      ${sections.map(function (sec, si2) {
        var rows = [];
        sec.libs.forEach(function (li) { var it = byLib[li.id]; if (onlySel && !it) return; if (!matches(li.name, sec.name)) return; rows.push(row(li, it || null)); });
        sec.customs.forEach(function (it) { if (!matches(it.name, sec.name)) return; rows.push(row(null, it)); });
        if (!rows.length) return null;
        var selItems = draft.items.filter(function (it) { return (it.libId && sec.libs.some(function (li) { return li.id === it.libId; })) || sec.customs.indexOf(it) >= 0; });
        var selHours = selItems.reduce(function (s, it) { var x = resByKey[it.key]; return s + (x && x.included ? x.total : 0); }, 0);
        return html`<section class="panel cat" key=${sec.id}>
          <div class="cat-head"><${Tile} size="sm" icon="folder" color=${sec.id === '_other' ? 'pink' : catColor(si2)} /><h2><bdi>${sec.name}</bdi> <span class="paren">(${selItems.length} of ${sec.libs.length + sec.customs.length})</span></h2><${Hrs} v=${selHours} ghost=${!selHours} /></div>
          ${rows}
        </section>`;
      })}
      ${(ql || onlySel) && !sections.some(function (sec) { return sec.libs.some(function (li) { return (!onlySel || byLib[li.id]) && matches(li.name, sec.name); }) || sec.customs.some(function (it) { return matches(it.name, sec.name); }); })
        ? html`<div class="panel"><div class="empty"><h2>Nothing matches</h2><p>${onlySel && !draft.items.length ? 'No ' + lower(labels.items) + ' added yet.' : 'Try another search, or add it as a custom ' + lower(labels.item) + ' below.'}</p></div></div>` : null}
      <section class="panel panel-pad">
        <${CardHead} icon="plus" color="pink" title=${'Add a custom ' + lower(labels.item)} desc=${"For anything the library doesn't have yet." + (isAdmin ? ' You can save it to the library afterwards.' : '')} />
        <form class="inline-form" onSubmit=${function (e) {
          e.preventDefault();
          var name = cform.name.trim(); if (!name) return;
          var catId = cform.cat || 'custom';
          var it = E.customItem(name, cform.hours, catId, service && catId !== 'custom' ? E.categoryName(service, catId) : 'Custom', draft);
          p.change(function (n) { n.items.push(it); });
          setCform({ name: '', hours: 4, cat: cform.cat });
          setOpen(function (o) { var c = Object.assign({}, o); c[it.key] = true; return c; });
          ctx.toast('Added ' + name);
        }}>
          <input class="input" id="custom-name" maxlength="200" aria-label=${'Custom ' + lower(labels.item) + ' name'} placeholder=${'Name, e.g. Loan calculator'} value=${cform.name} onInput=${function (e) { setCform(Object.assign({}, cform, { name: e.target.value })); }} />
          ${cats.length ? html`<select class="select" style="width:auto" aria-label=${labels.category} value=${cform.cat} onChange=${function (e) { setCform(Object.assign({}, cform, { cat: e.target.value })); }}><option value="custom">Custom group</option>${cats.map(function (c) { return html`<option value=${c.id}>${c.name}</option>`; })}</select>` : null}
          <${Stepper} value=${cform.hours} label="Hours" unit="h" onChange=${function (v) { setCform(Object.assign({}, cform, { hours: v })); }} />
          <button class="btn primary" type="submit"><${Icon} name="plus" /> Add</button>
        </form>
      </section>`;
  }

  function ItemPanel(p) {
    var it = p.it, draft = p.draft, labels = p.labels, service = p.service;
    var sm = useState(false), more = sm[0], setMore = sm[1];
    var sf = useState({ name: '', hours: 2 }), cs = sf[0], setCs = sf[1];
    var ss = useState((it.subs || []).length > 0), subsOpen = ss[0], setSubsOpen = ss[1];
    function upd(fn) { p.change(function (n) { var t = n.items.filter(function (i) { return i.key === it.key; })[0]; if (t) fn(t, n); }); }
    var cx = (draft.snapshot && draft.snapshot.complexity) || E.DEFAULT_COMPLEXITY;
    var phases = (draft.snapshot && draft.snapshot.phases) || ['Phase 1'];
    var used = {}; (it.subs || []).forEach(function (s) { if (s.libId) used[s.libId] = 1; });
    var avail = service ? (service.subItems || []).filter(function (s) { return !used[s.id]; }) : [];
    var subsTotal = (it.subs || []).reduce(function (s, x) { return s + E.num(x.hours); }, 0);
    var x = p.x;
    return html`<div class="item-panel">
      <div class="ip-controls">
        <div class="ctl"><span class="ctl-label">Complexity</span><${Seg} label="Complexity" options=${cx.map(function (c) { return { value: c.id, label: c.name, title: '×' + E.fmtNum(c.multiplier) + (c.description ? ' · ' + c.description : '') }; })} value=${it.complexity || 'standard'} onChange=${function (v) { upd(function (t) { t.complexity = v; }); }} /></div>
        <div class="ctl"><span class="ctl-label">Priority</span><${Seg} cls="pri" label="Priority" options=${E.PRIORITIES.map(function (q) { return { value: q.id, label: q.short, title: q.name }; })} value=${it.priority || 'must'} onChange=${function (v) { upd(function (t) { t.priority = v; }); }} /></div>
        ${phases.length > 1 ? html`<label class="ctl"><span class="ctl-label">Phase</span><select class="select sm" style="width:auto" value=${it.phase} onChange=${function (e) { var v = e.target.value; upd(function (t) { t.phase = v; }); }}>${phases.map(function (ph) { return html`<option value=${ph}>${ph}</option>`; })}</select></label>` : null}
        ${E.packagesOf(draft).enabled ? html`<div class="ctl"><span class="ctl-label">Package</span><${Seg} label="Package" options=${E.packagesOf(draft).names.map(function (n, i) { return { value: i, label: n, title: i ? 'In ' + n + (i < 2 ? ' and above' : '') : 'In every package' }; })} value=${E.tierOf(it)} onChange=${function (v) { upd(function (t) { t.tier = v; }); }} /></div>` : null}
        ${it.allowMultiple || it.qty > 1 ? html`<div class="ctl"><span class="ctl-label">Quantity</span><${Stepper} step=${1} min=${1} max=${99} value=${E.num(it.qty, 1)} label="Quantity" onChange=${function (v) { upd(function (t) { t.qty = v; }); }} /></div>` : null}
      </div>
      ${subsOpen ? html`<div class="ip-subs">
        <div class="ip-subs-head"><span class="ctl-label">${labels.subs}</span><span class="muted" style="font-size:12.5px">${E.fmtHours(subsTotal)} per ${lower(labels.item)}${x && (x.mult !== 1 || x.qty !== 1) ? ' · ×' + E.fmtNum(x.mult * x.qty) + ' = ' + E.fmtHours(x.total) : ''}</span></div>
        ${(it.subs || []).length ? html`<ul class="sub-list">${it.subs.map(function (s) {
          return html`<li class="sub-row" key=${s.key}>
            <span class="sub-name">${s.name}${s.libId ? null : html`<span class="lib-sub"> (custom)</span>`}</span>
            <${Stepper} value=${E.num(s.hours)} label=${s.name + ' hours'} unit="h" onChange=${function (v) { upd(function (t) { var q = t.subs.filter(function (z) { return z.key === s.key; })[0]; if (q) q.hours = v; }); }} />
            <button type="button" class="icon-btn danger" aria-label=${'Remove ' + s.name} onClick=${function () { upd(function (t) { t.subs = t.subs.filter(function (z) { return z.key !== s.key; }); }); }}><${Icon} name="x" /></button>
          </li>`;
        })}</ul>` : html`<p class="muted" style="font-size:13px">No ${lower(labels.subs)} yet. Add some below.</p>`}
        ${avail.length ? html`<div class="sub-add">
          ${(more ? avail : avail.slice(0, 8)).map(function (s) {
            return html`<button type="button" class="chip dashed" key=${s.id} onClick=${function () { upd(function (t) { t.subs.push(E.copySub(s)); }); }}><${Icon} name="plus" size=${13} />${s.name}<span class="count">${E.fmtHours(s.hours)}</span></button>`;
          })}
          ${avail.length > 8 ? html`<button type="button" class="link" onClick=${function () { setMore(!more); }}>${more ? 'Show fewer' : 'Show all ' + avail.length}</button>` : null}
        </div>` : null}
        <form class="inline-form" style="margin-top:10px" onSubmit=${function (e) {
          e.preventDefault(); var name = cs.name.trim(); if (!name) return;
          upd(function (t) { t.subs.push({ key: E.uid('s'), libId: null, name: name, hours: cs.hours, description: '', includes: '', excludes: '' }); });
          setCs({ name: '', hours: 2 });
        }}>
          <input class="input sm" id=${'cs-' + it.key} maxlength="200" aria-label=${'Custom ' + lower(labels.sub)} placeholder=${'Custom ' + lower(labels.sub)} value=${cs.name} onInput=${function (e) { setCs({ name: e.target.value, hours: cs.hours }); }} />
          <${Stepper} value=${cs.hours} label="Custom hours" unit="h" onChange=${function (v) { setCs({ name: cs.name, hours: v }); }} />
          <button class="btn sm" type="submit">Add</button>
        </form>
      </div>` : null}
      ${E.requirementsOf(draft).length ? html`<${ReqLinks} it=${it} draft=${draft} upd=${upd} />` : null}
      <div class="ip-foot">
        <label class="ctl"><span class="ctl-label">${(it.subs || []).length ? labels.item + ' base hours' : 'Hours'}</span><${Stepper} value=${E.num(it.hours)} label="Base hours" unit="h" onChange=${function (v) { upd(function (t) { t.hours = v; }); }} /></label>
        <label class="ctl note"><span class="ctl-label">Note</span><input class="input sm" id=${'note-' + it.key} maxlength="1000" placeholder="Shown in exports, e.g. client wants 3 hero variants" value=${it.note || ''} onInput=${function (e) { var v = e.target.value; upd(function (t) { t.note = v; }); }} /></label>
        <div class="row">
          ${!subsOpen ? html`<button type="button" class="btn sm ghost" onClick=${function () { setSubsOpen(true); }}><${Icon} name="plus" size=${14} /> ${labels.subs}</button>` : null}
          ${p.isAdmin && it.custom ? html`<button type="button" class="btn sm" onClick=${function () { p.onSaveToLibrary(it); }}><${Icon} name="book" size=${14} /> Save to library</button>` : null}
          <button type="button" class="btn sm ghost danger" onClick=${p.onRemove}><${Icon} name="trash" size=${14} /> Remove</button>
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ step: review
  function ReviewStep(p) {
    var ctx = p.ctx, draft = p.draft, res = p.res, labels = p.labels, service = p.service;
    var sb = useState(false), showSubs = sb[0], setShowSubs = sb[1];
    var sc = E.scenarios(draft);
    var maxSc = Math.max.apply(null, sc.map(function (s) { return s.total; }).concat([0.0001]));
    var phases = E.phaseBreakdown(draft, res).filter(function (ph, i) { return ph.base > 0 || i === 0; });
    var maxPh = Math.max.apply(null, phases.map(function (ph) { return ph.total; }).concat([0.0001]));
    var outdated = ctx.settingsDoc && service ? E.ratesOutdated(draft, service, ctx.settings) : false;
    var dl = E.deliverables(draft, res);
    var oos = E.outOfScope(draft);
    var hidden = draft.hiddenAuto || [];
    var groups = (draft.snapshot && draft.snapshot.optionGroups) || [];

    function why(o) {
      if (o.rule === 'percent') return E.fmtNum(o.value) + '% of base design' + (o.units > 1 ? ' × ' + E.fmtNum(o.units) : '');
      if (o.rule === 'fixed') return o.isQuantity ? E.fmtNum(o.units) + ' × ' + E.fmtHours(o.value) : 'Fixed';
      if (o.rule === 'perItem') return E.fmtHours(o.value) + ' × ' + E.fmtNum(o.itemCount) + ' ' + lower(labels.items);
      return '';
    }
    function delivTile(d, i) {
      if (i === 0) return html`<${SvcTile} svc=${service || { icon: 'box' }} />`;
      if (d.group === 'Custom deliverables') return html`<${Tile} icon="plus" color="pink" />`;
      var gi = groups.findIndex(function (g) { return g.name === d.group; });
      var gs = gi >= 0 ? groupStyle(groups[gi], gi) : { icon: 'sliders', color: 'gray' };
      return html`<${Tile} icon=${gs.icon} color=${gs.color} />`;
    }
    function regList(kind) {
      var reg = E.registerFor(draft, kind.id, true);
      var st = useState(''), text = st[0], setText = st[1];
      var rs = REG_STYLE[kind.id] || ['list', 'gray'];
      return html`<section class="panel panel-pad" key=${kind.id}>
        <${CardHead} icon=${rs[0]} color=${rs[1]} title=${kind.name} desc=${kind.hint} />
        <div class="reg-list">
          ${reg.auto.map(function (e) {
            var off = hidden.indexOf(e.id) >= 0;
            return html`<div class=${'reg-item' + (off ? ' hidden' : '')} key=${e.id}>
              <span class="src">Library</span><span class="txt">${e.text}</span>
              <button type="button" class="icon-btn" aria-label=${off ? 'Include this line' : 'Leave this line out'} title=${off ? 'Include' : 'Leave out'} onClick=${function () { p.change(function (n) { var hs = n.hiddenAuto || []; n.hiddenAuto = off ? hs.filter(function (z) { return z !== e.id; }) : hs.concat(e.id); }); }}><${Icon} name=${off ? 'eyeOff' : 'eye'} /></button>
            </div>`;
          })}
          ${((draft.register && draft.register[kind.id]) || []).map(function (e) {
            return html`<div class="reg-item" key=${e.id}>
              <${AutoText} id=${'reg-' + e.id} label=${kind.name} value=${e.text} onInput=${function (ev) { var v = ev.target.value; p.change(function (n) { var t = n.register[kind.id].filter(function (z) { return z.id === e.id; })[0]; if (t) t.text = v; }); }} />
              <button type="button" class="icon-btn danger" aria-label="Remove line" onClick=${function () { p.change(function (n) { n.register[kind.id] = n.register[kind.id].filter(function (z) { return z.id !== e.id; }); }); }}><${Icon} name="trash" /></button>
            </div>`;
          })}
          ${!reg.auto.length && !((draft.register && draft.register[kind.id]) || []).length ? html`<p class="muted" style="font-size:13px;padding:2px 0 8px">Nothing recorded yet.</p>` : null}
          <form class="str-row" style="margin-top:6px" onSubmit=${function (e) {
            e.preventDefault(); var t = text.trim(); if (!t) return;
            p.change(function (n) { n.register = n.register || {}; n.register[kind.id] = (n.register[kind.id] || []).concat({ id: E.uid('r'), text: t }); });
            setText('');
          }}>
            <input class="input" id=${'reg-new-' + kind.id} maxlength="1000" placeholder=${'Add ' + ({ assumptions: 'an assumption', exclusions: 'an exclusion', dependencies: 'a dependency', risks: 'a risk' }[kind.id] || lower(kind.name))} value=${text} onInput=${function (e) { setText(e.target.value); }} />
            <button class="btn" type="submit"><${Icon} name="plus" /> Add</button>
          </form>
        </div>
      </section>`;
    }

    var bufferPicks = [0, 5, 10, 12.5, 15, 20];
    var included = res.items.filter(function (x) { return x.included; });
    return html`
      ${outdated ? html`<div class="banner warn"><${Icon} name="refresh" /><div class="grow"><b>The library's rates have changed</b> since this estimate was created. Update to use the latest percentages, multipliers, phases and overhead. ${labels.items} you've already added keep their hours.</div>
        <button class="btn sm" onClick=${function () { p.change(function (n) { var r = E.refreshRates(n, service, ctx.settings); Object.keys(r).forEach(function (k) { n[k] = r[k]; }); }); ctx.toast('Updated to the latest rates'); }}>Update rates</button></div>` : null}
      <div class="review-top">
        <section class="panel total-card">
          <div class="eyebrow">Total estimate</div>
          <div class="total-big"><span class="measure"><span class="num">${E.fmtNum(E.round(res.total, 1))}</span><span class="u">h</span></span></div>
          <div class="total-cost-badge">
            <span class="cost-val">${E.fmtMoney(res.totalCost, res.currency)}</span>
            <span class="cost-rate">at ${E.fmtMoney(res.hourlyRate, res.currency)}/h</span>
            ${res.marginPercent !== null && res.marginPercent !== undefined ? html`<span class="cost-margin" style="margin-left:8px;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;color:var(--green, #2e7d32);background:var(--green-sub, rgba(46,125,50,0.12))">${res.marginPercent}% margin</span>` : null}
          </div>
          <div class="total-meta">${dl[0] ? dl[0].text : ''} <span class="paren">(about ${E.fmtNum(E.round(res.total / 40, 1))} designer-weeks)</span></div>
          <dl class="summary-lines">
            <dt>Base design</dt><dd>${E.fmtHours(E.round(res.base, 1))} <span class="dim">(${E.fmtMoney(res.baseCost, res.currency)})</span></dd>
            <dt>Adaptations & add-ons</dt><dd>${E.fmtHours(E.round(res.adaptations, 1))} <span class="dim">(${E.fmtMoney(res.designSubtotalCost - res.baseCost, res.currency)})</span></dd>
            <dt>Project overhead</dt><dd>${E.fmtHours(E.round(res.overhead, 1))} <span class="dim">(${E.fmtMoney(res.overheadCost, res.currency)})</span></dd>
            <dt>Buffer (${E.fmtNum(res.bufferPercent)}%)</dt><dd>${E.fmtHours(E.round(res.buffer, 1))} <span class="dim">(${E.fmtMoney(res.bufferCost, res.currency)})</span></dd>
            <dt class="tot">Total</dt><dd class="tot">${E.fmtHours(E.round(res.total, 1))} <span class="tot-cost">· ${E.fmtMoney(res.totalCost, res.currency)}</span></dd>
          </dl>
        </section>
        <section class="panel panel-pad">
          <${CardHead} icon="gauge" color="teal" title="Scope scenarios" desc="What the total becomes if you trim to higher priorities only. Useful when the budget is tight." />
          <div class="bars">${sc.map(function (s, i) {
            return html`<div class="bar-row" key=${s.id}>
              <span class="bar-label">${s.label}<span>${s.count} ${lower(plural(s.count, labels.item, labels.items))}</span></span>
              <span class="bar-track"><span class=${'bar-fill' + (i === sc.length - 1 ? ' hl' : '')} style=${'display:block;width:' + Math.max(1, (s.total / maxSc) * 100).toFixed(1) + '%'}></span></span>
              <${Hrs} v=${s.total} ghost=${i !== sc.length - 1} />
            </div>`;
          })}</div>
        </section>
      </div>

      <section class="panel panel-pad">
        <${CardHead} icon="layers" color="purple" title="Hours by phase" desc=${'Each phase carries its own ' + lower(labels.items) + "; shared hours (scope options, overhead, buffer) are split by each phase's share of base design."} />
        <div class="bars">${phases.map(function (ph) {
          return html`<div class="bar-row" key=${ph.phase}>
            <span class="bar-label">${ph.phase}<span>${ph.count} ${lower(plural(ph.count, labels.item, labels.items))} · ${E.fmtHours(ph.base)} base</span></span>
            <span class="bar-track"><span class="bar-fill hl" style=${'display:block;width:' + Math.max(ph.total > 0 ? 1 : 0, (ph.total / maxPh) * 100).toFixed(1) + '%'}></span></span>
            <${Hrs} v=${ph.total} ghost=${!ph.total} />
          </div>`;
        })}</div>
      </section>

      <section class="panel flush">
        <${CardHead} icon="table" color="blue" title="Breakdown" desc="How every hour adds up."
          right=${html`<button class="btn sm ghost" aria-expanded=${showSubs ? 'true' : 'false'} onClick=${function () { setShowSubs(!showSubs); }}>${showSubs ? 'Hide ' : 'Show '}${lower(labels.subs)}</button>`} />
        <div class="table-wrap"><table class="bd">
          <thead><tr><th>Line</th><th>Basis</th><th class="n">Hours</th></tr></thead>
          <tbody>
            <tr class="grp"><td colspan="3">Base design · ${lower(labels.items)}</td></tr>
            ${included.length ? null : html`<tr><td colspan="3" class="muted">No ${lower(labels.items)} added yet.</td></tr>`}
            ${included.map(function (x) {
              var it = x.item, mult = x.mult * x.qty, subs = it.subs || [];
              var basis = [];
              if (x.qty !== 1) basis.push('×' + E.fmtNum(x.qty));
              if (x.mult !== 1) basis.push((draft.snapshot.complexity || []).filter(function (c) { return c.id === it.complexity; }).map(function (c) { return c.name; })[0] + ' ×' + E.fmtNum(x.mult));
              return [html`<tr key=${it.key}><td><bdi>${it.name}</bdi> <span class="paren">(<bdi>${it.categoryName}</bdi>${it.custom ? ', custom' : ''})</span></td><td class="why">${basis.join(' · ') || (subs.length ? subs.length + ' ' + lower(plural(subs.length, labels.sub, labels.subs)) : '')}</td><td class="n">${E.fmtHours(x.total)}</td></tr>`]
                .concat(showSubs && E.num(it.hours) > 0 && subs.length ? [html`<tr class="sub" key=${it.key + '-base'}><td>Base hours</td><td></td><td class="n">${E.fmtHours(E.num(it.hours) * mult)}</td></tr>`] : [])
                .concat(showSubs ? subs.map(function (s) { return html`<tr class="sub" key=${s.key}><td>${s.name}</td><td></td><td class="n">${E.fmtHours(E.num(s.hours) * mult)}</td></tr>`; }) : []);
            })}
            <tr class="subtotal"><td colspan="2">Base design</td><td class="n">${E.fmtHours(E.round(res.base, 1))}</td></tr>
            ${res.optionLines.filter(function (o) { return o.rule !== 'none'; }).length || res.customLines.length ? html`<tr class="grp"><td colspan="3">Adaptations & add-ons</td></tr>` : null}
            ${res.optionLines.filter(function (o) { return o.rule !== 'none'; }).map(function (o) {
              return html`<tr key=${o.optionId}><td>${o.name} <span class="paren">(${o.groupName})</span></td><td class="why">${why(o)}</td><td class="n">${E.fmtHours(o.hours)}</td></tr>`;
            })}
            ${res.customLines.map(function (c) { return html`<tr key=${c.key}><td>${c.name} <span class="paren">(custom deliverable)</span></td><td class="why">${E.fmtNum(c.qty)} × ${E.fmtHours(c.unit)}</td><td class="n">${E.fmtHours(c.hours)}</td></tr>`; })}
            <tr class="subtotal"><td colspan="2">Design subtotal</td><td class="n">${E.fmtHours(E.round(res.designSubtotal, 1))}</td></tr>
            ${res.overheadLines.length ? html`<tr class="grp"><td colspan="3">Project overhead</td></tr>` : null}
            ${res.overheadLines.map(function (o) { return html`<tr key=${o.id}><td>${o.name}</td><td class="why">${o.rule === 'percent' ? E.fmtNum(o.value) + '% of design subtotal' : 'Fixed'}</td><td class="n">${E.fmtHours(o.hours)}</td></tr>`; })}
            <tr class="subtotal"><td colspan="2">Subtotal</td><td class="n">${E.fmtHours(E.round(res.subtotal, 1))}</td></tr>
            <tr><td>Buffer</td><td class="why">${E.fmtNum(res.bufferPercent)}% of subtotal</td><td class="n">${E.fmtHours(E.round(res.buffer, 1))}</td></tr>
            <tr class="total"><td colspan="2">Total</td><td class="n">${E.fmtHours(E.round(res.total, 1))}</td></tr>
          </tbody>
        </table></div>
      </section>

      <section class="panel flush">
        <${CardHead} icon="pack" color="orange" title="Deliverables" desc="What the client receives, from the scope you set." />
        <div class="deliv-rows">${dl.map(function (d, i) {
          return html`<div class="deliv-row" key=${d.group}>${delivTile(d, i)}<div class="t"><b><bdi>${d.group}</bdi></b> <span class="paren">(<bdi>${d.text}</bdi>)</span></div></div>`;
        })}</div>
      </section>

      <section class="panel panel-pad">
        <${CardHead} icon="sliders" color="orange" title="Overhead & buffer" desc="Project-level time for this estimate. Defaults come from Settings." />
        <div class="adjust">
          ${(draft.overhead || []).map(function (o, i) {
            var line = res.overheadLines.filter(function (l) { return l.id === o.id; })[0];
            return html`<div class="adj-row" key=${o.id}>
              <${Switch} id=${'oh-' + o.id} label=${o.name} checked=${o.enabled} onChange=${function (v) { p.change(function (n) { n.overhead[i].enabled = v; }); }} />
              <div class="grow"><div>${o.name}</div><div class="opt-hint">${o.rule === 'percent' ? '% of design subtotal' : 'Fixed hours'}${o.description ? ' · ' + o.description : ''}</div></div>
              <${Stepper} value=${E.num(o.value)} step=${o.rule === 'percent' ? 1 : 0.5} max=${o.rule === 'percent' ? 100 : 1000} label=${o.name} unit=${o.rule === 'percent' ? '%' : 'h'} disabled=${!o.enabled} onChange=${function (v) { p.change(function (n) { n.overhead[i].value = v; }); }} />
              <${Hrs} v=${line ? line.hours : 0} ghost=${!o.enabled} />
            </div>`;
          })}
          <div class="adj-row">
            <div class="grow"><div>Buffer</div><div class="opt-hint">% of subtotal, for unknowns and risk</div></div>
            <${Seg} label="Buffer quick picks" options=${bufferPicks.map(function (v) { return { value: v, label: E.fmtNum(v) + '%' }; })} value=${E.num(draft.bufferPercent)} onChange=${function (v) { p.change(function (n) { n.bufferPercent = v; }); }} />
            <${Stepper} value=${E.num(draft.bufferPercent)} step=${1} max=${100} label="Buffer percent" unit="%" onChange=${function (v) { p.change(function (n) { n.bufferPercent = v; }); }} />
            <${Hrs} v=${res.buffer} />
          </div>
        </div>
      </section>

      <section class="panel panel-pad">
        <${CardHead} icon="coins" color="green" title="Commercials & rate card" desc="Billing rate, internal cost rate and currency for this estimate. Defaults come from Settings." />
        <div class="grid-2">
          <label class="field"><span>Project currency</span>
            <select class="select" id="est-currency" aria-label="Project currency" value=${draft.currency || 'USD'} onChange=${function (e) { var c = e.target.value; p.change(function (n) { n.currency = c; }); }}>
              ${E.CURRENCIES.map(function (c) { return html`<option key=${c.id} value=${c.id} selected=${c.id === (draft.currency || 'USD')}>${c.name}</option>`; })}
            </select>
          </label>
          <label class="field"><span>Billing rate</span>
            <${Stepper} id="est-rate" value=${E.num(draft.hourlyRate, (draft.snapshot && draft.snapshot.hourlyRate) || (ctx.settings && ctx.settings.hourlyRate) || 100)} step=${5} min=${1} max=${10000} label="Billing rate" unit=${E.currencyInfo(draft.currency || 'USD').symbol + '/h'} onChange=${function (v) { p.change(function (n) { n.hourlyRate = v; }); }} />
          </label>
        </div>
        <div class="grid-2" style="margin-top:12px">
          <label class="field"><span>Internal cost rate (optional)</span>
            <${Stepper} id="est-cost-rate" value=${E.num(draft.costRate, (draft.snapshot && draft.snapshot.costRate) || (ctx.settings && ctx.settings.costRate) || 0)} step=${5} min=${0} max=${10000} label="Internal cost rate" unit=${E.currencyInfo(draft.currency || 'USD').symbol + '/h'} onChange=${function (v) { p.change(function (n) { n.costRate = v; }); }} />
          </label>
          <div class="field"><span>Agency profitability preview</span>
            <div class="panel panel-pad" style="background:var(--bg-sub);border:1px solid var(--border);border-radius:var(--radius);padding:8px 12px">
              ${res.marginPercent !== null && res.marginPercent !== undefined ? html`<div class="row" style="justify-content:space-between;align-items:center">
                <span style="font-size:12px;color:var(--text-sub)">Labor: ${E.fmtMoney(res.laborCost, res.currency)}</span>
                <span class="pill" style="font-weight:700;color:var(--green, #2e7d32);background:var(--green-sub, rgba(46,125,50,0.12))">${res.marginPercent}% gross margin (${E.fmtMoney(res.grossProfit, res.currency)} profit)</span>
              </div>` : html`<div class="muted" style="font-size:12px">Set cost rate > 0 to track profitability margin</div>`}
            </div>
          </div>
        </div>
      </section>

      <section class="panel panel-pad">
        <${CardHead} icon="chart" color="purple" title="Payment milestone schedule" desc="Recommended payment installments for proposal agreement and billing." />
        <div class="grid-3" style="gap:10px">
          ${(res.milestones || []).map(function (m) {
            return html`<div class="panel panel-pad" key=${m.id} style="background:var(--bg-sub);border:1px solid var(--border);border-radius:var(--radius)">
              <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px">
                <span class="pill s-review">${m.percent}%</span>
                <span style="font-weight:700;font-size:15px">${E.fmtMoney(m.amount, res.currency)}</span>
              </div>
              <div style="font-size:13px;font-weight:600">${m.name}</div>
            </div>`;
          })}
        </div>
      </section>

      <div>
        <div class="eyebrow" style="margin:4px 0 10px">Assumptions register</div>
        <div class="reg-grid">${E.REGISTER_KINDS.map(function (k) { return html`<${RegPanel} key=${k.id} render=${regList} kind=${k} />`; })}</div>
      </div>

      ${oos.length ? html`<section class="panel flush">
        <${CardHead} icon="xCircle" color="gray" title="Out of scope" desc="Marked Won't have. Listed in the export, not counted in the total." />
        <div class="table-wrap"><table class="bd"><tbody>${oos.map(function (o, i) { return html`<tr key=${i}><td><bdi>${o.name}</bdi> <span class="paren">(<bdi>${o.category}</bdi>)</span></td><td class="n">${E.fmtHours(o.hours)}</td></tr>`; })}</tbody></table></div>
      </section>` : null}

      <${PackagesPanel} draft=${draft} change=${p.change} labels=${labels} />
      <${TracePanel} draft=${draft} change=${p.change} labels=${labels} ctx=${ctx} />
      <${VersionsPanel} ctx=${ctx} id=${p.id} draft=${draft} change=${p.change} />
      <${ActualsPanel} ctx=${ctx} draft=${draft} res=${res} change=${p.change} labels=${labels} />

      <section class="panel panel-pad">
        <${CardHead} icon="download" color="green" title="Export" desc="Spreadsheets for your team (both import into Google Sheets and open in Excel), and a client-ready proposal." />
        <div class="export-grid">
          <button class="export-btn" onClick=${function () { p.goStep('proposal'); }}><${Tile} icon="file" color="purple" /><span class="t"><b>Client proposal</b><span>A Word document with scope, deliverables, timeline and assumptions, ready to send. Preview and adjust it first.</span></span></button>
          <button class="export-btn" disabled=${!!p.exporting} onClick=${function () { p.onExport('xlsx'); }}><${Tile} icon="table" color="green" /><span class="t"><b>${p.exporting === 'xlsx' ? 'Preparing workbook…' : 'Excel workbook'}</b><span>Summary, Breakdown and Assumptions sheets. Totals are live formulas, so changing a quantity recalculates everything.</span></span></button>
          <button class="export-btn" disabled=${!!p.exporting} onClick=${function () { p.onExport('csv'); }}><${Tile} icon="file" color="blue" /><span class="t"><b>${p.exporting === 'csv' ? 'Preparing file…' : 'CSV table'}</b><span>One flat table of every line, subtotal and the total. Works in any spreadsheet.</span></span></button>
        </div>
      </section>`;
  }
  // Wrapper so each register list keeps its own hook state.
  function RegPanel(p) { return p.render(p.kind); }
