// ================================================================== library (CMS)
  function LibraryView(p) {
    var ctx = p.ctx, list = ctx.serviceList || [];
    var dirtyRef = useRef(false);
    var sel = ctx.route.serviceId && ctx.services && ctx.services[ctx.route.serviceId] ? ctx.route.serviceId : (list[0] ? list[0].id : null);
    function select(id) {
      if (id === sel) return;
      var go = function () { dirtyRef.current = false; ctx.setRoute({ view: 'library', serviceId: id, tab: ctx.route.tab }); };
      if (dirtyRef.current) ctx.confirm({ title: 'Discard unsaved changes?', body: 'You have unsaved changes to this service.', confirmLabel: 'Discard changes', danger: true, onConfirm: go });
      else go();
    }
    async function addService() {
      var id = uniqueId('new-service', Object.keys(ctx.services || {}));
      var doc = {
        name: 'New service', description: '', icon: 'box', color: 'yellow', active: false,
        order: list.reduce(function (m, s) { return Math.max(m, E.num(s.order)); }, 0) + 1,
        labels: Object.assign({}, E.DEFAULT_LABELS), categories: [{ id: 'general', name: 'General' }],
        items: [], subItems: [], optionGroups: [], starterPacks: [], gapRules: [],
      };
      var ok = await ctx.api.set('services/' + id, doc);
      if (ok) { dirtyRef.current = false; ctx.setRoute({ view: 'library', serviceId: id, tab: 'overview' }); ctx.toast('Service created. Estimators see it once you mark it active.'); }
    }
    return html`<div class="page-head"><div><h1>Library</h1><p>The services, scope options and building blocks estimators pick from. Saved changes apply to new estimates; existing estimates can update their rates from the Review step.</p></div></div>
      ${ctx.services === null ? html`<div class="panel panel-pad"><div class="skeleton" style="width:50%"></div></div>` : html`<div class="cms">
        <nav class="panel svc-list" aria-label="Services">
          ${list.map(function (s) {
            return html`<button class="svc-item" key=${s.id} aria-current=${s.id === sel ? 'true' : 'false'} onClick=${function () { select(s.id); }}>
              <${SvcTile} svc=${s} />
              <span class="t"><b title=${s.name}><bdi>${s.name}</bdi></b><span>${s.active ? serviceStats(s)[0] : 'Inactive'}</span></span>
            </button>`;
          })}
          <button class="btn sm ghost" onClick=${addService}><${Icon} name="plus" /> Add service</button>
        </nav>
        <div style="min-width:0">${sel ? html`<${ServiceEditor} key=${sel} ctx=${ctx} id=${sel} dirtyRef=${dirtyRef} />`
          : html`<div class="panel"><div class="empty first"><${Tile} size="lg" icon="book" color="purple" /><h2>No services yet</h2><p>Add your first service, such as Website or Mobile app, then add its pages or features with default hours.</p><button class="btn primary" onClick=${addService}><${Icon} name="plus" /> Add service</button></div></div>`}</div>
      </div>`}`;
  }

  function useDocDraft(live) {
    var sb = useState(function () { return E.clone(live || {}); }), base = sb[0], setBase = sb[1];
    var sd = useState(function () { return E.clone(live || {}); }), draft = sd[0], setDraft = sd[1];
    var liveStr = JSON.stringify(live || {}), baseStr = JSON.stringify(base);
    var dirty = JSON.stringify(draft) !== baseStr;
    var prevLive = useRef(liveStr);
    useEffect(function () {
      if (prevLive.current === liveStr) return;
      prevLive.current = liveStr;
      if (!dirty) { setBase(E.clone(live || {})); setDraft(E.clone(live || {})); }
    }, [liveStr]);
    return {
      base: base, draft: draft, dirty: dirty, conflict: dirty && liveStr !== baseStr,
      mut: function (fn) { setDraft(function (d) { var n = E.clone(d); fn(n); return n; }); },
      reset: function () { setDraft(E.clone(base)); },
      reload: function () { setBase(E.clone(live || {})); setDraft(E.clone(live || {})); },
      saved: function (d) { setBase(E.clone(d)); },
      restore: function (prev) { setBase(prev); },
    };
  }
  function SaveBar(p) {
    if (!p.dirty) return null;
    return html`<div class="savebar" role="region" aria-label="Unsaved changes">
      <span class="grow">Unsaved changes</span>
      <button class="btn sm ghost" onClick=${p.onDiscard}>Discard</button>
      <button class="btn sm light" disabled=${p.saving} onClick=${p.onSave}>${p.saving ? 'Saving…' : 'Save changes'}</button>
    </div>`;
  }

  function ServiceEditor(p) {
    var ctx = p.ctx, id = p.id, live = ctx.services[id];
    var d = useDocDraft(live);
    var ss = useState(false), saving = ss[0], setSaving = ss[1];
    p.dirtyRef.current = d.dirty;
    useEffect(function () { return function () { p.dirtyRef.current = false; }; }, []);
    var tab = ['overview', 'options', 'items', 'subs', 'packs', 'rules', 'calibrate'].indexOf(ctx.route.tab) >= 0 ? ctx.route.tab : 'items';
    var svc = d.draft, labels = Object.assign({}, E.DEFAULT_LABELS, svc.labels || {});
    async function save() {
      // Mark as saved before the write: our own write echoes back through the live subscription
      // before it confirms, and must not look like someone else's change.
      var prev = d.base;
      d.saved(svc); setSaving(true);
      var ok = await ctx.api.set('services/' + id, clean(svc));
      setSaving(false);
      if (ok) ctx.toast('Saved ' + (svc.name || 'service'));
      else d.restore(prev);
    }
    if (!live) return html`<div class="panel"><div class="empty"><h2>This service was deleted</h2></div></div>`;
    var tabs = [
      { id: 'items', name: labels.items, count: (svc.items || []).length },
      { id: 'subs', name: labels.subs, count: (svc.subItems || []).length },
      { id: 'options', name: 'Scope options', count: (svc.optionGroups || []).length },
      { id: 'packs', name: 'Starter packs', count: (svc.starterPacks || []).length },
      { id: 'rules', name: 'Gap rules', count: (svc.gapRules || []).length },
      { id: 'calibrate', name: 'Calibrate hours' },
      { id: 'overview', name: 'Service details' },
    ];
    var body;
    var tp = { ctx: ctx, svc: svc, mut: d.mut, labels: labels, id: id, base: d.base };
    if (tab === 'overview') body = html`<${OverviewTab} ...${tp} />`;
    else if (tab === 'options') body = html`<${OptionsTab} ...${tp} />`;
    else if (tab === 'subs') body = html`<${SubsTab} ...${tp} />`;
    else if (tab === 'packs') body = html`<${PacksTab} ...${tp} />`;
    else if (tab === 'rules') body = html`<${RulesTab} ...${tp} />`;
    else if (tab === 'calibrate') body = html`<${CalibrateTab} ...${tp} />`;
    else body = html`<${ItemsTab} ...${tp} />`;
    return html`<div>
      <div class="row" style="margin-bottom:14px;align-items:center;gap:14px">
        <${SvcTile} svc=${svc} size="lg" />
        <div style="min-width:0"><h2 style="font-size:20px">${svc.name || 'Untitled service'}</h2><div style="font-size:13px;color:var(--faint)">${svc.active ? 'Active (shown to estimators)' : 'Inactive (hidden from estimators)'}</div></div>
      </div>
      ${d.conflict ? html`<div class="banner warn" style="margin-bottom:12px"><${Icon} name="alert" /><div class="grow">Someone else saved this service while you were editing. Saving now replaces their changes.</div><button class="btn sm" onClick=${d.reload}>Load their version</button></div>` : null}
      <div class="cms-tabs" role="tablist">${tabs.map(function (t) {
        return html`<button class="cms-tab" role="tab" key=${t.id} aria-selected=${t.id === tab ? 'true' : 'false'} onClick=${function () { ctx.setRoute({ view: 'library', serviceId: id, tab: t.id }); }}>${t.name}${t.count !== undefined ? html`<span class="count">${t.count}</span>` : null}</button>`;
      })}</div>
      ${body}
      <${SaveBar} dirty=${d.dirty} saving=${saving} onSave=${save} onDiscard=${d.reset} />
    </div>`;
  }

  function OverviewTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    function setLabel(k, v) { mut(function (n) { n.labels = Object.assign({}, E.DEFAULT_LABELS, n.labels || {}); n.labels[k] = v; }); }
    async function duplicate() {
      var nid = uniqueId(svc.name + '-copy', Object.keys(ctx.services || {}));
      var copy = clean(p.base); copy.name = (copy.name || 'Service') + ' (copy)'; copy.active = false; copy.order = E.num(copy.order) + 1;
      var ok = await ctx.api.set('services/' + nid, copy);
      if (ok) { ctx.setRoute({ view: 'library', serviceId: nid, tab: 'overview' }); ctx.toast('Duplicated as ' + copy.name); }
    }
    function del() {
      ctx.confirm({
        title: 'Delete ' + (p.base.name || 'this service') + '?', body: "Estimators can no longer start estimates with it. Saved estimates keep their own copy of the rates and items.",
        confirmLabel: 'Delete service', danger: true,
        onConfirm: async function () { var ok = await ctx.api.del('services/' + p.id); if (ok) { ctx.setRoute({ view: 'library' }); ctx.toast('Deleted ' + p.base.name); } },
      });
    }
    var color = svcColor(svc);
    return html`<div class="stack">
      <section class="panel panel-pad stack">
        <div class="grid-2">
          <label class="field"><span>Service name</span><input class="input" id="svc-name" maxlength="200" value=${svc.name || ''} onInput=${function (e) { var v = e.target.value; mut(function (n) { n.name = v; }); }} /></label>
          <label class="field"><span>Position in lists</span><input class="input" id="svc-order" type="number" value=${E.num(svc.order)} onInput=${function (e) { var v = E.num(e.target.value); mut(function (n) { n.order = v; }); }} /></label>
        </div>
        <label class="field"><span>Description</span><input class="input" id="svc-desc" maxlength="300" value=${svc.description || ''} placeholder="Shown on the service card" onInput=${function (e) { var v = e.target.value; mut(function (n) { n.description = v; }); }} /></label>
        <div class="grid-2">
          <div class="field"><span>Icon</span><div class="icon-pick">${SERVICE_ICONS.map(function (ic) {
            return html`<button type="button" key=${ic} aria-label=${ic} aria-pressed=${svc.icon === ic ? 'true' : 'false'} onClick=${function () { mut(function (n) { n.icon = ic; }); }}><span class=${'tile sm t-' + color}><${Duo} name=${ic} size=${16} /></span></button>`;
          })}</div></div>
          <div class="field"><span>Colour</span><div class="swatches">${COLORS.map(function (c) {
            return html`<button type="button" key=${c} class=${'t-' + c} aria-label=${c} aria-pressed=${color === c ? 'true' : 'false'} onClick=${function () { mut(function (n) { n.color = c; }); }}><span style="width:14px;height:14px;border-radius:50%;background:currentColor;display:block"></span></button>`;
          })}</div></div>
        </div>
        <label class="check-line"><${Switch} id="svc-active" label="Active" checked=${!!svc.active} onChange=${function (v) { mut(function (n) { n.active = v; }); }} /> Active: estimators can choose this service for new estimates</label>
      </section>
      <section class="panel panel-pad">
        <${CardHead} icon="list" color="blue" title="Labels" desc="What this service calls its building blocks, such as Page and Section, or Feature and Screen." />
        <div class="grid-3">
          <label class="field"><span>Group</span><input class="input" id="lbl-category" maxlength="200" value=${labels.category} onInput=${function (e) { setLabel('category', e.target.value); }} /></label>
          <label class="field"><span>Item (one)</span><input class="input" id="lbl-item" maxlength="200" value=${labels.item} onInput=${function (e) { setLabel('item', e.target.value); }} /></label>
          <label class="field"><span>Items (many)</span><input class="input" id="lbl-items" maxlength="200" value=${labels.items} onInput=${function (e) { setLabel('items', e.target.value); }} /></label>
          <label class="field"><span>Sub-item (one)</span><input class="input" id="lbl-sub" maxlength="200" value=${labels.sub} onInput=${function (e) { setLabel('sub', e.target.value); }} /></label>
          <label class="field"><span>Sub-items (many)</span><input class="input" id="lbl-subs" maxlength="200" value=${labels.subs} onInput=${function (e) { setLabel('subs', e.target.value); }} /></label>
        </div>
      </section>
      <section class="panel panel-pad"><div class="row">
        <button class="btn" onClick=${duplicate}><${Icon} name="copy" /> Duplicate service</button>
        <span class="spacer"></span>
        <button class="btn danger" onClick=${del}><${Icon} name="trash" /> Delete service</button>
      </div></section>
    </div>`;
  }

  function EdRow(p) {
    return html`<div class="ed-row">
      <div class="ed-sum" role="button" tabindex="0" aria-expanded=${p.open ? 'true' : 'false'} onClick=${p.onToggle} onKeyDown=${function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onToggle(); } }}>
        <span class="t"><b>${p.title || 'Untitled'}</b>${p.meta ? html`<span>${p.meta}</span>` : null}</span>
        ${p.right}
        <span class="icon-btn chev" aria-hidden="true" aria-expanded=${p.open ? 'true' : 'false'}><${Icon} name="chevD" /></span>
      </div>
      ${p.open ? html`<div class="ed-form">${p.children}</div>` : null}
    </div>`;
  }
  function DefFields(p) {
    var x = p.x;
    return html`
      <label class="field"><span>Definition</span><input class="input" id=${p.idp + '-desc'} maxlength="500" value=${x.description || ''} placeholder="What it is, in one sentence" onInput=${function (e) { var v = e.target.value; p.set(function (t) { t.description = v; }); }} /></label>
      <div class="grid-2">
        <label class="field"><span>Includes</span><textarea class="textarea" id=${p.idp + '-inc'} maxlength="4000" placeholder="One per line. Feeds the estimate's assumptions." value=${x.includes || ''} onInput=${function (e) { var v = e.target.value; p.set(function (t) { t.includes = v; }); }}></textarea></label>
        <label class="field"><span>Excludes</span><textarea class="textarea" id=${p.idp + '-exc'} maxlength="4000" placeholder="One per line. Feeds the estimate's exclusions." value=${x.excludes || ''} onInput=${function (e) { var v = e.target.value; p.set(function (t) { t.excludes = v; }); }}></textarea></label>
      </div>`;
  }

  function ItemsTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    var so = useState(null), open = so[0], setOpen = so[1];
    var subs = svc.subItems || [];
    function setItem(iid, fn) { mut(function (n) { var t = n.items.filter(function (x) { return x.id === iid; })[0]; if (t) fn(t); }); }
    function addItem(catId) {
      var iid = uniqueId('new-' + labels.item, (svc.items || []).map(function (x) { return x.id; }));
      mut(function (n) { n.items.push({ id: iid, categoryId: catId, name: 'New ' + lower(labels.item), hours: 4, defaultSubs: [], allowMultiple: false, description: '', includes: '', excludes: '' }); });
      setOpen(iid);
    }
    function delItem(it) {
      var rules = (svc.gapRules || []).filter(function (r) { return (r.trigger.kind === 'item' && r.trigger.ref === it.id) || (r.suggest.kind === 'item' && r.suggest.ref === it.id); }).length;
      ctx.confirm({
        title: 'Delete ' + it.name + '?', body: 'It is removed from starter packs' + (rules ? ' and ' + rules + ' gap ' + plural(rules, 'rule', 'rules') : '') + '. Saved estimates keep their copy.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (n) {
          n.items = n.items.filter(function (x) { return x.id !== it.id; });
          (n.starterPacks || []).forEach(function (k) { k.items = k.items.filter(function (z) { return z !== it.id; }); });
          n.gapRules = (n.gapRules || []).filter(function (r) { return !((r.trigger.kind === 'item' && r.trigger.ref === it.id) || (r.suggest.kind === 'item' && r.suggest.ref === it.id)); });
        }); },
      });
    }
    function moveItem(it, dir) {
      mut(function (n) {
        var same = n.items.filter(function (x) { return x.categoryId === it.categoryId; });
        var i = same.findIndex(function (x) { return x.id === it.id; }), j = i + dir;
        if (j < 0 || j >= same.length) return;
        var a = n.items.indexOf(same[i]), b = n.items.indexOf(same[j]);
        var t = n.items[a]; n.items[a] = n.items[b]; n.items[b] = t;
      });
    }
    function moveCat(ci, dir) { mut(function (n) { var j = ci + dir; if (j < 0 || j >= n.categories.length) return; var t = n.categories[ci]; n.categories[ci] = n.categories[j]; n.categories[j] = t; }); }
    function delCat(c) {
      var count = (svc.items || []).filter(function (x) { return x.categoryId === c.id; }).length;
      var others = (svc.categories || []).filter(function (x) { return x.id !== c.id; });
      if (count && !others.length) { ctx.toast('Add another ' + lower(labels.category) + ' first, so its ' + lower(labels.items) + ' have somewhere to go.', 'bad'); return; }
      var go = function () { mut(function (n) { n.categories = n.categories.filter(function (x) { return x.id !== c.id; }); n.items.forEach(function (x) { if (x.categoryId === c.id) x.categoryId = others[0].id; }); }); };
      if (!count) { go(); return; }
      ctx.confirm({ title: 'Delete ' + c.name + '?', body: 'Its ' + count + ' ' + lower(plural(count, labels.item, labels.items)) + ' move to ' + others[0].name + '.', confirmLabel: 'Delete', danger: true, onConfirm: go });
    }
    function addCat() { mut(function (n) { n.categories.push({ id: uniqueId('group', n.categories.map(function (x) { return x.id; })), name: 'New ' + lower(labels.category) }); }); }

    return html`<div>
      ${(svc.categories || []).map(function (c, ci) {
        var items = (svc.items || []).filter(function (x) { return x.categoryId === c.id; });
        return html`<section class="panel cat-block" key=${c.id}>
          <div class="cat-block-head">
            <${Tile} size="sm" icon="folder" color=${catColor(ci)} />
            <input class="input sm" id=${'cat-' + c.id} maxlength="200" aria-label=${labels.category + ' name'} value=${c.name} onInput=${function (e) { var v = e.target.value; mut(function (n) { n.categories[ci].name = v; }); }} />
            <span class="paren" style="font-size:13px">(${items.length} ${lower(plural(items.length, labels.item, labels.items))})</span>
            <span class="spacer"></span>
            <button class="icon-btn" aria-label="Move group up" disabled=${ci === 0} onClick=${function () { moveCat(ci, -1); }}><${Icon} name="up" /></button>
            <button class="icon-btn" aria-label="Move group down" disabled=${ci === svc.categories.length - 1} onClick=${function () { moveCat(ci, 1); }}><${Icon} name="down" /></button>
            <button class="icon-btn danger" aria-label=${'Delete ' + c.name} onClick=${function () { delCat(c); }}><${Icon} name="trash" /></button>
          </div>
          ${items.map(function (it, ii) {
            var nsub = (it.defaultSubs || []).length;
            return html`<${EdRow} key=${it.id} title=${it.name} open=${open === it.id} onToggle=${function () { setOpen(open === it.id ? null : it.id); }}
              meta=${(nsub ? nsub + ' ' + lower(plural(nsub, labels.sub, labels.subs)) + ' · ' : '') + (it.allowMultiple ? 'quantity allowed' : 'single')}
              right=${html`<${Hrs} v=${E.libItemHours(svc, it)} ghost />`}>
              <div class="grid-3">
                <label class="field"><span>Name</span><input class="input" id=${'it-name-' + it.id} maxlength="200" value=${it.name} onInput=${function (e) { var v = e.target.value; setItem(it.id, function (t) { t.name = v; }); }} /></label>
                <label class="field"><span>${labels.category}</span><select class="select" id=${'it-cat-' + it.id} value=${it.categoryId} onChange=${function (e) { var v = e.target.value; setItem(it.id, function (t) { t.categoryId = v; }); }}>${svc.categories.map(function (cc) { return html`<option value=${cc.id}>${cc.name}</option>`; })}</select></label>
                <label class="field"><span>${nsub ? 'Base hours (added to ' + lower(labels.subs) + ')' : 'Hours'}</span><${Stepper} id=${'it-hours-' + it.id} value=${E.num(it.hours)} label="Hours" unit="h" onChange=${function (v) { setItem(it.id, function (t) { t.hours = v; }); }} /></label>
              </div>
              <label class="check-line"><input type="checkbox" class="cb" checked=${!!it.allowMultiple} onChange=${function (e) { var v = e.target.checked; setItem(it.id, function (t) { t.allowMultiple = v; }); }} /> Estimators can set a quantity (e.g. 3 × Service detail)</label>
              ${subs.length ? html`<div class="field"><span>Default ${lower(labels.subs)}</span><div class="chips">${subs.map(function (s) {
                var on = (it.defaultSubs || []).indexOf(s.id) >= 0;
                return html`<button type="button" class="chip" key=${s.id} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { setItem(it.id, function (t) { t.defaultSubs = on ? t.defaultSubs.filter(function (z) { return z !== s.id; }) : (t.defaultSubs || []).concat(s.id); }); }}>${s.name}<span class="count">${E.fmtHours(s.hours)}</span></button>`;
              })}</div><span class="hint">Added automatically when an estimator ticks this ${lower(labels.item)}.</span></div>` : null}
              <${DefFields} x=${it} idp=${'it-' + it.id} set=${function (fn) { setItem(it.id, fn); }} />
              <div class="ed-actions">
                <button class="btn sm" disabled=${ii === 0} onClick=${function () { moveItem(it, -1); }}><${Icon} name="up" size=${14} /> Up</button>
                <button class="btn sm" disabled=${ii === items.length - 1} onClick=${function () { moveItem(it, 1); }}><${Icon} name="down" size=${14} /> Down</button>
                <span class="spacer"></span>
                <button class="btn sm danger" onClick=${function () { delItem(it); }}><${Icon} name="trash" size=${14} /> Delete</button>
              </div>
            <//>`;
          })}
          <div class="add-custom"><button class="btn sm ghost" onClick=${function () { addItem(c.id); }}><${Icon} name="plus" /> Add ${lower(labels.item)}</button></div>
        </section>`;
      })}
      <button class="btn" onClick=${addCat}><${Icon} name="plus" /> Add ${lower(labels.category)}</button>
    </div>`;
  }

  function SubsTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    var so = useState(null), open = so[0], setOpen = so[1];
    function setSub(sid, fn) { mut(function (n) { var t = n.subItems.filter(function (x) { return x.id === sid; })[0]; if (t) fn(t); }); }
    function add() {
      var sid = uniqueId('new-' + labels.sub, (svc.subItems || []).map(function (x) { return x.id; }));
      mut(function (n) { n.subItems.push({ id: sid, name: 'New ' + lower(labels.sub), hours: 2, description: '', includes: '', excludes: '' }); });
      setOpen(sid);
    }
    function del(s) {
      var used = (svc.items || []).filter(function (it) { return (it.defaultSubs || []).indexOf(s.id) >= 0; }).length;
      ctx.confirm({ title: 'Delete ' + s.name + '?', body: used ? 'It is removed from ' + used + ' ' + lower(plural(used, labels.item, labels.items)) + ' that include it by default.' : 'No ' + lower(labels.items) + ' use it by default.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (n) { n.subItems = n.subItems.filter(function (x) { return x.id !== s.id; }); n.items.forEach(function (it) { it.defaultSubs = (it.defaultSubs || []).filter(function (z) { return z !== s.id; }); }); }); } });
    }
    return html`<section class="panel cat-block">
      <div class="cat-block-head"><${Tile} size="sm" icon="layers" color="teal" /><span style="font-weight:500">${labels.subs} library</span><span class="paren" style="font-size:13px">(reusable inside any ${lower(labels.item)})</span></div>
      ${(svc.subItems || []).length ? null : html`<div class="empty"><p>No ${lower(labels.subs)} yet.</p></div>`}
      ${(svc.subItems || []).map(function (s) {
        var used = (svc.items || []).filter(function (it) { return (it.defaultSubs || []).indexOf(s.id) >= 0; }).length;
        return html`<${EdRow} key=${s.id} title=${s.name} open=${open === s.id} onToggle=${function () { setOpen(open === s.id ? null : s.id); }}
          meta=${used ? 'Default in ' + used + ' ' + lower(plural(used, labels.item, labels.items)) : 'Not used by default'} right=${html`<${Hrs} v=${s.hours} ghost />`}>
          <div class="grid-2">
            <label class="field"><span>Name</span><input class="input" id=${'sub-name-' + s.id} maxlength="200" value=${s.name} onInput=${function (e) { var v = e.target.value; setSub(s.id, function (t) { t.name = v; }); }} /></label>
            <label class="field"><span>Hours</span><${Stepper} id=${'sub-hours-' + s.id} value=${E.num(s.hours)} label="Hours" unit="h" onChange=${function (v) { setSub(s.id, function (t) { t.hours = v; }); }} /></label>
          </div>
          <${DefFields} x=${s} idp=${'sub-' + s.id} set=${function (fn) { setSub(s.id, fn); }} />
          <div class="ed-actions"><span class="spacer"></span><button class="btn sm danger" onClick=${function () { del(s); }}><${Icon} name="trash" size=${14} /> Delete</button></div>
        <//>`;
      })}
      <div class="add-custom"><button class="btn sm ghost" onClick=${add}><${Icon} name="plus" /> Add ${lower(labels.sub)}</button></div>
    </section>`;
  }

  function OptionsTab(p) {
    var ctx = p.ctx, svc = p.svc, mut = p.mut, labels = p.labels;
    var so = useState(null), open = so[0], setOpen = so[1];
    var groups = svc.optionGroups || [];
    function setGroup(gi, fn) { mut(function (n) { fn(n.optionGroups[gi]); }); }
    function setOpt(gi, oi, fn) { mut(function (n) { fn(n.optionGroups[gi].options[oi], n.optionGroups[gi]); }); }
    function allOptIds() { var a = []; groups.forEach(function (g) { (g.options || []).forEach(function (o) { a.push(o.id); }); }); return a; }
    function addGroup() {
      var gid = uniqueId('options', groups.map(function (g) { return g.id; }));
      mut(function (n) { n.optionGroups.push({ id: gid, name: 'New option group', selection: 'multiple', description: '', options: [] }); });
    }
    function addOpt(gi) {
      var oid = uniqueId('option', allOptIds());
      mut(function (n) { n.optionGroups[gi].options.push({ id: oid, name: 'New option', input: 'toggle', rule: 'fixed', value: 4, default: false, locked: false, free: 0, min: 0, max: 99, unit: '', description: '' }); });
      setOpen(oid);
    }
    function refs(gid, oid) { return (svc.gapRules || []).filter(function (r) { return [r.trigger, r.suggest].some(function (x) { return x.kind === 'option' && x.group === gid && (!oid || x.ref === oid); }); }).length; }
    function delGroup(gi) {
      var g = groups[gi], n = refs(g.id);
      ctx.confirm({ title: 'Delete ' + g.name + '?', body: 'Its ' + g.options.length + ' ' + plural(g.options.length, 'option', 'options') + (n ? ' and ' + n + ' gap ' + plural(n, 'rule', 'rules') : '') + ' are removed. Saved estimates keep their copy.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (s) { s.optionGroups.splice(gi, 1); s.gapRules = (s.gapRules || []).filter(function (r) { return ![r.trigger, r.suggest].some(function (x) { return x.kind === 'option' && x.group === g.id; }); }); }); } });
    }
    function delOpt(gi, oi) {
      var g = groups[gi], o = g.options[oi], n = refs(g.id, o.id);
      ctx.confirm({ title: 'Delete ' + o.name + '?', body: n ? 'Also removes ' + n + ' gap ' + plural(n, 'rule', 'rules') + ' that use it.' : 'Saved estimates keep their copy.', confirmLabel: 'Delete', danger: true,
        onConfirm: function () { mut(function (s) { s.optionGroups[gi].options.splice(oi, 1); s.gapRules = (s.gapRules || []).filter(function (r) { return ![r.trigger, r.suggest].some(function (x) { return x.kind === 'option' && x.group === g.id && x.ref === o.id; }); }); }); } });
    }
    function moveGroup(gi, dir) { mut(function (n) { var j = gi + dir; if (j < 0 || j >= n.optionGroups.length) return; var t = n.optionGroups[gi]; n.optionGroups[gi] = n.optionGroups[j]; n.optionGroups[j] = t; }); }
    return html`<div>
      <p class="muted" style="margin-bottom:14px;max-width:70ch">Step 2 of every estimate. Percentages apply to base design hours (the total of all ${lower(labels.items)}). Use a locked option for the primary version, like Desktop, so its hours are the base.</p>
      ${groups.map(function (g, gi) {
        var single = g.selection === 'single';
        var gs = groupStyle(g, gi);
        return html`<section class="panel cat-block" key=${g.id}>
          <div class="cat-block-head">
            <${Tile} size="sm" icon=${gs.icon} color=${gs.color} />
            <input class="input sm" id=${'grp-name-' + g.id} maxlength="200" aria-label="Group name" value=${g.name} onInput=${function (e) { var v = e.target.value; setGroup(gi, function (t) { t.name = v; }); }} />
            <select class="select sm" style="width:auto" aria-label="Selection type" value=${g.selection} onChange=${function (e) { var v = e.target.value; setGroup(gi, function (t) { t.selection = v; if (v === 'single') { var seen = false; t.options.forEach(function (o) { o.input = 'toggle'; o.locked = false; if (o.default && !seen) seen = true; else o.default = false; }); if (!seen && t.options[0]) t.options[0].default = true; } }); }}>
              <option value="multiple">Several can be chosen</option><option value="single">Exactly one is chosen</option>
            </select>
            <span class="spacer"></span>
            <button class="icon-btn" aria-label="Move group up" disabled=${gi === 0} onClick=${function () { moveGroup(gi, -1); }}><${Icon} name="up" /></button>
            <button class="icon-btn" aria-label="Move group down" disabled=${gi === groups.length - 1} onClick=${function () { moveGroup(gi, 1); }}><${Icon} name="down" /></button>
            <button class="icon-btn danger" aria-label=${'Delete ' + g.name} onClick=${function () { delGroup(gi); }}><${Icon} name="trash" /></button>
          </div>
          <div style="padding:10px 16px;border-bottom:1px solid var(--line)"><input class="input sm" id=${'grp-desc-' + g.id} maxlength="300" aria-label="Group description" placeholder="Short description shown to estimators" value=${g.description || ''} onInput=${function (e) { var v = e.target.value; setGroup(gi, function (t) { t.description = v; }); }} /></div>
          ${(g.options || []).map(function (o, oi) {
            var qty = !single && o.input === 'quantity';
            var flags = [];
            if (single && o.default) flags.push('default choice');
            if (!single && o.locked) flags.push('always included');
            if (!single && !o.locked && !qty && o.default) flags.push('on by default');
            if (qty) flags.push('quantity, default ' + E.fmtNum(o.default));
            return html`<${EdRow} key=${o.id} title=${o.name} open=${open === o.id} onToggle=${function () { setOpen(open === o.id ? null : o.id); }} meta=${[E.ruleHint(o, labels, single) || 'No extra hours'].concat(flags).join(' · ')}>
              <div class="grid-2">
                <label class="field"><span>Name</span><input class="input" id=${'opt-name-' + o.id} maxlength="200" value=${o.name} onInput=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.name = v; }); }} /></label>
                <label class="field"><span>Description</span><input class="input" id=${'opt-desc-' + o.id} maxlength="300" value=${o.description || ''} onInput=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.description = v; }); }} /></label>
              </div>
              <div class="opt-grid">
                ${single ? null : html`<label class="field"><span>Input</span><select class="select" id=${'opt-input-' + o.id} value=${o.input} onChange=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.input = v; t.default = v === 'quantity' ? 0 : false; if (v === 'quantity') t.locked = false; }); }}><option value="toggle">On / off</option><option value="quantity">Quantity</option></select></label>`}
                <label class="field"><span>Adds</span><select class="select" id=${'opt-rule-' + o.id} value=${o.rule} onChange=${function (e) { var v = e.target.value; setOpt(gi, oi, function (t) { t.rule = v; }); }}>${RULES.map(function (r) { return html`<option value=${r.value}>${r.label}</option>`; })}</select></label>
                ${o.rule !== 'none' ? html`<label class="field"><span>${o.rule === 'percent' ? 'Percent' : 'Hours'}</span><${Stepper} id=${'opt-value-' + o.id} value=${E.num(o.value)} step=${o.rule === 'percent' ? 1 : 0.5} max=${o.rule === 'percent' ? 500 : 1000} label="Value" unit=${o.rule === 'percent' ? '%' : 'h'} onChange=${function (v) { setOpt(gi, oi, function (t) { t.value = v; }); }} /></label>` : null}
                ${qty ? html`<label class="field"><span>Default quantity</span><${Stepper} id=${'opt-def-' + o.id} value=${E.num(o.default)} step=${1} label="Default quantity" onChange=${function (v) { setOpt(gi, oi, function (t) { t.default = v; }); }} /></label>` : null}
                ${qty ? html`<label class="field"><span>Included free</span><${Stepper} id=${'opt-free-' + o.id} value=${E.num(o.free)} step=${1} label="Included free" onChange=${function (v) { setOpt(gi, oi, function (t) { t.free = v; }); }} /><span class="hint">e.g. 1 for the first language</span></label>` : null}
                ${qty ? html`<label class="field"><span>Minimum</span><${Stepper} id=${'opt-min-' + o.id} value=${E.num(o.min)} step=${1} label="Minimum" onChange=${function (v) { setOpt(gi, oi, function (t) { t.min = v; }); }} /></label>` : null}
                ${qty ? html`<label class="field"><span>Maximum</span><${Stepper} id=${'opt-max-' + o.id} value=${E.num(o.max, 99)} step=${1} label="Maximum" onChange=${function (v) { setOpt(gi, oi, function (t) { t.max = v; }); }} /></label>` : null}
              </div>
              <div class="row">
                ${single ? html`<label class="check-line"><input type="radio" class="cb" style="border-radius:50%" name=${'def-' + g.id} checked=${!!o.default} onChange=${function () { mut(function (n) { n.optionGroups[gi].options.forEach(function (z, zi) { z.default = zi === oi; }); }); }} /> Default choice</label>` : null}
                ${!single && !qty ? html`<label class="check-line"><input type="checkbox" class="cb" checked=${!!o.default} onChange=${function (e) { var v = e.target.checked; setOpt(gi, oi, function (t) { t.default = v; }); }} /> On by default</label>` : null}
                ${!single && !qty ? html`<label class="check-line"><input type="checkbox" class="cb" checked=${!!o.locked} onChange=${function (e) { var v = e.target.checked; setOpt(gi, oi, function (t) { t.locked = v; if (v) t.default = true; }); }} /> Always included (can't be turned off)</label>` : null}
                <span class="spacer"></span>
                <button class="btn sm danger" onClick=${function () { delOpt(gi, oi); }}><${Icon} name="trash" size=${14} /> Delete option</button>
              </div>
            <//>`;
          })}
          <div class="add-custom"><button class="btn sm ghost" onClick=${function () { addOpt(gi); }}><${Icon} name="plus" /> Add option</button></div>
        </section>`;
      })}
      <button class="btn" onClick=${addGroup}><${Icon} name="plus" /> Add option group</button>
    </div>`;
  }

  function PacksTab(p) {
    var svc = p.svc, mut = p.mut, labels = p.labels, ctx = p.ctx;
    var packs = svc.starterPacks || [];
    function setPack(ki, fn) { mut(function (n) { fn(n.starterPacks[ki]); }); }
    function add() { mut(function (n) { n.starterPacks = n.starterPacks || []; n.starterPacks.push({ id: uniqueId('pack', n.starterPacks.map(function (k) { return k.id; })), name: 'New starter pack', description: '', items: [] }); }); }
    return html`<div>
      <p class="muted" style="margin-bottom:14px;max-width:70ch">Bundles estimators add in one click, such as Standard auth or Corporate website.</p>
      ${packs.length ? null : html`<div class="panel" style="margin-bottom:16px"><div class="empty"><p>No starter packs yet.</p></div></div>`}
      ${packs.map(function (k, ki) {
        return html`<section class="panel panel-pad stack cat-block" key=${k.id}>
          <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
            <${Tile} icon="pack" color=${catColor(ki + 2)} />
            <div class="grid-2" style="flex:1">
              <label class="field"><span>Name</span><input class="input" id=${'pack-name-' + k.id} maxlength="200" value=${k.name} onInput=${function (e) { var v = e.target.value; setPack(ki, function (t) { t.name = v; }); }} /></label>
              <label class="field"><span>Description</span><input class="input" id=${'pack-desc-' + k.id} maxlength="300" value=${k.description || ''} onInput=${function (e) { var v = e.target.value; setPack(ki, function (t) { t.description = v; }); }} /></label>
            </div>
          </div>
          ${(svc.categories || []).map(function (c) {
            var items = (svc.items || []).filter(function (x) { return x.categoryId === c.id; });
            if (!items.length) return null;
            return html`<div class="field" key=${c.id}><span>${c.name}</span><div class="chips">${items.map(function (it) {
              var on = (k.items || []).indexOf(it.id) >= 0;
              return html`<button type="button" class="chip" key=${it.id} aria-pressed=${on ? 'true' : 'false'} onClick=${function () { setPack(ki, function (t) { t.items = on ? t.items.filter(function (z) { return z !== it.id; }) : (t.items || []).concat(it.id); }); }}>${it.name}</button>`;
            })}</div></div>`;
          })}
          <div class="ed-actions"><span class="paren" style="font-size:13px">(${(k.items || []).length} ${lower(plural((k.items || []).length, labels.item, labels.items))})</span><span class="spacer"></span>
            <button class="btn sm danger" onClick=${function () { ctx.confirm({ title: 'Delete ' + k.name + '?', confirmLabel: 'Delete', danger: true, onConfirm: function () { mut(function (n) { n.starterPacks.splice(ki, 1); }); } }); }}><${Icon} name="trash" size=${14} /> Delete pack</button></div>
        </section>`;
      })}
      <button class="btn" onClick=${add}><${Icon} name="plus" /> Add starter pack</button>
    </div>`;
  }

  function RulesTab(p) {
    var svc = p.svc, mut = p.mut, labels = p.labels;
    var rules = svc.gapRules || [];
    function enc(x) { return x.kind === 'item' ? 'item:' + x.ref : 'option:' + x.group + ':' + x.ref; }
    function dec(v) { var a = v.split(':'); return a[0] === 'item' ? { kind: 'item', ref: a[1] } : { kind: 'option', group: a[1], ref: a[2] }; }
    function optionsEl() {
      return [].concat(
        (svc.categories || []).map(function (c) {
          var items = (svc.items || []).filter(function (x) { return x.categoryId === c.id; });
          return items.length ? html`<optgroup label=${labels.items + ' · ' + c.name} key=${'c-' + c.id}>${items.map(function (it) { return html`<option value=${'item:' + it.id}>${it.name}</option>`; })}</optgroup>` : null;
        }),
        (svc.optionGroups || []).map(function (g) {
          return (g.options || []).length ? html`<optgroup label=${'Scope · ' + g.name} key=${'g-' + g.id}>${g.options.map(function (o) { return html`<option value=${'option:' + g.id + ':' + o.id}>${o.name}</option>`; })}</optgroup>` : null;
        })
      );
    }
    function add() {
      var its = svc.items || [];
      if (its.length < 2) return;
      mut(function (n) { n.gapRules = n.gapRules || []; n.gapRules.push({ id: uniqueId('rule', n.gapRules.map(function (r) { return r.id; })), trigger: { kind: 'item', ref: its[0].id }, suggest: { kind: 'item', ref: its[1].id }, message: '' }); });
    }
    return html`<div>
      <p class="muted" style="margin-bottom:14px;max-width:70ch">Suggestions shown while estimating. When the first thing is in an estimate and the second isn't, the estimator sees the suggestion with your message.</p>
      <section class="panel cat-block">
        <div class="cat-block-head"><${Tile} size="sm" icon="bulb" color="yellow" /><span style="font-weight:500">Gap rules</span><span class="paren" style="font-size:13px">(${rules.length})</span></div>
        ${rules.length ? null : html`<div class="empty"><p>No gap rules yet.</p></div>`}
        ${rules.map(function (r, ri) {
          return html`<div class="rule-row" key=${r.id}>
            <label class="field"><span>When this is added</span><select class="select" id=${'rule-t-' + r.id} value=${enc(r.trigger)} onChange=${function (e) { var v = dec(e.target.value); mut(function (n) { n.gapRules[ri].trigger = v; }); }}>${optionsEl()}</select></label>
            <span class="arrow"><${Icon} name="arrowR" /></span>
            <label class="field"><span>Suggest</span><select class="select" id=${'rule-s-' + r.id} value=${enc(r.suggest)} onChange=${function (e) { var v = dec(e.target.value); mut(function (n) { n.gapRules[ri].suggest = v; }); }}>${optionsEl()}</select></label>
            <button class="icon-btn danger" style="align-self:end" aria-label="Delete rule" onClick=${function () { mut(function (n) { n.gapRules.splice(ri, 1); }); }}><${Icon} name="trash" /></button>
            <input class="input sm rule-msg" id=${'rule-m-' + r.id} maxlength="300" aria-label="Message" placeholder="Why it's suggested, e.g. A cart usually leads to a checkout flow." value=${r.message || ''} onInput=${function (e) { var v = e.target.value; mut(function (n) { n.gapRules[ri].message = v; }); }} />
          </div>`;
        })}
        <div class="add-custom"><button class="btn sm ghost" disabled=${(svc.items || []).length < 2} onClick=${add}><${Icon} name="plus" /> Add rule</button></div>
      </section>
    </div>`;
  }
