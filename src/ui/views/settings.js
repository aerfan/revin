// ================================================================== settings
  // ------------------------------------------------------------------ team (standalone build only)
  var ROLE_LABEL = { admin: 'Admin', estimator: 'Estimator', pending: 'Waiting for approval', disabled: 'Removed' };
  function TeamPanel(p) {
    var ctx = p.ctx, team = ctx.caps.team;
    var sm = useState(null), members = sm[0], setMembers = sm[1];
    var si = useState([]), invites = si[0], setInvites = si[1];
    var sd = useState(null), ts = sd[0], setTs = sd[1];
    var se = useState(''), email = se[0], setEmail = se[1];
    var sr = useState('estimator'), irole = sr[0], setIrole = sr[1];
    var sdom = useState(''), dom = sdom[0], setDom = sdom[1];
    var sdr = useState('estimator'), domRole = sdr[0], setDomRole = sdr[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    async function load() {
      try {
        var r = await Promise.all([team.members(), team.invites(), team.settings()]);
        setMembers(r[0]); setInvites(r[1]); setTs(r[2]); setDom(r[2].allowed_domain || ''); setDomRole(r[2].domain_role || 'estimator');
      } catch (e) { setMembers([]); ctx.toast('Couldn’t load the team. Reload the page to try again.', 'bad'); }
    }
    useEffect(function () { load(); }, []);
    async function act(fn, done) {
      setBusy(true);
      try { await fn(); if (done) ctx.toast(done); await load(); }
      catch (e) { ctx.toast(/own role/i.test(e.message) ? 'You can’t change your own role. Ask another admin.' : 'That didn’t work: ' + String(e.message || e).slice(0, 120), 'bad'); }
      setBusy(false);
    }
    var mine = team.me.user_id;
    var pending = (members || []).filter(function (m) { return m.role === 'pending'; });
    var active = (members || []).filter(function (m) { return m.role === 'admin' || m.role === 'estimator'; });
    var removed = (members || []).filter(function (m) { return m.role === 'disabled'; });
    function who(m) { return html`<${Avatar} key=${m.avatar_url || 'none'} url=${m.avatar_url} name=${m.name || m.email} /><div class="grow team-who"><div class="team-name"><bdi>${nm(m.name, m.email)}</bdi>${m.user_id === mine ? html` <span class="paren">(you)</span>` : null}</div><div class="opt-hint"><bdi>${m.email}</bdi></div></div>`; }
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return html`<section class="panel panel-pad team">
      <${CardHead} icon="users" color="blue" title="Team" desc="Who can use the estimator. Admins manage the library, settings and team; estimators create and edit estimates." right=${pending.length ? html`<span class="pill s-review">${pending.length} waiting</span>` : null} />
      ${members === null ? html`<div class="skeleton" style="width:50%"></div>` : html`
        ${pending.length ? html`<div class="team-group"><div class="eyebrow">Waiting for approval</div>${pending.map(function (m) {
          return html`<div class="team-row pending" key=${m.user_id}>${who(m)}
            <button class="btn sm primary" disabled=${busy} onClick=${function () { act(function () { return team.setRole(m.user_id, 'estimator'); }, 'Approved ' + (m.name || m.email)); }}>Approve</button>
            <button class="btn sm ghost" disabled=${busy} onClick=${function () { act(function () { return team.setRole(m.user_id, 'disabled'); }, 'Declined ' + (m.name || m.email)); }}>Decline</button>
          </div>`; })}</div>` : null}
        <div class="team-group"><div class="eyebrow">Members</div>${active.map(function (m) {
          return html`<div class="team-row" key=${m.user_id}>${who(m)}
            ${m.user_id === mine ? html`<span class="role admin">Admin</span>` : html`<select class="select sm" aria-label=${'Role for ' + (m.name || m.email)} disabled=${busy} value=${m.role} onChange=${function (e) {
              var v = e.target.value;
              if (v === 'disabled') { e.target.value = m.role; ctx.confirm({ title: 'Remove ' + (m.name || m.email) + '?', body: 'They lose access straight away. Their estimates stay. You can restore them later.', confirmLabel: 'Remove', danger: true, onConfirm: function () { act(function () { return team.setRole(m.user_id, 'disabled'); }, 'Removed ' + (m.name || m.email)); } }); }
              else act(function () { return team.setRole(m.user_id, v); }, (m.name || m.email) + ' is now ' + (v === 'admin' ? 'an admin' : 'an estimator'));
            }}><option value="estimator">Estimator</option><option value="admin">Admin</option><option value="disabled">Remove…</option></select>`}
          </div>`; })}</div>
        ${removed.length ? html`<details class="team-removed"><summary>${removed.length} removed</summary>${removed.map(function (m) {
          return html`<div class="team-row" key=${m.user_id}>${who(m)}<button class="btn sm" disabled=${busy} onClick=${function () { act(function () { return team.setRole(m.user_id, 'estimator'); }, 'Restored ' + (m.name || m.email)); }}>Restore</button></div>`; })}</details>` : null}

        <div class="team-group"><div class="eyebrow">Invite</div>
          <form class="str-row team-invite" onSubmit=${function (e) { e.preventDefault(); if (!emailOk) return; var em = email.trim().toLowerCase(); act(function () { return team.invite(em, irole); }, 'Invited ' + em + '. They join as ' + (irole === 'admin' ? 'an admin' : 'an estimator') + ' when they sign up with this email.').then(function () { setEmail(''); }); }}>
            <input class="input" id="team-invite-email" type="email" placeholder="name@agency.com" aria-label="Email to invite" value=${email} onInput=${function (e) { setEmail(e.target.value); }} />
            <select class="select" aria-label="Role for the invite" value=${irole} onChange=${function (e) { setIrole(e.target.value); }}><option value="estimator">Estimator</option><option value="admin">Admin</option></select>
            <button class="btn" type="submit" disabled=${busy || !emailOk}><${Icon} name="plus" /> Invite</button>
          </form>
          <p class="opt-hint">They sign up at this page with that email (Google or password) and get access straight away. Share the link with them; no email is sent from here.</p>
          ${invites.length ? html`<div class="team-invites">${invites.map(function (iv) {
            return html`<div class="team-row" key=${iv.email}><div class="grow"><bdi>${iv.email}</bdi> <span class="paren">(${ROLE_LABEL[iv.role]}, not signed up yet)</span></div>
              <button class="icon-btn danger" aria-label=${'Cancel invite for ' + iv.email} disabled=${busy} onClick=${function () { act(function () { return team.cancelInvite(iv.email); }, 'Cancelled the invite for ' + iv.email); }}><${Icon} name="trash" /></button></div>`; })}</div>` : null}
        </div>

        <div class="team-group"><div class="eyebrow">Company domain</div>
          <form class="str-row team-domain" onSubmit=${function (e) { e.preventDefault(); act(function () { return team.saveSettings({ allowed_domain: dom.trim().replace(/^@/, '') || null, domain_role: domRole }); }, dom.trim() ? 'Saved the company domain' : 'Turned off automatic joining'); }}>
            <span class="team-at">@</span><input class="input" id="team-domain" placeholder="agency.com" aria-label="Company email domain" value=${dom} onInput=${function (e) { setDom(e.target.value); }} />
            <select class="select" aria-label="Role for people on this domain" value=${domRole} onChange=${function (e) { setDomRole(e.target.value); }}><option value="estimator">join as Estimator</option><option value="pending">need approval</option></select>
            <button class="btn" type="submit" disabled=${busy || ((ts && (ts.allowed_domain || '')) === dom.trim().replace(/^@/, '') && ts.domain_role === domRole)}>Save</button>
          </form>
          <p class="opt-hint">${dom.trim() ? 'Anyone who signs in with Google on @' + dom.trim().replace(/^@/, '') + (domRole === 'pending' ? ' waits for your approval.' : ' joins as an estimator automatically.') + ' Email-and-password sign-ups always need approval.' : 'Off: everyone who isn’t invited waits for approval.'}</p>
        </div>`}
    </section>`;
  }
  function BackupPanel(p) {
    var ctx = p.ctx, team = ctx.caps.team;
    var sb = useState(null), prog = sb[0], setProg = sb[1];
    async function exportAll() {
      setProg('Preparing backup…');
      try {
        var all = await team.exportAll();
        var blob = new Blob([JSON.stringify({ app: 'design-hours-estimator', version: 1, exportedAt: new Date().toISOString(), docs: all }, null, 1)], { type: 'application/json' });
        await saveFile(ctx, 'estimator-backup-' + today() + '.json', blob);
      } catch (e) { ctx.toast('The backup couldn’t be prepared. Try again.', 'bad'); }
      setProg(null);
    }
    function importFile(f) {
      f.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { ctx.toast('That file isn’t a backup (not valid JSON).', 'bad'); return; }
        var docs = j && j.docs && typeof j.docs === 'object' ? j.docs : j;
        var paths = Object.keys(docs || {}).filter(function (k) { return /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/.test(k) && k.split('/').length % 2 === 0; });
        if (!paths.length) { ctx.toast('No estimator data found in that file.', 'bad'); return; }
        var n = { s: 0, e: 0, v: 0, c: 0 };
        paths.forEach(function (k) { if (/^services\//.test(k)) n.s++; else if (/\/versions\//.test(k)) n.v++; else if (/^estimates\//.test(k)) n.e++; else n.c++; });
        ctx.confirm({ title: 'Import ' + paths.length + ' records?', body: n.s + ' services, ' + n.e + ' estimates, ' + n.v + ' versions and ' + n.c + ' other records. Records with the same name are replaced; everything else stays.', confirmLabel: 'Import',
          onConfirm: async function () {
            var sub = {}; paths.forEach(function (k) { sub[k] = docs[k]; });
            setProg('Importing 0 of ' + paths.length + '…');
            var r = await team.importAll(sub, function (d, t) { setProg('Importing ' + d + ' of ' + t + '…'); });
            setProg(null);
            ctx.toast(r.failed.length ? 'Imported ' + (r.total - r.failed.length) + ' of ' + r.total + '. ' + r.failed.length + ' couldn’t be saved (too large or invalid).' : 'Imported ' + r.total + ' records', r.failed.length ? 'bad' : null);
          } });
      });
    }
    return html`<section class="panel panel-pad">
      <${CardHead} icon="download" color="green" title="Backup" desc="Download everything (library, settings, estimates and versions) as one file, or load a backup, including one exported from the claude.ai version." />
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <button class="btn" disabled=${!!prog} onClick=${exportAll}><${Icon} name="download" /> Download backup</button>
        <label class=${'btn' + (prog ? ' disabled' : '')} style="cursor:pointer"><${Icon} name="upload" /> Import backup<input type="file" accept=".json,application/json" class="sr" disabled=${!!prog} onChange=${function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importFile(f); }} /></label>
        ${prog ? html`<span class="opt-hint" role="status">${prog}</span>` : null}
      </div>
    </section>`;
  }

  function HealthPanel(p) {
    var ctx = p.ctx;
    var st = useState(function () { return Telemetry.getLogs(); }), logs = st[0], setLogs = st[1];
    var so = useState(null), expanded = so[0], setExpanded = so[1];
    function clear() { Telemetry.clearLogs(); setLogs([]); ctx.toast('Diagnostics cleared'); }
    function copyAI(err) {
      var md = [
        '### Revin Error Report for AI Debugging',
        '- **Message**: `' + err.message + '`',
        '- **Severity**: ' + err.severity,
        '- **Route**: `' + (err.route || 'unknown') + '`',
        '- **Timestamp**: ' + new Date(err.time).toISOString(),
        '- **Browser**: `' + err.browser + '`',
        '- **Breadcrumbs**:',
        (err.breadcrumbs && err.breadcrumbs.length ? err.breadcrumbs.map(function (b, i) { return '  ' + (i + 1) + '. `[' + b.cat + ']` ' + b.msg; }).join('\n') : '  (none)'),
        '- **Stack Trace**:',
        '```',
        err.stack || 'No stack trace',
        '```'
      ].join('\n');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(md).then(function () {
          ctx.toast('Report copied in Markdown — ready to paste to AI assistant');
        }).catch(function () { ctx.toast('Failed to copy', 'bad'); });
      }
    }
    return html`<section class="panel panel-pad">
      <${CardHead} icon="shield" color="teal" title="System health & error diagnostics" desc="Client crash reports, breadcrumbs, and automated diagnostic summaries." />
      <div class="row" style="justify-content:space-between;margin-bottom:12px;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b>${logs.length === 0 ? 'All systems operational' : logs.length + ' incident(s) recorded'}</b>
          <span class="muted" style="margin-left:8px;font-size:12px">${logs.length === 0 ? 'Zero unhandled crashes' : 'Stored locally for immediate debugging'}</span>
        </div>
        ${logs.length > 0 ? html`<button class="btn sm danger" onClick=${clear}><${Icon} name="trash" size=${14} /> Clear logs</button>` : null}
      </div>
      ${logs.length === 0 ? html`<div class="banner" style="background:var(--bg-sub);border-color:var(--border-sub)"><${Icon} name="checkCircle" /><div class="grow">No runtime errors or unhandled exceptions recorded in this environment.</div></div>` : null}
      <div class="stack" style="gap:8px">
        ${logs.map(function (err) {
          var isExp = expanded === err.id;
          return html`<div class="panel panel-pad" key=${err.id} style="background:var(--bg-sub);border:1px solid var(--border)">
            <div class="row" style="justify-content:space-between;align-items:start;gap:8px">
              <div class="grow" style="cursor:pointer" onClick=${function () { setExpanded(isExp ? null : err.id); }}>
                <div style="font-weight:600;font-family:monospace;font-size:13px;color:var(--red, #e53e3e)">${err.message}</div>
                <div class="muted" style="font-size:12px;margin-top:2px">${ago(err.time)} · Route: ${err.route || 'app'} · Severity: ${err.severity}</div>
              </div>
              <div class="row" style="gap:6px">
                <button class="btn sm" title="Copy formatted Markdown for AI debugging" onClick=${function () { copyAI(err); }}><${Icon} name="copy" size=${13} /> Copy for AI</button>
                <button class="icon-btn" aria-label="Toggle stack trace" onClick=${function () { setExpanded(isExp ? null : err.id); }}><${Icon} name=${isExp ? 'up' : 'down'} size=${13} /></button>
              </div>
            </div>
            ${isExp ? html`<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px">Recent Actions (Breadcrumbs)</div>
              <ul style="margin:0 0 8px;padding-left:18px;font-size:12px" class="muted">
                ${(err.breadcrumbs || []).map(function (b, i) { return html`<li key=${i}><b>[${b.cat}]</b> ${b.msg}</li>`; })}
              </ul>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px">Stack Trace</div>
              <pre style="background:var(--bg);padding:8px;border-radius:4px;overflow-x:auto;font-size:11px;line-height:1.4">${err.stack || 'No stack trace'}</pre>
            </div>` : null}
          </div>`;
        })}
      </div>
    </section>`;
  }

  function SettingsView(p) {
    var ctx = p.ctx;
    var d = useDocDraft(ctx.settings);
    var ss = useState(false), saving = ss[0], setSaving = ss[1];
    var s = d.draft;
    async function save() {
      var prev = d.base;
      d.saved(s); setSaving(true);
      var out = clean(s); out.phases = E.normalizeSettings(out).phases;
      var ok = await ctx.api.set('config/settings', out);
      setSaving(false);
      if (ok) ctx.toast('Settings saved');
      else d.restore(prev);
    }
    if (ctx.settingsDoc === null) return html`<div class="panel panel-pad"><div class="skeleton" style="width:40%"></div></div>`;
    var cx = s.complexity || E.DEFAULT_COMPLEXITY, oh = s.overhead || [];
    return html`<div class="page-head"><div><h1>Settings</h1><p>Defaults for new estimates. Existing estimates keep their own values and can update their rates from the Review step.</p></div></div>
      <div class="stack">
        ${ctx.caps && ctx.caps.team && ctx.caps.team.isAdmin ? html`<${TeamPanel} ctx=${ctx} /><${BackupPanel} ctx=${ctx} /><${HealthPanel} ctx=${ctx} />` : (ctx.caps && !ctx.caps.team ? html`<${HealthPanel} ctx=${ctx} />` : null)}
        ${ctx.settingsDoc === false ? html`<div class="banner"><${Icon} name="info" /><div class="grow">No settings saved yet. These are starting values; save them to make them the defaults.</div></div>` : null}
        <section class="panel panel-pad">
          <${CardHead} icon="sliders" color="gray" title="General" desc="Shown on exports and used as the starting buffer." />
          <div class="grid-2">
            <label class="field"><span>Agency name</span><input class="input" id="set-agency" maxlength="200" value=${s.agencyName || ''} placeholder="Shown at the top of exported workbooks" onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.agencyName = v; }); }} /></label>
            <label class="field"><span>Default buffer</span><${Stepper} id="set-buffer" value=${E.num(s.bufferPercent)} step=${1} max=${100} unit="%" label="Default buffer" onChange=${function (v) { d.mut(function (n) { n.bufferPercent = v; }); }} /></label>
          </div>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="coins" color="green" title="Financials & rate cards" desc="Defaults for new estimates. Estimators can change the rate and currency per estimate." />
          <div class="grid-2">
            <label class="field"><span>Default currency</span>
              <select class="select" id="set-currency" aria-label="Default currency" value=${s.currency || 'USD'} onChange=${function (e) { var v = e.target.value; d.mut(function (n) { n.currency = v; }); }}>
                ${E.CURRENCIES.map(function (c) { return html`<option key=${c.id} value=${c.id} selected=${c.id === (s.currency || 'USD')}>${c.name}</option>`; })}
              </select>
            </label>
            <label class="field"><span>Default billing rate</span>
              <${Stepper} id="set-rate" value=${E.num(s.hourlyRate, 100)} step=${5} min=${1} max=${10000} label="Default billing rate" unit=${E.currencyInfo(s.currency || 'USD').symbol + '/h'} onChange=${function (v) { d.mut(function (n) { n.hourlyRate = v; }); }} />
            </label>
          </div>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="gauge" color="purple" title="Complexity levels" desc="Multipliers estimators apply per item. Standard is the default." />
          <div class="adjust">${cx.map(function (c, i) {
            return html`<div class="adj-row" key=${c.id}>
              <input class="input" style="max-width:180px" id=${'cx-name-' + c.id} maxlength="60" aria-label="Level name" value=${c.name} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.complexity = n.complexity || E.clone(cx); n.complexity[i].name = v; }); }} />
              <input class="input grow" id=${'cx-desc-' + c.id} maxlength="200" aria-label="Description" placeholder="When to use it" value=${c.description || ''} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.complexity = n.complexity || E.clone(cx); n.complexity[i].description = v; }); }} />
              <${Stepper} id=${'cx-mult-' + c.id} value=${E.num(c.multiplier, 1)} step=${0.05} min=${0.1} max=${5} unit="×" label=${c.name + ' multiplier'} onChange=${function (v) { d.mut(function (n) { n.complexity = n.complexity || E.clone(cx); n.complexity[i].multiplier = v; }); }} />
            </div>`;
          })}</div>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="clock" color="orange" title="Project overhead" desc="Added to every new estimate. Fixed hours, or a percentage of the design subtotal." />
          <div class="adjust">${oh.map(function (o, i) {
            return html`<div class="adj-row" key=${o.id}>
              <${Switch} id=${'ohs-' + o.id} label=${'Include ' + o.name + ' by default'} checked=${o.enabled !== false} onChange=${function (v) { d.mut(function (n) { n.overhead[i].enabled = v; }); }} />
              <div class="grow stack" style="gap:6px">
                <input class="input" id=${'oh-name-' + o.id} maxlength="120" aria-label="Overhead name" value=${o.name} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.overhead[i].name = v; }); }} />
                <input class="input sm" id=${'oh-desc-' + o.id} maxlength="300" aria-label="Description" placeholder="What it covers" value=${o.description || ''} onInput=${function (e) { var v = e.target.value; d.mut(function (n) { n.overhead[i].description = v; }); }} />
              </div>
              <select class="select" style="width:auto" aria-label="Rule" value=${o.rule} onChange=${function (e) { var v = e.target.value; d.mut(function (n) { n.overhead[i].rule = v; }); }}><option value="fixed">Fixed hours</option><option value="percent">% of design subtotal</option></select>
              <${Stepper} id=${'oh-val-' + o.id} value=${E.num(o.value)} step=${o.rule === 'percent' ? 1 : 0.5} max=${o.rule === 'percent' ? 100 : 1000} unit=${o.rule === 'percent' ? '%' : 'h'} label=${o.name} onChange=${function (v) { d.mut(function (n) { n.overhead[i].value = v; }); }} />
              <button class="icon-btn danger" aria-label=${'Delete ' + o.name} onClick=${function () { d.mut(function (n) { n.overhead.splice(i, 1); }); }}><${Icon} name="trash" /></button>
            </div>`;
          })}</div>
          <button class="btn sm" style="margin-top:12px" onClick=${function () { d.mut(function (n) { n.overhead = n.overhead || []; n.overhead.push({ id: uniqueId('overhead', n.overhead.map(function (x) { return x.id; })), name: 'New overhead item', rule: 'fixed', value: 2, enabled: true, description: '' }); }); }}><${Icon} name="plus" /> Add overhead item</button>
        </section>

        <section class="panel panel-pad">
          <${CardHead} icon="layers" color="teal" title="Phases" desc="Estimators assign each item to a phase; the review shows hours per phase." />
          <${StringList} unique idPrefix="phase" label="Phase" values=${s.phases || []} placeholder="e.g. Phase 4" onChange=${function (v) { d.mut(function (n) { n.phases = v; }); }} />
        </section>

        <div class="grid-2" style="align-items:start">
          <section class="panel panel-pad">
            <${CardHead} icon="checkCircle" color="green" title="Default assumptions" desc="Copied into every new estimate's register." />
            <${StringList} idPrefix="assume" label="Assumption" values=${s.defaultAssumptions || []} placeholder="Add an assumption" onChange=${function (v) { d.mut(function (n) { n.defaultAssumptions = v; }); }} />
          </section>
          <section class="panel panel-pad">
            <${CardHead} icon="xCircle" color="red" title="Default exclusions" desc="Copied into every new estimate's register." />
            <${StringList} idPrefix="exclude" label="Exclusion" values=${s.defaultExclusions || []} placeholder="Add an exclusion" onChange=${function (v) { d.mut(function (n) { n.defaultExclusions = v; }); }} />
          </section>
        </div>
      </div>
      <${SaveBar} dirty=${d.dirty || ctx.settingsDoc === false} saving=${saving} onSave=${save} onDiscard=${d.reset} />`;
  }
