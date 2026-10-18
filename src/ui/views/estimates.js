// ------------------------------------------------------------------ estimates dashboard
  function StartCard(p) {
    var ctx = p.ctx;
    var sb = useState(null), busy = sb[0], setBusy = sb[1];
    var active = (ctx.serviceList || []).filter(function (s) { return s.active; });
    if (!active.length) return null;
    async function quick(svc) { if (busy) return; setBusy(svc.id); await ctx.startEstimate(svc); setBusy(null); }
    return html`<section class="panel hero-card">
      <button class="start-card" onClick=${function () { ctx.setRoute({ view: 'new' }); }}>
        <span class="pill new">${active.length} ${plural(active.length, 'service', 'services')}</span>
        <h2>Start an estimate</h2>
        <p>Pick a service, set the scope and tick what's in. The hours add up as you go.</p>
        <span class="go">Name it first <${Icon} name="arrowR" size=${14} /></span>
      </button>
      <div class="svc-menu">${active.map(function (svc) {
        return html`<button class="menu-item" key=${svc.id} disabled=${!!busy} onClick=${function () { quick(svc); }}>
          <${SvcTile} svc=${svc} />
          <span class="t"><b><bdi>${svc.name}</bdi></b><span>${busy === svc.id ? 'Creating estimate…' : svc.description}</span></span>
        </button>`;
      })}</div>
      <div class="menu-foot">
        <button class="link-arrow" onClick=${function () { ctx.setRoute({ view: 'new' }); }}>Name and start <${Icon} name="arrowUR" size=${13} /></button>
        ${ctx.role === 'admin' ? html`<button class="link-arrow" onClick=${function () { ctx.setRoute({ view: 'library' }); }}>Edit the library <${Icon} name="arrowUR" size=${13} /></button>` : null}
        ${ctx.role === 'admin' ? html`<button class="link-arrow" onClick=${function () { ctx.setRoute({ view: 'settings' }); }}>Overhead & buffer <${Icon} name="arrowUR" size=${13} /></button>` : null}
      </div>
    </section>`;
  }
  function EstimatesView(p) {
    var ctx = p.ctx, estimates = ctx.estimates;
    var sq = useState(local.get('q', '')), q = sq[0], setQ = sq[1];
    var ss = useState(local.get('status', 'all')), status = ss[0], setStatus = ss[1];
    var ids = useMemo(function () {
      var m = {}; (estimates || []).forEach(function (e) { if (e.createdBy) m[e.createdBy] = 1; }); return Object.keys(m);
    }, [estimates]);
    var profiles = useProfiles(ctx.caps && ctx.caps.user, ids);
    var svcById = ctx.services || {};

    var head = html`<div class="page-head">
      <div><h1>Estimates</h1><p>Every quote your team has scoped, with its hours, status and owner.</p></div>
      <button class="btn primary only-narrow" onClick=${function () { ctx.setRoute({ view: 'new' }); }}><${Icon} name="plus" /> New estimate</button>
    </div>`;
    if (estimates === null) {
      return html`${head}<div class="panel panel-pad stack" aria-busy="true"><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:55%"></div></div>`;
    }
    var noServices = ctx.serviceList && !ctx.serviceList.some(function (s) { return s.active; });
    if (!estimates.length) {
      return html`${head}<${StartCard} ctx=${ctx} /><div class="panel"><div class="empty first">
        <${Tile} size="lg" icon="list" color="blue" />
        <h2>No estimates yet</h2>
        <p>Pick a service, set the scope, tick the pages or features in scope and the hours add up as you go. Export to CSV or Excel when you're done.</p>
        ${noServices && ctx.role === 'admin' ? html`<button class="btn" onClick=${function () { ctx.setRoute({ view: 'library' }); }}><${Icon} name="book" /> Set up the library first</button>`
          : html`<button class="btn primary" onClick=${function () { ctx.setRoute({ view: 'new' }); }}><${Icon} name="plus" /> Create your first estimate</button>`}
      </div></div>`;
    }
    var counts = { all: estimates.length };
    E.STATUSES.forEach(function (s) { counts[s.id] = estimates.filter(function (e) { return (e.status || 'draft') === s.id; }).length; });
    var ql = q.trim().toLowerCase();
    var list = estimates.filter(function (e) {
      if (status !== 'all' && (e.status || 'draft') !== status) return false;
      if (!ql) return true;
      return lower(e.name).indexOf(ql) >= 0 || lower(e.client).indexOf(ql) >= 0 || lower(e.serviceName).indexOf(ql) >= 0;
    });
    var sum = list.reduce(function (s, e) { return s + E.num(e.totalHours); }, 0);
    var costSum = list.reduce(function (s, e) {
      var rate = E.num(e.hourlyRate, (e.snapshot && e.snapshot.hourlyRate) || (ctx.settings && ctx.settings.hourlyRate) || 100);
      return s + (e.totalCost ? E.num(e.totalCost) : Math.round(E.num(e.totalHours) * rate));
    }, 0);
    return html`${head}
      <${StartCard} ctx=${ctx} />
      <section class="panel est-table">
        <div class="toolbar">
          <label class="search"><span class="sr">Search estimates</span><${Icon} name="search" />
            <input class="input" id="est-search" maxlength="100" placeholder="Search by name, client or service" value=${q} onInput=${function (e) { setQ(e.target.value); local.set('q', e.target.value); }} />
          </label>
          <div class="chips" role="group" aria-label="Filter by status">
            ${[{ id: 'all', name: 'All' }].concat(E.STATUSES).map(function (s) {
              return html`<button class="chip" key=${s.id} aria-pressed=${status === s.id ? 'true' : 'false'} onClick=${function () { setStatus(s.id); local.set('status', s.id); }}>${s.name} <span class="count">${E.fmtNum(counts[s.id])}</span></button>`;
            })}
          </div>
        </div>
        <div class="est-head" aria-hidden="true"><span>Estimate</span><span>Service</span><span>Status</span><span style="text-align:right">Hours</span><span>Updated</span><span></span><span></span></div>
        ${list.length ? list.map(function (e) {
          var svc = svcById[e.serviceId];
          var prof = e.createdBy ? profiles[e.createdBy] : null;
          var st = statusOf(e.status), ename = nm(e.name, 'Untitled estimate'), client = nm(e.client, '');
          function open() { ctx.setRoute({ view: 'estimate', id: e.id, step: 'review' }); }
          return html`<div class="est-row" key=${e.id} onClick=${function (ev) { if (!ev.target.closest('.est-actions, .est-open')) open(); }}>
            <div class="est-main"><${SvcTile} svc=${svc} /><button type="button" class="est-open est-name" title=${ename + (client ? ' (' + client + ')' : '')} onClick=${open}><bdi>${ename}</bdi>${client ? html` <span class="paren">(<bdi>${client}</bdi>)</span>` : null}</button></div>
            <div class="est-svc"><span title=${e.serviceName || ''}><bdi>${e.serviceName || ''}</bdi></span></div>
            <div><span class=${'pill s-' + st.id}>${st.name}</span></div>
            <div style="text-align:right">
              <${Hrs} v=${e.totalHours || 0} ghost=${!e.totalHours} />
              ${(e.totalCost || e.totalHours) ? html`<div class="row-sub-cost">${E.fmtMoney(e.totalCost || Math.round(E.num(e.totalHours) * E.num(e.hourlyRate, 100)), e.currency || (ctx.settings && ctx.settings.currency) || 'USD')}</div>` : null}
            </div>
            <div class="est-when">${ago(e.updatedAt)}</div>
            <div>${prof ? html`<${Avatar} sm key=${prof.avatarUrl || 'none'} url=${prof.avatarUrl} name=${prof.name} title=${'Created by ' + nm(prof.name, 'a teammate')} />` : null}</div>
            <div class="est-actions">
              <button class="icon-btn" aria-label=${'Duplicate ' + ename} title="Duplicate" onClick=${function (ev) { ev.stopPropagation(); ctx.duplicateEstimate(e); }}><${Icon} name="copy" /></button>
              <button class="icon-btn danger" aria-label=${'Delete ' + ename} title="Delete" onClick=${function (ev) { ev.stopPropagation(); ctx.deleteEstimate(e); }}><${Icon} name="trash" /></button>
            </div>
          </div>`;
        }) : html`<div class="empty"><h2>No matching estimates</h2><p>Try another search or status.</p></div>`}
        ${ctx.hasMore ? html`<div class="est-more"><span class="muted" style="font-size:13px;margin-right:12px">Showing the ${E.fmtNum(estimates.length)} most recent estimates.</span><button class="btn sm" onClick=${ctx.moreEstimates}>Show ${E.fmtNum(500)} more</button></div>` : null}
        <div class="list-foot"><span>${E.fmtNum(list.length)} ${plural(list.length, 'estimate', 'estimates')}</span><span>Total <b class="tnum" style="color:var(--ink);font-weight:600">${E.fmtHours(sum)}</b> <span class="cost-foot">· ${E.fmtMoney(costSum, (ctx.settings && ctx.settings.currency) || 'USD')}</span></span></div>
      </section>`;
  }

  // ------------------------------------------------------------------ new estimate (step 1)
  function serviceStats(svc) {
    var l = Object.assign({}, E.DEFAULT_LABELS, svc.labels || {});
    var ni = (svc.items || []).length, ns = (svc.subItems || []).length;
    var out = [ni + ' ' + lower(plural(ni, l.item, l.items))];
    if (ns) out.push(ns + ' ' + lower(plural(ns, l.sub, l.subs)));
    return out;
  }
  function NewEstimate(p) {
    var ctx = p.ctx;
    var sn = useState(''), name = sn[0], setName = sn[1];
    var sc = useState(''), client = sc[0], setClient = sc[1];
    var sb = useState(null), busy = sb[0], setBusy = sb[1];
    var active = (ctx.serviceList || []).filter(function (s) { return s.active; });
    async function start(svc) {
      if (busy) return;
      setBusy(svc.id);
      await ctx.startEstimate(svc, name, client);
      setBusy(null);
    }
    return html`<div class="crumbs"><button onClick=${function () { ctx.setRoute({ view: 'estimates' }); }}>Estimates</button><${Icon} name="chevR" size=${12} /><span>New estimate</span></div>
      <div class="page-head"><div><h1>New estimate</h1><p>Name it, then choose what you're estimating.</p></div></div>
      <div class="stack">
        <section class="panel panel-pad">
          <${CardHead} icon="file" color="blue" title="Details" desc="Shown on the dashboard and at the top of exports." />
          <div class="grid-2">
            <label class="field"><span>Estimate name</span><input class="input" id="new-name" maxlength="200" placeholder="e.g. Acme website redesign" value=${name} onInput=${function (e) { setName(e.target.value); }} /></label>
            <label class="field"><span>Client</span><input class="input" id="new-client" maxlength="200" placeholder="e.g. Acme Ltd" value=${client} onInput=${function (e) { setClient(e.target.value); }} /></label>
          </div>
        </section>
        <section class="panel panel-pad">
          <${CardHead} icon="layers" color="green" title="What are you estimating?" desc="The service decides which scope options and building blocks you get." />
          ${ctx.serviceList === null ? html`<div class="skeleton" style="width:50%"></div>`
          : active.length ? html`<div class="svc-grid">${active.map(function (svc) {
              return html`<button class="svc-card" key=${svc.id} disabled=${!!busy} onClick=${function () { start(svc); }}>
                <${SvcTile} svc=${svc} size="lg" />
                <span class="t">
                  <span class="svc-name">${svc.name}</span>
                  <span class="svc-desc">${busy === svc.id ? 'Creating estimate…' : svc.description}</span>
                  <span class="svc-stats">${serviceStats(svc).map(function (t) { return html`<span class="tag" key=${t}>${t}</span>`; })}</span>
                </span>
              </button>`;
            })}</div>`
          : html`<div class="empty"><h2>No services are set up yet</h2>
              ${ctx.role === 'admin' ? html`<p>Add a service such as Website or Mobile app in the library, with its pages or features and their hours.</p><button class="btn primary" onClick=${function () { ctx.setRoute({ view: 'library' }); }}><${Icon} name="book" /> Open the library</button>`
                : html`<p>Ask an admin to add services in the library.</p>`}
            </div>`}
        </section>
      </div>`;
  }
