-- Design Hours Estimator: schema for Supabase.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
--
-- Data model: the app keeps its data as JSON documents addressed by path, exactly as it did on
-- claude.ai: services/{id}, config/settings, estimates/{id}, estimates/{id}/versions/{id}.
-- Access:
--   admin      edits the library (services/*) and settings (config/*), manages the team
--   estimator  creates and edits estimates
--   pending    signed in but not approved yet: sees nothing
--   disabled   removed by an admin: sees nothing
-- The first person to sign up becomes admin. Invited emails get their invited role.
-- Anyone else signing in with Google from the allowed company domain gets the domain role;
-- everyone else waits as pending until an admin approves them.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ team
create table if not exists public.members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  avatar_url text not null default '',
  role       text not null default 'pending' check (role in ('admin', 'estimator', 'pending', 'disabled')),
  created_at timestamptz not null default now()
);
create unique index if not exists members_email_idx on public.members (lower(email));

create table if not exists public.invites (
  email      text primary key check (email = lower(email) and position('@' in email) > 1),
  role       text not null default 'estimator' check (role in ('admin', 'estimator')),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.team_settings (
  id             int primary key default 1 check (id = 1),
  allowed_domain text check (allowed_domain is null or allowed_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  domain_role    text not null default 'estimator' check (domain_role in ('admin', 'estimator', 'pending'))
);
insert into public.team_settings (id) values (1) on conflict do nothing;

-- Role of the signed-in person ('none' when signed out or unknown). Security definer so policies
-- can call it without recursing into the members policy.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.members where user_id = auth.uid()), 'none');
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'estimator');
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin';
$$;

-- New account → member row with the right role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email  text := lower(coalesce(new.email, ''));
  v_role   text;
  v_invite public.invites%rowtype;
  v_ts     public.team_settings%rowtype;
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  perform pg_advisory_xact_lock(hashtext('dhe-new-member'));   -- two first sign-ups can't both become admin
  select * into v_invite from public.invites where email = v_email;
  select * into v_ts from public.team_settings where id = 1;
  if not exists (select 1 from public.members) then
    v_role := 'admin';
  elsif v_invite.email is not null then
    v_role := v_invite.role;
    delete from public.invites where email = v_email;
  elsif v_ts.allowed_domain is not null and v_email like '%@' || v_ts.allowed_domain
        and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    v_role := v_ts.domain_role;   -- Google has verified the address; password sign-ups still need approval
  else
    v_role := 'pending';
  end if;
  insert into public.members (user_id, email, name, avatar_url, role)
  values (new.id, v_email,
          left(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', split_part(v_email, '@', 1)), 120),
          left(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', ''), 500),
          v_role)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin actions. Each refuses to leave the team without an admin.
create or replace function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can change roles' using errcode = '42501'; end if;
  if p_role not in ('admin', 'estimator', 'pending', 'disabled') then raise exception 'Unknown role %', p_role using errcode = '22023'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'You cannot change your own role' using errcode = '42501'; end if;
  update public.members set role = p_role where user_id = p_user;
  if not found then raise exception 'No such member' using errcode = 'P0002'; end if;
end $$;

create or replace function public.update_my_profile(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.members set name = left(trim(coalesce(p_name, '')), 120) where user_id = auth.uid();
end $$;

alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.team_settings enable row level security;

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated
  using (user_id = auth.uid() or public.is_member());
-- no insert/update/delete policies: rows change only through the trigger and functions above

drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists team_settings_read on public.team_settings;
create policy team_settings_read on public.team_settings for select to authenticated using (public.is_member());
drop policy if exists team_settings_write on public.team_settings;
create policy team_settings_write on public.team_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ documents
create table if not exists public.docs (
  path       text primary key,
  parent     text not null,
  id         text not null,
  data       jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists docs_parent_idx on public.docs (parent);
alter table public.docs replica identity full;   -- realtime delete events carry the path

create or replace function public.can_write(p_path text) returns boolean
language sql stable as $$
  select case
    when p_path like 'services/%' or p_path like 'config/%' then public.is_admin()
    else public.is_member()
  end;
$$;

alter table public.docs enable row level security;
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated using (public.is_member());
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (public.can_write(path));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (public.can_write(path)) with check (public.can_write(path));
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (public.can_write(path));

-- Path rules: even number of non-empty segments, no odd characters, at most 8 segments.
create or replace function public.valid_doc_path(p_path text) returns boolean
language sql immutable as $$
  select p_path ~ '^[A-Za-z0-9_.-]{1,100}(/[A-Za-z0-9_.-]{1,100})*$'
     and array_length(string_to_array(p_path, '/'), 1) % 2 = 0
     and array_length(string_to_array(p_path, '/'), 1) <= 8;
$$;

-- The four operations the app uses. Security invoker: the policies above still apply.
create or replace function public.get_doc(p_path text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select data from public.docs where path = p_path;
$$;

create or replace function public.query_docs(p_parent text, p_order text default null, p_desc boolean default false, p_limit int default null)
returns table (id text, data jsonb)
language sql stable security invoker set search_path = public as $$
  select d.id, d.data from public.docs d
  where d.parent = p_parent
  order by
    case when p_order is not null and p_desc then d.data -> p_order end desc nulls last,
    case when p_order is not null and not p_desc then d.data -> p_order end asc nulls last,
    d.id
  limit least(coalesce(p_limit, 5000), 5000);
$$;

create or replace function public.set_doc(p_path text, p_data jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare v_parts text[];
begin
  if not public.valid_doc_path(p_path) then raise exception 'Invalid document path: %', left(p_path, 200) using errcode = '22023'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Document must be an object' using errcode = '22023'; end if;
  if octet_length(p_data::text) > 262144 then raise exception 'Document over 256 KiB' using errcode = '54000'; end if;
  if not public.can_write(p_path) then raise exception 'Not allowed to write %', p_path using errcode = '42501'; end if;
  v_parts := string_to_array(p_path, '/');
  insert into public.docs (path, parent, id, data, updated_at, updated_by)
  values (p_path, array_to_string(v_parts[1:array_length(v_parts, 1) - 1], '/'), v_parts[array_length(v_parts, 1)], p_data, now(), auth.uid())
  on conflict (path) do update set data = excluded.data, updated_at = now(), updated_by = auth.uid();
end $$;

create or replace function public.delete_doc(p_path text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.can_write(p_path) then raise exception 'Not allowed to delete %', p_path using errcode = '42501'; end if;
  delete from public.docs where path = p_path;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on public.docs, public.members, public.invites, public.team_settings from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.members to authenticated;
grant select, insert, update, delete on public.invites to authenticated;
grant select, update on public.team_settings to authenticated;
revoke execute on function public.get_doc(text), public.query_docs(text, text, boolean, int), public.set_doc(text, jsonb),
  public.delete_doc(text), public.set_member_role(uuid, text), public.update_my_profile(text), public.my_role() from public, anon;
grant execute on function public.get_doc(text), public.query_docs(text, text, boolean, int), public.set_doc(text, jsonb),
  public.delete_doc(text), public.set_member_role(uuid, text), public.update_my_profile(text), public.my_role() to authenticated;

-- ------------------------------------------------------------------ realtime
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'docs') then
      alter publication supabase_realtime add table public.docs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'members') then
      alter publication supabase_realtime add table public.members;
    end if;
  end if;
end $$;
