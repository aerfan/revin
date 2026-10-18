-- Revin Automated Observability & Telemetry Migration
-- Creates structured error logging, automated deduplication, and administrative review.
-- Safe and idempotent to run in Supabase SQL Editor or via supabase db push.

create table if not exists public.error_logs (
  id               uuid primary key default gen_random_uuid(),
  fingerprint      text not null,
  message          text not null,
  stack            text,
  route            text,
  breadcrumbs      jsonb not null default '[]'::jsonb,
  browser          text,
  severity         text not null default 'error' check (severity in ('fatal', 'error', 'warning', 'info')),
  occurrence_count int not null default 1 check (occurrence_count >= 1),
  user_id          uuid references auth.users (id) on delete set null default auth.uid(),
  user_email       text,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  resolved         boolean not null default false,
  resolved_at      timestamptz,
  resolved_by      uuid references auth.users (id) on delete set null
);

create index if not exists error_logs_fingerprint_idx on public.error_logs (fingerprint) where not resolved;
create index if not exists error_logs_last_seen_idx on public.error_logs (last_seen desc);

alter table public.error_logs enable row level security;

-- Policies: only admins can view, update or resolve error logs
drop policy if exists error_logs_admin_select on public.error_logs;
create policy error_logs_admin_select on public.error_logs
  for select to authenticated using (public.is_admin());

drop policy if exists error_logs_admin_update on public.error_logs;
create policy error_logs_admin_update on public.error_logs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists error_logs_admin_delete on public.error_logs;
create policy error_logs_admin_delete on public.error_logs
  for delete to authenticated using (public.is_admin());

-- Secure RPC to record or deduplicate client crash reports
create or replace function public.log_client_error(
  p_fingerprint text,
  p_message     text,
  p_stack       text default null,
  p_route       text default null,
  p_breadcrumbs jsonb default '[]'::jsonb,
  p_browser     text default null,
  p_severity    text default 'error'
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_existing_id uuid;
  v_user_email  text;
  v_new_id      uuid;
begin
  -- Fetch reporter email if authenticated
  select email into v_user_email from public.members where user_id = auth.uid();

  -- Rate limit / debounce: check if matching unresolved error logged within last 24h
  select id into v_existing_id
  from public.error_logs
  where fingerprint = left(p_fingerprint, 120)
    and not resolved
    and last_seen > (now() - interval '24 hours')
  order by last_seen desc
  limit 1;

  if v_existing_id is not null then
    update public.error_logs
    set occurrence_count = occurrence_count + 1,
        last_seen = now(),
        breadcrumbs = coalesce(p_breadcrumbs, breadcrumbs),
        stack = coalesce(p_stack, stack)
    where id = v_existing_id;
    return v_existing_id;
  else
    insert into public.error_logs (
      fingerprint, message, stack, route, breadcrumbs, browser, severity, user_id, user_email
    ) values (
      left(coalesce(p_fingerprint, 'unknown'), 120),
      left(coalesce(p_message, 'Unknown client error'), 1000),
      left(coalesce(p_stack, ''), 4000),
      left(coalesce(p_route, ''), 200),
      coalesce(p_breadcrumbs, '[]'::jsonb),
      left(coalesce(p_browser, ''), 250),
      case when p_severity in ('fatal', 'error', 'warning', 'info') then p_severity else 'error' end,
      auth.uid(),
      v_user_email
    ) returning id into v_new_id;
    return v_new_id;
  end if;
end $$;

-- Grants
revoke all on public.error_logs from public, anon;
grant select, update, delete on public.error_logs to authenticated;
grant execute on function public.log_client_error(text, text, text, text, jsonb, text, text) to authenticated;
