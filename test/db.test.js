// Runs the Supabase migration against a real Postgres and checks sign-up roles, row-level security,
// the document functions and the team rules. Needs a local Postgres (PGHOST/PGPASSWORD).
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const ROOT = path.join(__dirname, '..');
const cfg = { host: process.env.PGHOST || '127.0.0.1', user: 'postgres', password: process.env.PGPASSWORD || 'pg', database: 'postgres' };
const DB = 'dhe_test_' + process.pid;
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('FAIL', m); } }

(async () => {
  const admin = new Client(cfg); await admin.connect();
  await admin.query(`drop database if exists ${DB}`); await admin.query(`create database ${DB}`);
  const c = new Client(Object.assign({}, cfg, { database: DB })); await c.connect();
  await c.query(fs.readFileSync(path.join(__dirname, 'sql', 'supabase-shim.sql'), 'utf8'));
  const mig = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '0001_init.sql'), 'utf8');
  await c.query(mig);
  await c.query(mig); ok(true, 'migration re-runs cleanly');

  async function signup(email, provider = 'email', meta = {}) {
    const r = await c.query('insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3) returning id', [email, meta, { provider }]);
    return r.rows[0].id;
  }
  // Run fn as an authenticated user inside a transaction, like a PostgREST request.
  async function as(uid, fn) {
    await c.query('begin');
    try {
      await c.query(uid ? 'set local role authenticated' : 'set local role anon');
      if (uid) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      const out = await fn((q, p) => c.query(q, p));
      await c.query('commit'); return out;
    } catch (e) { await c.query('rollback'); throw e; }
  }
  async function err(uid, fn) { try { await as(uid, fn); return null; } catch (e) { return e.code || e.message; } }
  const role = async (uid) => (await c.query('select role from public.members where user_id=$1', [uid])).rows[0].role;

  // ---- sign-up roles
  const A = await signup('Owner@Agency.com', 'email', { full_name: 'Ada Owner' });
  ok(await role(A) === 'admin', 'first sign-up is admin');
  ok((await c.query('select email, name from members where user_id=$1', [A])).rows[0].email === 'owner@agency.com', 'email lower-cased');
  const P = await signup('stranger@gmail.com');
  ok(await role(P) === 'pending', 'unknown email is pending');
  await as(A, (q) => q(`insert into invites (email, role) values ('est@agency.com','estimator'), ('boss@other.com','admin')`));
  const S = await signup('EST@agency.com');
  ok(await role(S) === 'estimator', 'invite applies (case-insensitive)');
  ok((await c.query(`select count(*)::int n from invites where email='est@agency.com'`)).rows[0].n === 0, 'used invite removed');
  const B = await signup('boss@other.com'); ok(await role(B) === 'admin', 'admin invite');
  await as(A, (q) => q(`update team_settings set allowed_domain='agency.com', domain_role='estimator'`));
  const G = await signup('gina@agency.com', 'google', { name: 'Gina', avatar_url: 'https://x/y.png' });
  ok(await role(G) === 'estimator', 'google + allowed domain joins');
  const G2 = await signup('pete@agency.com', 'email');
  ok(await role(G2) === 'pending', 'password sign-up on the domain still needs approval');
  const G3 = await signup('eve@evilagency.com', 'google');
  ok(await role(G3) === 'pending', 'look-alike domain does not match');
  const G4 = await signup('eve@sub.agency.com.evil.io', 'google');
  ok(await role(G4) === 'pending', 'domain suffix trick does not match');
  ok(await err(S, (q) => q(`update team_settings set allowed_domain='x.com'`)) === null && (await c.query('select allowed_domain from team_settings')).rows[0].allowed_domain === 'agency.com', 'estimator cannot change team settings (no rows updated)');
  ok(await err(A, (q) => q(`update team_settings set allowed_domain='not a domain'`)) === '23514', 'domain format checked');

  // ---- documents: read/write by role
  const svc = { name: 'Website', items: [] };
  ok(await err(A, (q) => q('select set_doc($1,$2)', ['services/website', svc])) === null, 'admin writes library');
  ok(await err(S, (q) => q('select set_doc($1,$2)', ['services/website', svc])) === '42501', 'estimator cannot write library');
  ok(await err(S, (q) => q('select set_doc($1,$2)', ['config/settings', {}])) === '42501', 'estimator cannot write settings');
  ok(await err(S, (q) => q('select set_doc($1,$2)', ['estimates/e1', { name: 'One', updatedAt: 3 }])) === null, 'estimator writes estimate');
  ok(await err(P, (q) => q('select set_doc($1,$2)', ['estimates/e2', { name: 'x' }])) === '42501', 'pending cannot write');
  ok(await err(null, (q) => q('select set_doc($1,$2)', ['estimates/e2', { name: 'x' }])) === '42501', 'anon cannot call');
  ok((await as(P, (q) => q(`select get_doc('estimates/e1') d`))).rows[0].d === null, 'pending reads nothing');
  ok((await as(P, (q) => q('select count(*)::int n from docs'))).rows[0].n === 0, 'pending sees no rows directly');
  ok((await as(S, (q) => q(`select get_doc('estimates/e1') d`))).rows[0].d.name === 'One', 'estimator reads');
  ok(await err(S, (q) => q(`insert into docs (path,parent,id,data) values ('services/x','services','x','{}')`)) === '42501', 'direct table insert also guarded');
  ok(await err(S, (q) => q(`delete from docs where path='services/website'`)) === null && (await c.query(`select count(*)::int n from docs where path='services/website'`)).rows[0].n === 1, 'direct delete of library blocked');
  ok(await err(S, (q) => q(`select delete_doc('services/website')`)) === '42501', 'delete_doc of library refused');

  // ---- path and payload validation
  for (const bad of ['estimates', 'a/b/c', '/estimates/x', 'estimates//x', 'estimates/x y', 'estimates/' + 'x'.repeat(101), 'a/b/c/d/e/f/g/h/i/j']) ok(await err(S, (q) => q('select set_doc($1,$2)', [bad, {}])) === '22023', 'rejects path ' + bad.slice(0, 30));
  ok(await err(S, (q) => q('select set_doc($1,$2::jsonb)', ['estimates/arr', '[1,2]'])) === '22023', 'rejects arrays');
  ok(await err(S, (q) => q('select set_doc($1,$2)', ['estimates/big', { s: 'x'.repeat(262200) }])) === '54000', 'rejects >256 KiB');
  ok(await err(S, (q) => q('select set_doc($1,$2)', ['estimates/e1/versions/v1', { label: 'v1', createdAt: 1 }])) === null, 'subcollection write');
  ok((await c.query(`select parent, id from docs where path='estimates/e1/versions/v1'`)).rows[0].parent === 'estimates/e1/versions', 'parent computed');

  // ---- query ordering and limits
  await as(S, async (q) => { for (const [id, u] of [['e2', 10], ['e3', 2], ['e4', null], ['e5', 1e12]]) await q('select set_doc($1,$2)', ['estimates/' + id, u === null ? { name: id } : { name: id, updatedAt: u }]); });
  const ids = (await as(S, (q) => q(`select id from query_docs('estimates','updatedAt',true,10)`))).rows.map((r) => r.id);
  ok(ids.join() === 'e5,e2,e1,e3,e4', 'desc order, missing last: ' + ids);
  const asc = (await as(S, (q) => q(`select id from query_docs('estimates','updatedAt',false,2)`))).rows.map((r) => r.id);
  ok(asc.join() === 'e3,e1', 'asc + limit: ' + asc);
  ok((await as(S, (q) => q(`select count(*)::int n from query_docs('estimates')`))).rows[0].n === 5, 'no order: all, subcollection excluded');
  ok((await as(S, (q) => q(`select count(*)::int n from query_docs('estimates/e1/versions')`))).rows[0].n === 1, 'subcollection query');
  // injection-ish order field is just a JSON key
  ok(await err(S, (q) => q(`select * from query_docs('estimates', 'x'' or 1=1 --', true, 5)`)) === null, 'order key is data, not SQL');

  // ---- team rules
  ok(await err(S, (q) => q('select set_member_role($1,$2)', [P, 'estimator'])) === '42501', 'estimator cannot approve');
  ok(await err(A, (q) => q('select set_member_role($1,$2)', [P, 'estimator'])) === null && await role(P) === 'estimator', 'admin approves');
  ok(await err(A, (q) => q('select set_member_role($1,$2)', [A, 'estimator'])) === '42501', 'admin cannot demote self');
  ok(await err(A, (q) => q('select set_member_role($1,$2)', [P, 'owner'])) === '22023', 'unknown role');
  ok(await err(A, (q) => q('select set_member_role($1,$2)', [S, 'disabled'])) === null, 'disable member');
  ok((await as(S, (q) => q('select count(*)::int n from docs'))).rows[0].n === 0, 'disabled member sees nothing');
  ok(await err(S, (q) => q('select set_doc($1,$2)', ['estimates/z', {}])) === '42501', 'disabled member cannot write');
  ok((await as(S, (q) => q('select count(*)::int n from members'))).rows[0].n === 1, 'disabled sees only own member row');
  ok((await as(G, (q) => q('select count(*)::int n from members'))).rows[0].n >= 5, 'members see the team');
  ok(await err(G, (q) => q(`update members set role='admin' where user_id=$1`, [G])) === '42501' || await role(G) === 'estimator', 'no self-promotion via table');
  ok(await role(G) === 'estimator', 'role unchanged after attempt');
  ok(await err(G, (q) => q(`select * from invites`)) === null && (await as(G, (q) => q('select count(*)::int n from invites'))).rows[0].n === 0, 'invites hidden from estimators');
  await as(G, (q) => q('select update_my_profile($1)', ['  Gina G  ']));
  ok((await c.query('select name from members where user_id=$1', [G])).rows[0].name === 'Gina G', 'profile name trimmed');

  // ---- concurrency: two simultaneous first sign-ups on a fresh database never make two admins
  const c2db = DB + '_race';
  await admin.query(`drop database if exists ${c2db}`); await admin.query(`create database ${c2db}`);
  const r1 = new Client(Object.assign({}, cfg, { database: c2db })), r2 = new Client(Object.assign({}, cfg, { database: c2db }));
  await r1.connect(); await r2.connect();
  await r1.query(fs.readFileSync(path.join(__dirname, 'sql', 'supabase-shim.sql'), 'utf8')); await r1.query(mig);
  await Promise.all([r1, r2].map((cl, i) => cl.query(`insert into auth.users (email) values ('u${i}@x.com')`)));
  const admins = (await r1.query(`select count(*)::int n from public.members where role='admin'`)).rows[0].n;
  ok(admins === 1, 'exactly one first admin under a race (' + admins + ')');
  await r1.end(); await r2.end(); await admin.query(`drop database ${c2db}`);

  ok((await c.query(`select count(*)::int n from pg_publication_tables where pubname='supabase_realtime' and tablename in ('docs','members')`)).rows[0].n === 2, 'realtime publication');
  await c.end(); await admin.query(`drop database ${DB}`); await admin.end();
  console.log(`\ndb: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
