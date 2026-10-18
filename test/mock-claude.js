// In-memory stand-in for window.claude.use() (db, user, downloads), shaped after the
// runtime contract's type definitions. Configured via window.__MOCK__ before load.
// QA hooks: latency, fault injection, remote writes, revocation, listener counting.
(function () {
  var cfg = window.__MOCK__ || {};
  if (cfg.outside) return;
  var store = new Map();
  Object.keys(cfg.seed || {}).forEach(function (p) { store.set(p, JSON.parse(JSON.stringify(cfg.seed[p]))); });
  var listeners = new Set();
  var faults = (window.__faults = (cfg.faults || []).slice());
  var latency = cfg.latency || 0;
  function deepFreeze(o) { Object.freeze(o); Object.keys(o).forEach(function (k) { var v = o[k]; if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v); }); return o; }
  function parentOf(p) { return p.split('/').slice(0, -1).join('/'); }
  function snapDoc(path) {
    var d = store.get(path);
    var data = d ? deepFreeze(JSON.parse(JSON.stringify(d))) : undefined;
    return { id: path.split('/').pop(), exists: !!d, data: function () { return data; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function runQuery(q) {
    var docs = Array.from(store.keys()).filter(function (p) { return parentOf(p) === q.path; }).map(snapDoc);
    if (q.order) {
      var f = q.order[0], dir = q.order[1];
      docs.sort(function (a, b) { var x = a.data()[f], y = b.data()[f]; if (x === y) return 0; if (x === undefined) return 1; if (y === undefined) return -1; return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1); });
    } else docs.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    if (q.lim) docs = docs.slice(0, q.lim);
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function notify(path) {
    setTimeout(function () {
      listeners.forEach(function (l) {
        if (l.type === 'doc' && l.path === path) l.cb(snapDoc(path));
        if (l.type === 'query' && parentOf(path) === l.q.path) l.cb(runQuery(l.q));
      });
    }, 5);
  }
  var writes = (window.__writes = []);
  function canWrite(path) {
    if (cfg.role === 'admin') return true;
    if (cfg.role === 'none') return false;
    return path.indexOf('services/') !== 0 && path.indexOf('config/') !== 0;
  }
  function takeFault(op, path) {
    for (var i = 0; i < faults.length; i++) {
      var f = faults[i];
      if ((f.op || 'set') === op && path.indexOf(f.match || '') === 0 && (f.times === undefined || f.times > 0)) {
        if (f.times !== undefined) f.times--;
        return f.code;
      }
    }
    return null;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ref(path) {
    return {
      id: path.split('/').pop(), path: path,
      get: function () { return Promise.resolve(snapDoc(path)); },
      set: function (data) {
        var code = takeFault('set', path);
        if (code) return wait(10 + latency).then(function () { writes.push(['fail:' + code, path]); throw { code: code, message: 'injected ' + code }; });
        if (!canWrite(path)) return Promise.reject({ code: 'invalid_argument', message: 'write not allowed at this level' });
        if (!data || typeof data !== 'object' || Array.isArray(data)) return Promise.reject({ code: 'invalid_argument', message: 'body must be an object' });
        var s = JSON.stringify(data);
        if (new TextEncoder().encode(s).length > 262144) return Promise.reject({ code: 'invalid_argument', message: 'document over 256 KiB' });
        store.set(path, JSON.parse(s)); writes.push(['set', path, s.length]); notify(path);
        return wait(15 + latency);
      },
      update: function (data) { if (!store.has(path)) return Promise.reject({ code: 'invalid_argument' }); store.set(path, Object.assign({}, store.get(path), JSON.parse(JSON.stringify(data)))); notify(path); return Promise.resolve(); },
      delete: function () {
        var code = takeFault('delete', path);
        if (code) return Promise.reject({ code: code, message: 'injected ' + code });
        if (!canWrite(path)) return Promise.reject({ code: 'invalid_argument', message: 'write not allowed at this level' });
        store.delete(path); writes.push(['delete', path]); notify(path); return wait(10 + latency);
      },
      onSnapshot: function (cb, err) { var l = { type: 'doc', path: path, cb: cb, err: err }; listeners.add(l); setTimeout(function () { if (listeners.has(l)) cb(snapDoc(path)); }, 10); return function () { listeners.delete(l); }; },
      collection: function (sub) { return coll(path + '/' + sub); },
    };
  }
  function query(q) {
    return {
      where: function () { return query(q); },
      orderBy: function (f, dir) { return query(Object.assign({}, q, { order: [f, dir || 'asc'] })); },
      limit: function (n) { return query(Object.assign({}, q, { lim: n })); },
      get: function () { return Promise.resolve(runQuery(q)); },
      onSnapshot: function (cb, err) { var l = { type: 'query', q: q, cb: cb, err: err }; listeners.add(l); setTimeout(function () { if (listeners.has(l)) cb(runQuery(q)); }, 10); return function () { listeners.delete(l); }; },
    };
  }
  function coll(path) {
    var c = query({ path: path, order: null, lim: null });
    c.path = path;
    c.doc = function (id) { return ref(path + '/' + (id || Math.random().toString(36).slice(2))); };
    c.add = function (d) { var r = c.doc(); return r.set(d).then(function () { return r; }); };
    return c;
  }
  function segs(p) { return p.split('/').length; }
  var db = Object.freeze({
    doc: function (p) { if (segs(p) % 2) throw new TypeError('document path needs an even number of segments'); return ref(p); },
    collection: function (p) { if (segs(p) % 2 === 0) throw new TypeError('collection path needs an odd number of segments'); return coll(p); },
  });
  var avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#6a8"/></svg>');
  var admin = cfg.role === 'admin';
  var user = Object.freeze({
    isOwner: function () { return Promise.resolve(admin); },
    canEdit: function () { return Promise.resolve(admin); },
    can: function (n) { return Promise.resolve(n === 'data.write' ? (cfg.canWrite === undefined ? cfg.role !== 'none' : cfg.canWrite) : false); },
    id: function () { return Promise.resolve('u_me'); },
    // cfg.me / cfg.people let fixtures supply worst-case names and avatars (missing, 404, emoji, RTL)
    me: function () { var p = (cfg.me || {}); return Promise.resolve({ id: 'u_me', name: p.name !== undefined ? p.name : (cfg.userName === undefined ? 'Arfan Test' : cfg.userName), avatarUrl: p.avatarUrl !== undefined ? p.avatarUrl : avatar, color: '#6a8', email: null, isOwner: admin, canEdit: admin }); },
    profiles: function (ids) { var o = {}; [].concat(ids).forEach(function (id) { var p = (cfg.people || {})[id]; o[id] = p ? { id: id, name: p.name || '', avatarUrl: p.avatarUrl || '', color: '#6a8', email: null, isMe: id === 'u_me', guest: !!p.guest } : { id: id, name: id === 'u_me' ? 'Arfan Test' : 'Teammate', avatarUrl: avatar, color: '#6a8', email: null, isMe: id === 'u_me', guest: false }; }); return Promise.resolve(o); },
    name: function () { return Promise.resolve('Arfan Test'); }, avatarUrl: function () { return Promise.resolve(avatar); },
    search: function () { return Promise.resolve([]); }, email: function () { return Promise.resolve(null); },
  });
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); }
  var saved = (window.__saved = []);
  var downloads = Object.freeze({
    save: function (req) {
      if (cfg.downloadFault) return Promise.reject({ code: cfg.downloadFault, message: 'injected' });
      var blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
      return blob.arrayBuffer().then(function (ab) {
        var bytes = new Uint8Array(ab);
        saved.push({ filename: req.filename, size: bytes.length, text: /\.csv$/.test(req.filename) ? new TextDecoder().decode(bytes) : null, b64: /\.(xlsx|docx)$/.test(req.filename) ? b64(bytes) : null });
        return { status: 'saved' };
      });
    },
  });
  // Stand-in for Claude in the page: finds library names mentioned in the brief, one requirement per sentence.
  function fakeBrief(prompt) {
    var libPart = (prompt.split('LIBRARY (id | group | name — definition):\n')[1] || '').split('\n\n')[0];
    var lib = libPart.split('\n').map(function (l) { var x = l.split(' | '); return { id: x[0], name: (x[2] || '').split(' — ')[0] }; }).filter(function (x) { return x.name; });
    var brief = (prompt.split('"""\n')[1] || '').split('\n"""')[0];
    var sentences = brief.split(/(?<=[.!?])\s+|\n+/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 40);
    var reqs = sentences.map(function (t, i) { return { id: 'R' + (i + 1), text: t.slice(0, 160) }; });
    var matches = [];
    lib.forEach(function (li) { var i = sentences.findIndex(function (x) { return x.toLowerCase().indexOf(li.name.toLowerCase()) >= 0; }); if (i >= 0) matches.push({ libId: li.id, qty: 1, reqs: ['R' + (i + 1)], why: 'Named in the brief' }); });
    var custom = []; sentences.forEach(function (x, i) { if (/calculator/i.test(x)) custom.push({ name: 'Loan calculator', hours: 12, group: 'custom', reqs: ['R' + (i + 1)], why: 'Not in the library' }); });
    return { requirements: reqs, matches: matches, custom: custom, scope: [], questions: /launch|deadline/i.test(brief) ? ['What is the launch date?'] : [] };
  }
  var sample = cfg.noSample ? null : (function () {
    var calls = (window.__sampleCalls = []);
    function run(input, opts) {
      calls.push(String(input).length);
      if (cfg.sampleFault) return Promise.reject({ code: cfg.sampleFault, message: 'injected ' + cfg.sampleFault });
      return new Promise(function (res, rej) {
        var t = setTimeout(function () { res(fakeBrief(String(input))); }, cfg.sampleDelay || 300);
        if (opts && opts.signal) opts.signal.addEventListener('abort', function () { clearTimeout(t); rej({ code: 'cancelled', message: 'stopped' }); });
      });
    }
    var f = function (input, opts) { return run(input, opts).then(function (o) { return { text: JSON.stringify(o), truncated: false }; }); };
    f.json = run;
    return f;
  })();
  var team = Object.freeze({
    me: { user_id: 'u_me', name: 'Arfan Test', role: 'admin' },
    isAdmin: admin,
    signOut: function () { return Promise.resolve(); },
    members: function () { return Promise.resolve([]); },
    invites: function () { return Promise.resolve([]); },
    settings: function () { return Promise.resolve({ allowed_domain: null, domain_role: 'estimator' }); },
  });
  var caps = { sample: sample, db: cfg.signedOut ? null : db, user: cfg.noUser ? null : user, downloads: cfg.noDownloads ? null : downloads, team: cfg.noTeam ? null : team };
  window.__store = store;
  window.__listenerCount = function () { return listeners.size; };
  window.__remoteSet = function (path, data) { store.set(path, JSON.parse(JSON.stringify(data))); notify(path); };
  window.__remoteDelete = function (path) { store.delete(path); notify(path); };
  window.__dropListeners = function (code) { var ls = Array.from(listeners); listeners.clear(); ls.forEach(function (l) { if (l.err) l.err({ code: code || 'unavailable', message: 'listener terminated' }); }); };
  window.__revoke = function () { listeners.forEach(function (l) { if (l.err) l.err({ code: 'revoked', message: 'grant withdrawn' }); }); listeners.clear(); };
  window.claude = { use: function (name) { return new Promise(function (r) { setTimeout(function () { r(caps[name] || null); }, 20); }); } };
})();
