-- Version aligned with production migration history.
create table if not exists public.api_rate_limits (
  identifier text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

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
