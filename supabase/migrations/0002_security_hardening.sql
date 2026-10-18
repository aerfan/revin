-- Revin Database Security Hardening Migration
-- Run in Supabase SQL editor or via supabase db push. Safe and idempotent to re-run.

-- 1. Table-Level Engine Constraints on public.docs (Anti-DoS & Payload Bombs)
-- Ensures no client can bypass size or path rules via direct PostgREST table access.
alter table public.docs drop constraint if exists docs_size_max;
alter table public.docs add constraint docs_size_max check (octet_length(data::text) <= 262144);

alter table public.docs drop constraint if exists docs_valid_path;
alter table public.docs add constraint docs_valid_path check (public.valid_doc_path(path));

-- 2. Foreign Key Cascade Protection for Audit & Doc Attribution
alter table public.docs drop constraint if exists docs_updated_by_fkey;
alter table public.docs add constraint docs_updated_by_fkey foreign key (updated_by) references auth.users (id) on delete set null;

-- 3. Automatic Trigger to Guarantee Parent, ID, and Timestamp Integrity
create or replace function public.trg_enforce_doc_integrity() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_parts text[];
begin
  if not public.valid_doc_path(new.path) then
    raise exception 'Invalid document path: %', left(new.path, 100) using errcode = '22023';
  end if;

  v_parts := string_to_array(new.path, '/');
  new.parent := array_to_string(v_parts[1:array_length(v_parts, 1) - 1], '/');
  new.id := v_parts[array_length(v_parts, 1)];
  new.updated_at := now();
  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_docs_integrity on public.docs;
create trigger trg_docs_integrity
  before insert or update on public.docs
  for each row execute function public.trg_enforce_doc_integrity();

-- 4. Mitigate PostgreSQL Search-Path Hijacking (Strict Search Path on All Functions)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role from public.members where user_id = auth.uid()), 'none');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_role() in ('admin', 'estimator');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_role() = 'admin';
$$;

create or replace function public.can_write(p_path text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_path like 'services/%' or p_path like 'config/%' then public.is_admin()
    else public.is_member()
  end;
$$;

create or replace function public.valid_doc_path(p_path text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select p_path ~ '^[A-Za-z0-9_.-]{1,100}(/[A-Za-z0-9_.-]{1,100})*$'
     and array_length(string_to_array(p_path, '/'), 1) % 2 = 0
     and array_length(string_to_array(p_path, '/'), 1) <= 8;
$$;

-- 5. Harden Account Provisioning & First-Sign-up Admin Hijacking
-- Explicitly pre-authorizes aerfan.work@gmail.com and prevents race-condition takeovers
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email  text := lower(coalesce(new.email, ''));
  v_role   text;
  v_invite public.invites%rowtype;
  v_ts     public.team_settings%rowtype;
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  perform pg_advisory_xact_lock(hashtext('dhe-new-member'));

  select * into v_invite from public.invites where email = v_email;
  select * into v_ts from public.team_settings where id = 1;

  if v_email = 'aerfan.work@gmail.com' then
    v_role := 'admin';
  elsif not exists (select 1 from public.members where role = 'admin') then
    v_role := 'admin';
  elsif v_invite.email is not null then
    v_role := v_invite.role;
    delete from public.invites where email = v_email;
  elsif v_ts.allowed_domain is not null and v_email like '%@' || v_ts.allowed_domain
        and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    v_role := v_ts.domain_role;
  else
    v_role := 'pending';
  end if;

  insert into public.members (user_id, email, name, avatar_url, role)
  values (new.id, v_email,
          left(trim(regexp_replace(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', split_part(v_email, '@', 1)), '[\x00-\x1F\x7F]', '', 'g')), 120),
          left(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', ''), 500),
          v_role)
  on conflict (user_id) do update set
    email = excluded.email,
    avatar_url = case when excluded.avatar_url <> '' then excluded.avatar_url else public.members.avatar_url end;

  return new;
end $$;

-- 6. Last-Admin Protection & Input Sanitization
create or replace function public.set_member_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'estimator', 'pending', 'disabled') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;

  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  -- Ensure we never leave the organization with zero active admins
  if p_role <> 'admin' and (select count(*) from public.members where role = 'admin' and user_id <> p_user) = 0 then
    raise exception 'Cannot demote the last active admin' using errcode = '42501';
  end if;

  update public.members set role = p_role where user_id = p_user;
  if not found then
    raise exception 'No such member' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.update_my_profile(p_name text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_clean text;
begin
  v_clean := left(trim(regexp_replace(coalesce(p_name, ''), '[\x00-\x1F\x7F]', '', 'g')), 120);
  if v_clean = '' then
    raise exception 'Profile name cannot be blank' using errcode = '22023';
  end if;
  update public.members set name = v_clean where user_id = auth.uid();
end $$;

-- 7. Secure Query, Set, Delete Operations with Explicit Security Invoker & pg_temp
create or replace function public.get_doc(p_path text) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select data from public.docs where path = p_path;
$$;

create or replace function public.query_docs(p_parent text, p_order text default null, p_desc boolean default false, p_limit int default null)
returns table (id text, data jsonb)
language sql stable security invoker set search_path = public, pg_temp as $$
  select d.id, d.data from public.docs d
  where d.parent = p_parent
  order by
    case when p_order is not null and p_desc then d.data -> p_order end desc nulls last,
    case when p_order is not null and not p_desc then d.data -> p_order end asc nulls last,
    d.id
  limit least(coalesce(p_limit, 5000), 5000);
$$;

create or replace function public.set_doc(p_path text, p_data jsonb) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_parts text[];
begin
  if not public.valid_doc_path(p_path) then
    raise exception 'Invalid document path: %', left(p_path, 200) using errcode = '22023';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Document must be an object' using errcode = '22023';
  end if;
  if octet_length(p_data::text) > 262144 then
    raise exception 'Document over 256 KiB' using errcode = '54000';
  end if;
  if not public.can_write(p_path) then
    raise exception 'Not allowed to write %', p_path using errcode = '42501';
  end if;

  v_parts := string_to_array(p_path, '/');
  insert into public.docs (path, parent, id, data, updated_at, updated_by)
  values (p_path, array_to_string(v_parts[1:array_length(v_parts, 1) - 1], '/'), v_parts[array_length(v_parts, 1)], p_data, now(), auth.uid())
  on conflict (path) do update set data = excluded.data, updated_at = now(), updated_by = auth.uid();
end $$;

create or replace function public.delete_doc(p_path text) returns void
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if not public.can_write(p_path) then
    raise exception 'Not allowed to delete %', p_path using errcode = '42501';
  end if;
  delete from public.docs where path = p_path;
end $$;

-- 8. Seed Pre-approved Admin Invite for Primary Owner
insert into public.invites (email, role)
values ('aerfan.work@gmail.com', 'admin')
on conflict (email) do update set role = 'admin';
