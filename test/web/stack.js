// A local stand-in for a Supabase project, for end-to-end tests of the standalone build:
//   Postgres 16 (real)  + the migration in supabase/migrations
//   PostgREST 12 (real) at /rest/v1        — the same REST server Supabase runs
//   auth at /auth/v1                       — small GoTrue stand-in: password, sign-up, Google (PKCE), refresh
//   realtime at /realtime/v1/websocket     — small Phoenix stand-in fed by Postgres NOTIFY
//   static dist-web at a second port        — the built app, as Vercel would serve it
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { WebSocketServer } = require('ws');
const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
const PG = { host: '127.0.0.1', user: 'postgres', password: process.env.PGPASSWORD || 'pg' };

function b64u(b) { return Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function sign(payload) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), p = b64u(JSON.stringify(payload));
  return h + '.' + p + '.' + b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest());
}
function verify(tok) {
  const [h, p, s] = String(tok || '').split('.');
  if (!s || b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest()) !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64').toString());
  return c.exp * 1000 > Date.now() ? c : null;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function start(opts = {}) {
  const port = opts.port || 54321, appPort = opts.appPort || 8080, restPort = opts.restPort || 3311;
  const DB = 'dhe_web_' + process.pid;
  const root = new Client(Object.assign({ database: 'postgres' }, PG)); await root.connect();
  await root.query(`drop database if exists ${DB}`); await root.query(`create database ${DB}`);
  const db = new Client(Object.assign({ database: DB }, PG)); await db.connect();
  await db.query(fs.readFileSync(path.join(ROOT, 'test', 'sql', 'supabase-shim.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '0001_init.sql'), 'utf8'));
  await db.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator login password 'auth' noinherit; end if; end $$;
    grant anon, authenticated to authenticator;
    create or replace function public._rt() returns trigger language plpgsql as $f$ begin
      perform pg_notify('dhe_rt', json_build_object('table', tg_table_name, 'type', tg_op, 'record', case when tg_op = 'DELETE' then null else to_jsonb(new) - 'data' end, 'old', case when tg_op = 'INSERT' then null else to_jsonb(old) - 'data' end)::text);
      return null; end $f$;
    drop trigger if exists _rt on public.docs; create trigger _rt after insert or update or delete on public.docs for each row execute function public._rt();
    drop trigger if exists _rt on public.members; create trigger _rt after insert or update or delete on public.members for each row execute function public._rt();`);
  if (opts.seed) for (const [p, d] of Object.entries(opts.seed)) await db.query('insert into docs (path,parent,id,data) values ($1,$2,$3,$4) on conflict (path) do update set data = excluded.data', [p, p.split('/').slice(0, -1).join('/'), p.split('/').pop(), d]);

  // ---- PostgREST
  const bin = path.join(__dirname, 'bin', 'postgrest');
  if (!fs.existsSync(bin)) throw new Error('PostgREST binary missing: run test/web/get-postgrest.sh');
  const pgrst = spawn(bin, [], { env: Object.assign({}, process.env, {
    PGRST_DB_URI: `postgres://authenticator:auth@127.0.0.1:5432/${DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(restPort), PGRST_SERVER_HOST: '127.0.0.1', PGRST_LOG_LEVEL: 'crit',
  }), stdio: ['ignore', 'pipe', 'pipe'] });
  let pgrstLog = ''; pgrst.stderr.on('data', (d) => { pgrstLog += d; }); pgrst.stdout.on('data', (d) => { pgrstLog += d; });
  for (let i = 0; i < 60; i++) { try { await new Promise((res, rej) => http.get(`http://127.0.0.1:${restPort}/`, (r) => { r.resume(); res(); }).on('error', rej)); break; } catch (e) { await wait(100); if (i === 59) throw new Error('PostgREST did not start: ' + pgrstLog); } }

  // ---- auth stand-in
  const users = new Map(); // email -> { id, password, confirmed, provider, meta }
  const codes = new Map(); // pkce code -> email
  const refresh = new Map(); // refresh token -> email
  const state = { confirmEmails: !!opts.confirmEmails, nextGoogle: null, tokenTtl: opts.tokenTtl || 3600, requests: [] };
  async function createUser(email, password, meta = {}, provider = 'email', confirmed = true) {
    email = email.toLowerCase();
    const r = await db.query('insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1,$2,$3) returning id', [email, meta, { provider }]);
    users.set(email, { id: r.rows[0].id, password, confirmed, provider, meta });
    return r.rows[0].id;
  }
  function userObj(u, email) { return { id: u.id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: u.confirmed ? new Date().toISOString() : null, user_metadata: u.meta, app_metadata: { provider: u.provider, providers: [u.provider] }, created_at: new Date().toISOString() }; }
  function session(email) {
    const u = users.get(email), now = Math.floor(Date.now() / 1000), rt = crypto.randomBytes(12).toString('hex');
    refresh.set(rt, email);
    return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email, iat: now, exp: now + state.tokenTtl }), token_type: 'bearer', expires_in: state.tokenTtl, expires_at: now + state.tokenTtl, refresh_token: rt, user: userObj(u, email) };
  }
  function authErr(res, status, msg, code) { send(res, status, { error: code || 'invalid_grant', error_description: msg, msg, code: status, error_code: code }); }
  function send(res, status, body) { res.writeHead(status, Object.assign({ 'content-type': 'application/json' }, cors)); res.end(body === undefined ? '' : JSON.stringify(body)); }
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, x-supabase-api-version, range', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'access-control-expose-headers': 'content-range, x-supabase-api-version' };
  async function body(req) { let s = ''; for await (const c of req) s += c; try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }

  async function auth(req, res, url) {
    const p = url.pathname.replace(/^\/auth\/v1/, '');
    if (p === '/token') {
      const b = await body(req), grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const email = String(b.email || '').toLowerCase(), u = users.get(email);
        if (!u || u.password !== b.password) return authErr(res, 400, 'Invalid login credentials');
        if (!u.confirmed) return authErr(res, 400, 'Email not confirmed', 'email_not_confirmed');
        return send(res, 200, session(email));
      }
      if (grant === 'refresh_token') { const email = refresh.get(b.refresh_token); if (!email) return authErr(res, 400, 'Invalid Refresh Token'); refresh.delete(b.refresh_token); return send(res, 200, session(email)); }
      if (grant === 'pkce') { const email = codes.get(b.auth_code); if (!email) return authErr(res, 400, 'invalid flow state'); codes.delete(b.auth_code); return send(res, 200, session(email)); }
      return authErr(res, 400, 'unsupported grant');
    }
    if (p === '/signup') {
      const b = await body(req), email = String(b.email || '').toLowerCase();
      if (users.has(email)) return authErr(res, 422, 'User already registered', 'user_already_exists');
      if (String(b.password || '').length < 6) return authErr(res, 422, 'Password should be at least 6 characters', 'weak_password');
      await createUser(email, b.password, b.data || {}, 'email', !state.confirmEmails);
      const u = users.get(email);
      return send(res, 200, state.confirmEmails ? userObj(u, email) : session(email));
    }
    if (p === '/user') {
      const c = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!c) return authErr(res, 401, 'invalid JWT', 'bad_jwt');
      if (req.method === 'PUT') { const b = await body(req); const u = users.get(c.email); if (b.password) u.password = b.password; return send(res, 200, userObj(u, c.email)); }
      return send(res, 200, userObj(users.get(c.email), c.email));
    }
    if (p === '/logout') { res.writeHead(204, cors); return res.end(); }
    if (p === '/recover') { state.requests.push(['recover', (await body(req)).email]); return send(res, 200, {}); }
    if (p === '/authorize') {
      if (url.searchParams.get('provider') !== 'google' || !state.nextGoogle) { res.writeHead(400, cors); return res.end('provider is not enabled'); }
      const g = state.nextGoogle; state.nextGoogle = null;
      if (!users.has(g.email)) await createUser(g.email, null, { full_name: g.name, avatar_url: g.avatar || '' }, 'google');
      const code = crypto.randomBytes(8).toString('hex'); codes.set(code, g.email);
      const to = new URL(url.searchParams.get('redirect_to')); to.searchParams.set('code', code);
      res.writeHead(302, { location: to.toString() }); return res.end();
    }
    return authErr(res, 404, 'not found');
  }

  // ---- gateway: /rest/v1 → PostgREST, /auth/v1 → stand-in, websocket → realtime stand-in
  const gateway = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    try {
      if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url);
      if (url.pathname.startsWith('/rest/v1')) {
        (state.rest = state.rest || []).push([Date.now(), req.method, url.pathname]);
        if (state.restDown) { res.writeHead(503, cors); return res.end(); }
        const up = http.request({ host: '127.0.0.1', port: restPort, method: req.method, path: url.pathname.replace(/^\/rest\/v1/, '') + url.search, headers: Object.assign({}, req.headers, { host: `127.0.0.1:${restPort}` }) }, (r) => {
          res.writeHead(r.statusCode, Object.assign({}, r.headers, cors)); r.pipe(res);
        });
        up.on('error', () => { res.writeHead(502, cors); res.end(); });
        return req.pipe(up);
      }
      send(res, 404, { message: 'not found' });
    } catch (e) { send(res, 500, { message: String(e) }); }
  });
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Set();
  let bindingId = 1000;
  gateway.on('upgrade', (req, sock, head) => {
    if (!req.url.startsWith('/realtime/v1/websocket') || state.realtimeDown) return sock.destroy();
    wss.handleUpgrade(req, sock, head, (ws) => {
      const v2 = /vsn=2/.test(req.url);
      const enc = (o) => JSON.stringify(v2 ? [o.join_ref ?? null, o.ref ?? null, o.topic, o.event, o.payload] : o);
      const dec = (raw) => { const x = JSON.parse(raw); return Array.isArray(x) ? { join_ref: x[0], ref: x[1], topic: x[2], event: x[3], payload: x[4] } : x; };
      const conn = { ws, enc, channels: new Map() }; sockets.add(conn); state.connections = (state.connections || 0) + 1;
      ws.on('close', () => sockets.delete(conn));
      ws.on('message', (raw) => {
        if (typeof raw !== 'string' && !(raw instanceof Buffer)) return;
        let m; try { m = dec(raw.toString()); } catch (e) { return; }
        const reply = (payload) => ws.send(enc({ topic: m.topic, event: 'phx_reply', payload, ref: m.ref, join_ref: m.join_ref }));
        if (m.event === 'heartbeat') return reply({ status: 'ok', response: {} });
        if (m.event === 'phx_join') {
          const pc = ((m.payload && m.payload.config && m.payload.config.postgres_changes) || []).map((b) => Object.assign({}, b, { id: ++bindingId }));
          conn.channels.set(m.topic, { joinRef: m.join_ref, bindings: pc });
          return reply({ status: 'ok', response: { postgres_changes: pc } });
        }
        if (m.event === 'phx_leave') { conn.channels.delete(m.topic); return reply({ status: 'ok', response: {} }); }
        if (m.event === 'access_token') return;
        reply({ status: 'ok', response: {} });
      });
    });
  });
  const listener = new Client(Object.assign({ database: DB }, PG)); await listener.connect();
  await listener.query('listen dhe_rt');
  listener.on('notification', (n) => {
    const ev = JSON.parse(n.payload);
    const rec = ev.record || ev.old || {};
    sockets.forEach((conn) => conn.channels.forEach((ch, topic) => {
      const ids = ch.bindings.filter((b) => b.table === ev.table && (b.event === '*' || b.event === ev.type) && (!b.filter || (() => { const m = /^(\w+)=eq\.(.*)$/.exec(b.filter); return m && String(rec[m[1]]) === m[2]; })())).map((b) => b.id);
      if (!ids.length) return;
      const strip = (r) => r && { path: r.path, user_id: r.user_id, role: r.role };
      conn.ws.send(conn.enc({ topic, event: 'postgres_changes', ref: null, join_ref: ch.joinRef, payload: { ids, data: { type: ev.type, schema: 'public', table: ev.table, commit_timestamp: new Date().toISOString(), columns: [{ name: 'path', type: 'text' }, { name: 'user_id', type: 'uuid' }, { name: 'role', type: 'text' }], record: strip(ev.record), old_record: strip(ev.old), errors: null } } }));
    }));
  });
  await new Promise((r) => gateway.listen(port, '127.0.0.1', r));

  // ---- static app (like Vercel: files, then index.html for everything else)
  const DIST = path.join(ROOT, 'dist-web');
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };
  const appSrv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); let f = path.join(DIST, decodeURIComponent(u.pathname));
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => appSrv.listen(appPort, '127.0.0.1', r));

  return {
    db, state, createUser, apiUrl: `http://localhost:${port}`, appUrl: `http://localhost:${appPort}`,
    role: async (email) => (await db.query('select role from members where email=$1', [email.toLowerCase()])).rows[0]?.role,
    doc: async (p) => (await db.query('select data from docs where path=$1', [p])).rows[0]?.data,
    dropRealtime: () => sockets.forEach((c) => c.ws.terminate()),
    stop: async () => {
      sockets.forEach((c) => c.ws.terminate()); wss.close();
      await new Promise((r) => gateway.close(r)); await new Promise((r) => appSrv.close(r));
      pgrst.kill(); await listener.end(); await db.end();
      await wait(200); await root.query(`drop database if exists ${DB} with (force)`); await root.end();
    },
  };
}
module.exports = { start, sign, SECRET };
