// ================================================================== App
  function App() {
    var s1 = useState('loading'), phase = s1[0], setPhase = s1[1];
    var s2 = useState(null), caps = s2[0], setCaps = s2[1];
    var s3 = useState(null), me = s3[0], setMe = s3[1];
    var s4 = useState('estimator'), role = s4[0], setRole = s4[1];
    var s5 = useState(false), readOnly = s5[0], setReadOnly = s5[1];
    var s6 = useState(null), services = s6[0], setServices = s6[1];
    var s7 = useState(null), settingsDoc = s7[0], setSettingsDoc = s7[1];
    var s8 = useState(null), estimates = s8[0], setEstimates = s8[1];
    var s9 = useState(function () { var r = local.get('route', null); return r && r.view ? r : { view: 'estimates' }; }), route = s9[0], setRouteState = s9[1];
    var s10 = useState([]), toasts = s10[0], setToasts = s10[1];
    var s11 = useState(null), dialog = s11[0], setDialog = s11[1];
    var s14 = useState(null), sampleFn = s14[0], setSampleFn = s14[1];
    var sTheme = useState(function () { try { return localStorage.getItem('dhe_theme') || 'system'; } catch (e) { return 'system'; } }), theme = sTheme[0], setTheme = sTheme[1];
    var roleRef = useRef(role); roleRef.current = role;

    useEffect(function () {
      if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('dhe_theme', theme); } catch (e) {}
    }, [theme]);
    useEffect(function () {
      function onExtChange() {
        var t = localStorage.getItem('dhe_theme') || 'system';
        setTheme(function (cur) { return cur === t ? cur : t; });
      }
      window.addEventListener('themechange', onExtChange);
      window.addEventListener('storage', onExtChange);
      return function () {
        window.removeEventListener('themechange', onExtChange);
        window.removeEventListener('storage', onExtChange);
      };
    }, []);
    var toggleTheme = useCallback(function () {
      setTheme(function (cur) {
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        return isDark ? 'light' : 'dark';
      });
    }, []);

    var toast = useCallback(function (text, kind, action) {
      var id = Math.random();
      setToasts(function (t) { if (!action && t.some(function (x) { return x.text === text; })) return t; return t.concat({ id: id, text: text, kind: kind, action: action }).slice(-3); });
      var life = kind === 'bad' ? 6500 : action ? 6000 : 3200;
      setTimeout(function () { setToasts(function (t) { return t.map(function (x) { return x.id === id ? Object.assign({}, x, { leaving: true }) : x; }); }); }, life - 180);
      setTimeout(function () { setToasts(function (t) { return t.filter(function (x) { return x.id !== id; }); }); }, life);
    }, []);
    var setRoute = useCallback(function (r) {
      if (r) Telemetry.crumb('nav', 'View ' + r.view + (r.step ? ':' + r.step : ''));
      setRouteState(r);
      local.set('route', { view: r.view, id: r.id, step: r.step, serviceId: r.serviceId, tab: r.tab });
      try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    }, []);

    // A listener the platform ends with "unavailable" only comes back by subscribing again,
    // so each live query re-subscribes with back-off before telling the person to reload.
    function watch(make, onData) {
      var tries = 0, un = null, t = null, stopped = false;
      function start() {
        if (stopped) return;
        try { un = make().onSnapshot(function (snap) { tries = 0; onData(snap); }, onErr); } catch (e) { onErr(e); }
      }
      function onErr(e) {
        var code = e && e.code;
        if (stopped) return;
        if (code === 'revoked') { setPhase('revoked'); return; }
        try { if (un) un(); } catch (x) { /* already ended */ }
        un = null;
        if (tries < 5 && code !== 'invalid_argument' && code !== 'not_granted' && code !== 'capability_disabled' && code !== 'capability_removed') {
          tries++; t = setTimeout(start, Math.min(16000, 1000 * Math.pow(2, tries - 1)));
        } else toast('Lost the connection to the data store. Reload the page to reconnect.', 'bad');
      }
      start();
      return function () { stopped = true; clearTimeout(t); try { if (un) un(); } catch (e) { /* ignore */ } };
    }
    useEffect(function () {
      var unsubs = [], live = true;
      (async function () {
        if (!window.claude || typeof window.claude.use !== 'function') { setPhase('outside'); return; }
        var got = await Promise.all(['db', 'user', 'downloads', 'team'].map(function (n) { return window.claude.use(n).catch(function () { return null; }); }));
        if (!live) return;
        var db = got[0], user = got[1], downloads = got[2], team = got[3];
        if (!db) { setPhase('signedout'); return; }
        var meV = null, isAdmin = false, canWrite = null;
        if (user) {
          var r = await Promise.all([user.me(), user.canEdit(), user.can('data.write')]);
          meV = r[0]; isAdmin = !!r[1]; canWrite = r[2];
        }
        var rl = isAdmin ? 'admin' : (canWrite === false ? 'none' : 'estimator');
        setCaps({ db: db, user: user, downloads: downloads, team: team }); setMe(meV); setRole(rl); setPhase('ready');
        // Claude in the page (brief analyzer). Resolved on its own so a slow "no" never delays the app.
        window.claude.use('sample').then(function (sm) { if (live && sm) setSampleFn(function () { return sm; }); }).catch(function () { /* hidden */ });
        if (rl === 'none') return;
        unsubs.push(watch(function () { return db.collection('services'); }, function (snap) {
          var m = {}; snap.docs.forEach(function (d) { m[d.id] = E.normalizeService(d.data()); }); setServices(m);
        }));
        unsubs.push(watch(function () { return db.doc('config/settings'); }, function (snap) { setSettingsDoc(snap.exists ? snap.data() : false); }));
      })();
      return function () { live = false; unsubs.forEach(function (u) { try { u(); } catch (e) { /* ignore */ } }); };
    }, []);

    // Estimates load newest first, a page at a time; "Show more" raises the limit.
    var s12 = useState(EST_PAGE), estLimit = s12[0], setEstLimit = s12[1];
    var s13 = useState(false), hasMore = s13[0], setHasMore = s13[1];
    useEffect(function () {
      if (!caps || !caps.db || role === 'none') return;
      return watch(function () { return caps.db.collection('estimates').orderBy('updatedAt', 'desc').limit(estLimit + 1); }, function (snap) {
        setHasMore(snap.docs.length > estLimit);
        setEstimates(snap.docs.slice(0, estLimit).map(function (d) { return Object.assign({}, d.data(), { id: d.id }); }));
      });
    }, [caps, role, estLimit]);

    var api = useMemo(function () {
      if (!caps) return null;
      var chains = {};
      function report(e, size) {
        var code = e && e.code;
        if (code === 'invalid_argument' || code === 'transform_error') {
          if (size > DOC_LIMIT * 0.9) toast('This could not be saved because it is close to the 256 KB size limit (' + Math.ceil(size / 1024) + ' KB). Remove some items or long notes.', 'bad');
          else if (roleRef.current !== 'admin') { setReadOnly(true); toast('Your access level does not allow saving changes. Ask the owner for Contributor access.', 'bad'); }
          else toast('That change could not be saved. Reload the page and try again.', 'bad');
        } else if (code === 'quota_exceeded') toast('Storage is full. Delete old estimates to make room.', 'bad');
        else if (code === 'resource_exhausted') toast('Saving is busy right now. Your latest changes will be saved on your next edit.', 'bad');
        else if (code === 'revoked') setPhase('revoked');
        else toast('Changes could not be saved. Check your connection and try again.', 'bad');
      }
      async function attempt(fn, size) {
        try { await fn(); return true; } catch (e) {
          var code = e && e.code;
          if (code === 'unavailable' || code === 'resource_exhausted' || !code) {
            await new Promise(function (r) { setTimeout(r, (code === 'resource_exhausted' ? 1500 : 400) + Math.random() * 600); });
            try { await fn(); return true; } catch (e2) { report(e2, size); return false; }
          }
          report(e, size); return false;
        }
      }
      return {
        set: function (path, data) {
          var size = byteSize(data);
          if (size > DOC_LIMIT) {
            var kb = Math.ceil(size / 1024);
            toast(path.indexOf('estimates/') === 0 ? 'This estimate is too large to save (' + kb + ' KB of 256 KB). Remove some items or long notes, or split it into two estimates.' : 'This is too large to save (' + kb + ' KB of 256 KB). Remove some content and try again.', 'bad');
            return Promise.resolve(false);
          }
          var p = (chains[path] || Promise.resolve()).then(function () { return attempt(function () { return caps.db.doc(path).set(data); }, size); });
          chains[path] = p.catch(function () { return false; });
          return p;
        },
        del: function (path) { return attempt(function () { return caps.db.doc(path).delete(); }); },
      };
    }, [caps]);

    var serviceList = useMemo(function () {
      if (!services) return null;
      return Object.keys(services).map(function (id) { return Object.assign({}, services[id], { id: id }); })
        .sort(function (a, b) { return (E.num(a.order) - E.num(b.order)) || String(a.name).localeCompare(String(b.name)); });
    }, [services]);

    var confirm = useCallback(function (d) { setDialog(d); }, []);
    var settings = useMemo(function () { return E.normalizeSettings(settingsDoc || FALLBACK_SETTINGS); }, [settingsDoc]);

    async function startEstimate(svc, name, client) {
      var est = E.createEstimate(svc, svc.id, settings, { name: String(name || '').trim() || (svc.name + ' estimate'), client: String(client || '').trim(), userId: me && me.id });
      var id = newId();
      var ok = await api.set('estimates/' + id, clean(est));
      if (ok) setRoute({ view: 'estimate', id: id, step: 'scope', initial: est });
      return ok;
    }
    async function duplicateEstimate(src) {
      var id = newId(), now = Date.now();
      var copy = clean(src);
      Object.assign(copy, { name: (src.name || 'Untitled estimate') + ' (copy)', status: 'draft', createdAt: now, updatedAt: now, createdBy: (me && me.id) || null, updatedBy: (me && me.id) || null });
      var ok = await api.set('estimates/' + id, copy);
      if (ok) toast('Duplicated ' + (src.name || 'estimate'));
    }
    function deleteEstimate(est) {
      confirm({
        title: 'Delete ' + nm(est.name, 'this estimate') + '?', body: 'This removes it for everyone and cannot be undone.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: async function () {
          var ok = await api.del('estimates/' + est.id);
          if (ok) {
            toast('Deleted ' + nm(est.name, 'estimate'));
            try { var vs = await caps.db.collection('estimates/' + est.id + '/versions').get(); vs.docs.forEach(function (d) { api.del('estimates/' + est.id + '/versions/' + d.id); }); } catch (e) { /* versions are best effort */ }
          }
        },
      });
    }

    var ctx = {
      caps: caps, api: api, me: me, role: role, readOnly: readOnly, services: services, serviceList: serviceList,
      settings: settings, settingsDoc: settingsDoc, estimates: estimates, toast: toast, confirm: confirm,
      theme: theme, setTheme: setTheme, toggleTheme: toggleTheme,
      route: route, setRoute: setRoute, hasMore: hasMore, sample: sampleFn, moreEstimates: function () { setEstLimit(function (n) { return n + EST_PAGE; }); }, startEstimate: startEstimate, duplicateEstimate: duplicateEstimate, deleteEstimate: deleteEstimate,
    };

    if (phase === 'loading') return html`<${Loading} />`;
    if (phase === 'outside') return html`<${Notice} title="Open the estimator in Claude">The estimator keeps its library and estimates in Claude, so it works when opened from claude.ai or the Claude app.<//>`;
    if (phase === 'signedout') return html`<${Notice} title="Sign in to use the estimator">Sign in to claude.ai, then open this page again. Your library and estimates load once you're signed in.<//>`;
    if (phase === 'revoked') return html`<${Notice} title="Access to the estimator changed">Reload the page to continue.<//>`;
    if (role === 'none') return html`<${Notice} title="You have view-only access">Ask the owner for Contributor access to create estimates, or Editor access to manage the library.<//>`;

    var view;
    var isAdmin = role === 'admin';
    if (route.view === 'new') view = html`<${NewEstimate} ctx=${ctx} />`;
    else if (route.view === 'estimate' && route.id) view = html`<${EstimateEditor} key=${route.id} ctx=${ctx} />`;
    else if (route.view === 'library' && isAdmin) view = html`<${LibraryView} ctx=${ctx} />`;
    else if (route.view === 'settings' && isAdmin) view = html`<${SettingsView} ctx=${ctx} />`;
    else view = html`<${EstimatesView} ctx=${ctx} />`;

    return html`
      <div class="shell">
        <${Sidebar} ctx=${ctx} />
        <main class="main"><div class="wrap">
          ${readOnly ? html`<div class="banner bad" style="margin-bottom:16px"><${Icon} name="lock" /><div class="grow"><b>View only.</b> Your changes are not being saved. Ask the owner for Contributor access.</div></div>` : null}
          <${Boundary} resetKey=${route.view + ':' + (route.id || route.serviceId || '')} api=${api} onHome=${function () { setRoute({ view: 'estimates' }); }}>${view}<//>
        </div></main>
      </div>
      ${dialog ? html`<${Modal} ...${dialog} onClose=${function () { setDialog(null); }} />` : null}
      <div class="toasts" role="status" aria-live="polite">
        ${toasts.map(function (t) {
          return html`<div class=${'toast ' + (t.kind || '') + (t.leaving ? ' leaving' : '')} key=${t.id}><span>${t.text}</span>${t.action ? html`<button class="btn sm light" style="height:26px" onClick=${function () { t.action.fn(); setToasts(function (x) { return x.filter(function (q) { return q.id !== t.id; }); }); }}>${t.action.label}</button>` : null}</div>`;
        })}
      </div>`;
  }

  function Boundary(p) {
    var eb = H.useErrorBoundary ? H.useErrorBoundary(function (err) {
      try {
        console.warn('Estimator view error:', err);
        Telemetry.record(err, { route: p.resetKey, severity: 'error', api: p.api });
      } catch (e) { /* ignore */ }
    }) : [null, function () {}];
    var err = eb[0], reset = eb[1];
    // clear the error when the person navigates elsewhere, without remounting (and resetting) the view's state
    var last = useRef(p.resetKey);
    useEffect(function () { if (last.current !== p.resetKey) { last.current = p.resetKey; if (err) reset(); } }, [p.resetKey]);
    if (err) return html`<div class="panel"><div class="empty">
      <${Tile} size="lg" icon="alert" color="red" />
      <h2>Something went wrong showing this page</h2>
      <p>${String((err && err.message) || err).slice(0, 160)}</p>
      <div class="row" style="justify-content:center;gap:8px">
        <button class="btn" onClick=${function () { reset(); p.onHome(); }}>Back to estimates</button>
        <button class="btn primary" onClick=${reset}>Try again</button>
        <button class="btn sm" title="Copy error report for support" onClick=${function () {
          var rep = Telemetry.getLogs()[0];
          if (rep && navigator.clipboard) navigator.clipboard.writeText(JSON.stringify(rep, null, 2));
        }}><${Icon} name="copy" size=${13} /> Copy diagnostics</button>
      </div>
    </div></div>`;
    return p.children;
  }

  function Loading() {
    return html`<div class="notice" aria-busy="true">
      <div class="brand-mark"><${BrandMark} /></div>
      <h1>Loading estimates and library</h1>
      <p>Connecting to your workspace.</p>
    </div>`;
  }
