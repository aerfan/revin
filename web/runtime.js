// Standalone runtime for the Design Hours Estimator.
// The app was written against claude.ai's runtime (`claude.use('db' | 'user' | 'downloads')`). This file
// provides the same interface on Supabase, puts a sign-in screen in front of it, and adds `team`
// (members, invites, sign-out, backups). The app itself is unchanged apart from reading `team`.
(function () {
  'use strict';
  var P = window.preact, H = window.preactHooks, html = window.htm.bind(P.h);
  var useState = H.useState, useEffect = H.useEffect;
  var cfg = window.DHE_CONFIG || {};
  var mount = document.getElementById('app');

  // ------------------------------------------------------------------ helpers
  function parentOf(p) { return p.split('/').slice(0, -1).join('/'); }
  function segs(p) { return String(p).split('/').length; }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Postgres/PostgREST errors → the error codes the app already understands.
  function mapErr(e) {
    var code = e && e.code, msg = String((e && (e.message || e.error_description)) || e || '');
    var out = new Error(msg || 'Request failed');
    if (code === '42501' || code === '22023' || code === '54000' || code === '23514') out.code = 'invalid_argument';
    else if (code === 'PGRST301' || code === '401' || /JWT/i.test(msg)) out.code = 'unavailable';
    else if (code === '429' || /rate limit/i.test(msg)) out.code = 'resource_exhausted';
    else if (/fetch|network|Load failed|timeout/i.test(msg)) out.code = 'unavailable';
    else out.code = 'unavailable';
    out.pgCode = code;
    return out;
  }
  async function call(sb, fn, args) {
    var r = await sb.rpc(fn, args);
    if (r.error) throw mapErr(r.error);
    return r.data;
  }

  // ------------------------------------------------------------------ db: claude.ai-style documents on Supabase
  function makeDb(sb) {
    var listeners = new Set(), channel = null, wasDown = false;
    function ensureChannel() {
      if (channel) return;
      channel = sb.channel('dhe-docs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, function (payload) {
          var p = (payload.new && payload.new.path) || (payload.old && payload.old.path);
          touched(p || null);
        })
        .subscribe(function (status) {
          if (status === 'SUBSCRIBED') { if (wasDown) touched(null); wasDown = false; }   // catch up after a drop
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') wasDown = true;
        });
    }
    // Something changed at path (null = unknown): refresh every listener that could see it.
    function touched(p) {
      var parent = p ? parentOf(p) : null;
      listeners.forEach(function (l) { if (!p || (l.kind === 'doc' && l.path === p) || (l.kind === 'query' && l.q.path === parent)) l.refresh(); });
    }
    function docSnap(path, data) {
      var d = data === null || data === undefined ? undefined : data;
      return { id: path.split('/').pop(), exists: d !== undefined, data: function () { return d; }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    function querySnap(q, rows) {
      var docs = rows.map(function (r) { return docSnap(q.path + '/' + r.id, r.data); });
      return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    async function getDoc(path) { return docSnap(path, await call(sb, 'get_doc', { p_path: path })); }
    async function runQuery(q) {
      var rows = await call(sb, 'query_docs', { p_parent: q.path, p_order: q.order ? q.order[0] : null, p_desc: !!(q.order && q.order[1] === 'desc'), p_limit: q.lim || null });
      return querySnap(q, rows || []);
    }
    function listen(l, fetch, cb, err) {
      var seq = 0, timer = null, stopped = false;
      l.refresh = function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          var mine = ++seq;
          fetch().then(function (s) { if (!stopped && mine === seq) cb(s); }, function (e) { if (!stopped && mine === seq && err) { stopped = true; listeners.delete(l); err(e); } });
        }, 40);
      };
      listeners.add(l); ensureChannel(); l.refresh();
      return function () { stopped = true; clearTimeout(timer); listeners.delete(l); };
    }
    function ref(path) {
      return {
        id: path.split('/').pop(), path: path,
        get: function () { return getDoc(path); },
        set: async function (data) {
          if (!data || typeof data !== 'object' || Array.isArray(data)) { var e = new Error('body must be an object'); e.code = 'invalid_argument'; throw e; }
          await call(sb, 'set_doc', { p_path: path, p_data: data }); touched(path);
        },
        update: async function (patch) { var cur = await getDoc(path); if (!cur.exists) { var e = new Error('not found'); e.code = 'invalid_argument'; throw e; } await this.set(Object.assign({}, cur.data(), patch)); },
        delete: async function () { await call(sb, 'delete_doc', { p_path: path }); touched(path); },
        onSnapshot: function (cb, err) { return listen({ kind: 'doc', path: path }, function () { return getDoc(path); }, cb, err); },
        collection: function (sub) { return coll(path + '/' + sub); },
      };
    }
    function query(q) {
      return {
        where: function () { throw Object.assign(new Error('where() is not supported'), { code: 'invalid_argument' }); },
        orderBy: function (f, dir) { return query(Object.assign({}, q, { order: [f, dir || 'asc'] })); },
        limit: function (n) { return query(Object.assign({}, q, { lim: n })); },
        get: function () { return runQuery(q); },
        onSnapshot: function (cb, err) { var l = { kind: 'query', q: q }; return listen(l, function () { return runQuery(q); }, cb, err); },
      };
    }
    function coll(path) {
      var c = query({ path: path, order: null, lim: null });
      c.path = path;
      c.doc = function (id) { return ref(path + '/' + (id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)))); };
      c.add = function (d) { var r = c.doc(); return r.set(d).then(function () { return r; }); };
      return c;
    }
    return Object.freeze({
      doc: function (p) { if (segs(p) % 2) throw new TypeError('document path needs an even number of segments'); return ref(p); },
      collection: function (p) { if (segs(p) % 2 === 0) throw new TypeError('collection path needs an odd number of segments'); return coll(p); },
      _listenerCount: function () { return listeners.size; },
    });
  }

  // ------------------------------------------------------------------ user + team
  function makeUser(sb, member) {
    var cache = {};
    function profileOf(m) { return { id: m.user_id, name: m.name || '', avatarUrl: m.avatar_url || '', color: '#7a8', email: m.email || null, isMe: m.user_id === member.user_id, guest: false }; }
    cache[member.user_id] = profileOf(member);
    var admin = member.role === 'admin';
    return Object.freeze({
      isOwner: function () { return Promise.resolve(admin); },
      canEdit: function () { return Promise.resolve(admin); },
      can: function (n) { return Promise.resolve(n === 'data.write' ? true : null); },
      id: function () { return Promise.resolve(member.user_id); },
      me: function () { return Promise.resolve({ id: member.user_id, name: member.name || '', avatarUrl: member.avatar_url || '', color: '#7a8', email: member.email, isOwner: admin, canEdit: admin }); },
      profiles: async function (ids) {
        ids = [].concat(ids || []);
        var need = ids.filter(function (id) { return UUID.test(id) && !cache[id]; });
        if (need.length) {
          try { var r = await sb.from('members').select('user_id,name,avatar_url,email').in('user_id', need.slice(0, 200)); (r.data || []).forEach(function (m) { cache[m.user_id] = profileOf(m); }); } catch (e) { /* reads never reject */ }
        }
        var o = {}; ids.forEach(function (id) { o[id] = cache[id] || { id: id, name: '', avatarUrl: '', color: '#7a8', email: null, isMe: false, guest: false }; });
        return o;
      },
      search: function () { return Promise.resolve([]); },
      name: function () { return Promise.resolve(member.name || ''); }, avatarUrl: function () { return Promise.resolve(member.avatar_url || ''); },
      email: function () { return Promise.resolve(member.email); },
    });
  }
  function makeTeam(sb, member) {
    function q(r) { if (r.error) throw mapErr(r.error); return r.data; }
    return Object.freeze({
      me: member,
      isAdmin: member.role === 'admin',
      signOut: async function () { try { await sb.auth.signOut(); } finally { location.reload(); } },
      members: async function () { return q(await sb.from('members').select('user_id,email,name,avatar_url,role,created_at').order('created_at')); },
      invites: async function () { return q(await sb.from('invites').select('email,role,created_at').order('created_at')); },
      invite: async function (email, role) { return q(await sb.from('invites').upsert({ email: String(email).trim().toLowerCase(), role: role })); },
      cancelInvite: async function (email) { return q(await sb.from('invites').delete().eq('email', email)); },
      setRole: async function (uid, role) { return call(sb, 'set_member_role', { p_user: uid, p_role: role }); },
      rename: async function (name) { return call(sb, 'update_my_profile', { p_name: name }); },
      settings: async function () { var r = q(await sb.from('team_settings').select('allowed_domain,domain_role').eq('id', 1).maybeSingle()); return r || { allowed_domain: null, domain_role: 'estimator' }; },
      saveSettings: async function (s) { return q(await sb.from('team_settings').update({ allowed_domain: s.allowed_domain ? String(s.allowed_domain).trim().toLowerCase() : null, domain_role: s.domain_role || 'estimator' }).eq('id', 1)); },
      // Backups: every document as { path: data }. Import writes them back one by one.
      exportAll: async function () {
        var out = {}, from = 0, page = 500;
        for (;;) { var rows = q(await sb.from('docs').select('path,data').order('path').range(from, from + page - 1)); rows.forEach(function (r) { out[r.path] = r.data; }); if (rows.length < page) break; from += page; }
        return out;
      },
      importAll: async function (obj, onProgress) {
        var paths = Object.keys(obj || {}).filter(function (p) { return obj[p] && typeof obj[p] === 'object' && !Array.isArray(obj[p]); });
        var done = 0, failed = [];
        for (var i = 0; i < paths.length; i++) {
          try { await call(sb, 'set_doc', { p_path: paths[i], p_data: obj[paths[i]] }); } catch (e) { failed.push(paths[i]); }
          done++; if (onProgress) onProgress(done, paths.length);
        }
        return { total: paths.length, failed: failed };
      },
    });
  }
  function downloads() {
    return Object.freeze({
      save: function (req) {
        var blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = req.filename; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        return Promise.resolve({ status: 'saved' });
      },
    });
  }

  // ------------------------------------------------------------------ sign-in screens
  var MARK = html`<div class="brand-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true"><rect x="4" y="9" width="16" height="11" rx="2" stroke="currentColor" stroke-width="2"></rect><path d="M4 5h16M4 3.2v3.6M20 3.2v3.6" stroke="currentColor" stroke-opacity=".75" stroke-width="2"></path></svg></div>`;
  var GOOGLE = html`<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

  function Notice(p) { return html`<div class="notice auth-notice">${MARK}<h1>${p.title}</h1><p>${p.children}</p>${p.actions ? html`<div class="row auth-actions">${p.actions}</div>` : null}</div>`; }

  function AuthCard(p) {
    var sb = p.sb;
    var sm = useState(p.mode || 'signin'), mode = sm[0], setMode = sm[1];
    var se = useState(''), email = se[0], setEmail = se[1];
    var sp = useState(''), pw = sp[0], setPw = sp[1];
    var sn = useState(''), name = sn[0], setName = sn[1];
    var sb2 = useState(false), busy = sb2[0], setBusy = sb2[1];
    var sx = useState(p.message || null), msg = sx[0], setMsg = sx[1];
    function go(m) { setMode(m); setMsg(null); }
    async function run(fn) {
      setBusy(true); setMsg(null);
      try { await fn(); } catch (e) { setMsg({ bad: true, text: friendly(e) }); }
      setBusy(false);
    }
    function friendly(e) {
      var m = String((e && e.message) || e || '');
      if (/Invalid login credentials/i.test(m)) return 'That email and password don’t match an account.';
      if (/Email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then sign in.';
      if (/already registered/i.test(m)) return 'An account with this email already exists. Sign in instead.';
      if (/Password should be/i.test(m)) return 'Use a password of at least 8 characters.';
      if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
      if (/provider is not enabled/i.test(m)) return 'Google sign-in isn’t switched on for this workspace yet. Use email, or ask your admin.';
      if (/fetch|network/i.test(m)) return 'Couldn’t reach the server. Check your connection and try again.';
      return m || 'Something went wrong. Try again.';
    }
    var redirect = location.origin + location.pathname;
    function google() { run(async function () { var r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } }); if (r.error) throw r.error; }); }
    function submit(e) {
      e.preventDefault();
      if (mode === 'signin') run(async function () { var r = await sb.auth.signInWithPassword({ email: email.trim(), password: pw }); if (r.error) throw r.error; });
      else if (mode === 'signup') run(async function () {
        if (pw.length < 8) throw new Error('Password should be at least 8 characters');
        var r = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { full_name: name.trim() }, emailRedirectTo: redirect } });
        if (r.error) throw r.error;
        if (!r.data.session) setMsg({ text: 'Check your email: we sent a link to confirm ' + email.trim() + '. Then sign in here.' });
      });
      else if (mode === 'reset') run(async function () { var r = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect }); if (r.error) throw r.error; setMsg({ text: 'If an account exists for ' + email.trim() + ', a reset link is on its way.' }); });
      else if (mode === 'newpw') run(async function () { if (pw.length < 8) throw new Error('Password should be at least 8 characters'); var r = await sb.auth.updateUser({ password: pw }); if (r.error) throw r.error; p.onDone && p.onDone(); });
    }
    var titles = { signin: 'Sign in to the estimator', signup: 'Create your account', reset: 'Reset your password', newpw: 'Choose a new password' };
    var subs = { signin: (cfg.agencyName ? cfg.agencyName + ' · ' : '') + 'Design Hours Estimator', signup: 'Your admin approves new accounts unless you were invited.', reset: 'We’ll email you a link to set a new password.', newpw: 'At least 8 characters.' };
    return html`<div class="auth">
      <div class="auth-card panel">
        ${MARK}
        <h1>${titles[mode]}</h1>
        <p class="auth-sub">${subs[mode]}</p>
        ${mode === 'signin' || mode === 'signup' ? html`<button type="button" class="btn auth-google" disabled=${busy} onClick=${google}>${GOOGLE} Continue with Google</button>
          <div class="auth-or"><span>or with email</span></div>` : null}
        <form class="auth-form" onSubmit=${submit}>
          ${mode === 'signup' ? html`<label class="auth-field"><span>Name</span><input class="input" id="auth-name" autocomplete="name" maxlength="120" value=${name} onInput=${function (e) { setName(e.target.value); }} /></label>` : null}
          ${mode !== 'newpw' ? html`<label class="auth-field"><span>Email</span><input class="input" id="auth-email" type="email" required autocomplete="email" value=${email} onInput=${function (e) { setEmail(e.target.value); }} /></label>` : null}
          ${mode !== 'reset' ? html`<label class="auth-field"><span>${mode === 'newpw' ? 'New password' : 'Password'}</span><input class="input" id="auth-password" type="password" required minlength=${mode === 'signin' ? 1 : 8} autocomplete=${mode === 'signin' ? 'current-password' : 'new-password'} value=${pw} onInput=${function (e) { setPw(e.target.value); }} /></label>` : null}
          ${msg ? html`<div class=${'auth-msg' + (msg.bad ? ' bad' : '')} role=${msg.bad ? 'alert' : 'status'}>${msg.text}</div>` : null}
          <button class="btn primary auth-submit" type="submit" disabled=${busy}>${busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Create account', reset: 'Send reset link', newpw: 'Save password' }[mode]}</button>
        </form>
        <div class="auth-links">
          ${mode === 'signin' ? [html`<button type="button" class="linkish" onClick=${function () { go('signup'); }}>Create an account</button>`, html`<button type="button" class="linkish" onClick=${function () { go('reset'); }}>Forgot password?</button>`] : null}
          ${mode === 'signup' || mode === 'reset' ? html`<button type="button" class="linkish" onClick=${function () { go('signin'); }}>Back to sign in</button>` : null}
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ boot
  function show(vnode) { P.render(vnode, mount); }
  function startApp(sb, member) {
    var caps = { db: makeDb(sb), user: makeUser(sb, member), downloads: downloads(), team: makeTeam(sb, member), sample: null };
    window.claude = Object.freeze({ use: function (name) { return Promise.resolve(Object.prototype.hasOwnProperty.call(caps, name) ? caps[name] : null); } });
    // If an admin changes this person's role while they're working, start over with the new access.
    sb.channel('dhe-me').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members', filter: 'user_id=eq.' + member.user_id }, function (payload) {
      if (payload.new && payload.new.role !== member.role) location.reload();
    }).subscribe();
    P.render(null, mount);
    mount.innerHTML = '';
    if (typeof window.DHE_MOUNT_APP === 'function') window.DHE_MOUNT_APP();
  }
  async function memberFor(sb, user) {
    for (var i = 0; i < 4; i++) {   // the member row is written by a trigger right after sign-up
      var r = await sb.from('members').select('user_id,email,name,avatar_url,role').eq('user_id', user.id).maybeSingle();
      if (r.error) throw r.error;
      if (r.data) return r.data;
      await new Promise(function (res) { setTimeout(res, 600); });
    }
    return null;
  }
  async function boot() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) {
      show(html`<${Notice} title="Almost there: connect the database">This copy of the estimator has no Supabase project configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in your Vercel project, then redeploy. The README walks through it.<//>`);
      return;
    }
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    window.__dheSupabase = sb;
    var started = false, recovering = /type=recovery/.test(location.hash + location.search), queue = Promise.resolve();
    // Auth events can arrive back to back (INITIAL_SESSION, SIGNED_IN); handle them one at a time.
    function decide(session) { queue = queue.then(function () { return decideNow(session); }).catch(function () { /* shown on screen */ }); return queue; }
    async function decideNow(session) {
      if (started) return;
      if (recovering) { show(html`<${AuthCard} sb=${sb} mode="newpw" onDone=${function () { recovering = false; history.replaceState(null, '', location.pathname); decide(session); }} />`); return; }
      if (!session) { show(html`<${AuthCard} sb=${sb} />`); return; }
      var member;
      try { member = await memberFor(sb, session.user); }
      catch (e) { show(html`<${Notice} title="Couldn’t load your account" actions=${[html`<button class="btn primary" onClick=${function () { location.reload(); }}>Try again</button>`]}>${String(e.message || e)}<//>`); return; }
      var out = html`<button class="btn" onClick=${async function () { await sb.auth.signOut(); location.reload(); }}>Sign out</button>`;
      if (!member) { show(html`<${Notice} title="The database isn’t set up yet" actions=${[out]}>You’re signed in as ${session.user.email}, but the estimator’s tables are missing. Run supabase/migrations/0001_init.sql in the Supabase SQL editor (see the README), then sign in again.<//>`); return; }
      if (member.role === 'pending') { show(html`<${Notice} title="Waiting for approval" actions=${[html`<button class="btn primary" onClick=${function () { location.reload(); }}>Check again</button>`, out]}>You’re signed in as <b>${member.email}</b>. An admin needs to approve your account before you can see estimates. Ask them to open Settings → Team.<//>`); return; }
      if (member.role === 'disabled') { show(html`<${Notice} title="Your access was removed" actions=${[out]}>The account ${member.email} no longer has access to this estimator. Ask an admin if this is a mistake.<//>`); return; }
      started = true;
      startApp(sb, member);
    }
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; started = false; }
      if (event === 'SIGNED_OUT' && started) { location.reload(); return; }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') setTimeout(function () { decide(session); }, 0);
    });
  }
  window.DHE_DEFER_MOUNT = true;
  window.__dheRuntime = { makeDb: makeDb, makeUser: makeUser, makeTeam: makeTeam, mapErr: mapErr };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
