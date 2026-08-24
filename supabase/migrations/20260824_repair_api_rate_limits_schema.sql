-- Older WAHA environments created this table with `ip` and `window_start`.
-- Normalize those columns without dropping the table or its existing rows.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_rate_limits' and column_name = 'ip'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_rate_limits' and column_name = 'identifier'
  ) then
    alter table public.api_rate_limits rename column ip to identifier;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_rate_limits' and column_name = 'window_start'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'api_rate_limits' and column_name = 'window_started_at'
  ) then
    alter table public.api_rate_limits rename column window_start to window_started_at;
  end if;
end
$$;

alter table public.api_rate_limits
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists api_rate_limits_identifier_unique
  on public.api_rate_limits(identifier);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

-- Reinstall the function after the compatibility migration so its referenced
-- columns are guaranteed to exist in both old and fresh environments.
create or replace function public.check_rate_limit(
  p_ip text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_ip is null or length(trim(p_ip)) = 0 or p_max_requests < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.api_rate_limits as limits (
    identifier,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_ip,
    v_now,
    1,
    v_now
  )
  on conflict (identifier) do update
  set request_count = case
        when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
        else limits.request_count + 1
      end,
      window_started_at = case
        when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
        else limits.window_started_at
      end,
      updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
