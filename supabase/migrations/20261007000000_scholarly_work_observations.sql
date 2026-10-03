-- Slice 3: enrichment observations for canonical scholarly works.
--
-- Each row records what one source reported about one field of one work at one
-- time. Rows are appended, never updated or deleted, so disagreement between
-- providers and changes over time are preserved instead of overwritten.
--
-- facet separates the kinds of information:
--   metadata            title, year, venue as a provider reported them
--   registry_assertion  identifiers such as the DOI and which source asserted them
--   access              open-access link or status
--   metric              counts such as citations, per source and time
--
-- status separates what was learned:
--   reported      the source reported a value (value is set)
--   not_reported  the source had a record but no value for this field (unknown)
--   not_found     the source had no record for the work (unknown)
--   error         the request to the source failed (unknown, error_code set)
-- Only reported carries a value. not_reported, not_found and error never mean
-- that the value is false or zero.
--
-- There is deliberately no verified flag. Abstracts and full text are not
-- stored: provider terms for permanent storage have not been verified.
--
-- No browser access. The server (service role) may only insert and read.
--
-- Depends on: 20261005000000 (scholarly_works).
--
-- Rollback (after rolling back the code), one statement per line:
--   drop table if exists public.scholarly_work_observations

create table if not exists public.scholarly_work_observations (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.scholarly_works(id) on delete cascade,
  facet text not null check (facet in ('metadata', 'registry_assertion', 'access', 'metric')),
  field text not null check (char_length(field) between 1 and 64),
  source text not null check (char_length(source) between 1 and 64),
  status text not null check (status in ('reported', 'not_reported', 'not_found', 'error')),
  value jsonb,
  error_code text check (char_length(error_code) <= 200),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  search_run_id uuid,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint scholarly_work_observation_value check ((status = 'reported') = (value is not null and value <> 'null'::jsonb)),
  constraint scholarly_work_observation_error check (status = 'error' or error_code is null),
  constraint scholarly_work_observation_no_text check (field not in ('abstract', 'full_text', 'fulltext'))
);
create index if not exists scholarly_work_observations_work_field_idx
  on public.scholarly_work_observations (work_id, field, observed_at desc);

alter table public.scholarly_work_observations enable row level security;
revoke all on table public.scholarly_work_observations from public, anon, authenticated;
-- Append-only, including for the server: no update, delete or truncate.
revoke update, delete, truncate on table public.scholarly_work_observations from service_role;
grant select, insert on table public.scholarly_work_observations to service_role;

do $verify$
begin
  if to_regclass('public.scholarly_work_observations') is null then
    raise exception 'Slice 3 verification failed: scholarly_work_observations is missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.scholarly_work_observations'::regclass) then
    raise exception 'Slice 3 verification failed: RLS is not enabled';
  end if;
  if has_table_privilege('anon', 'public.scholarly_work_observations', 'select')
     or has_table_privilege('authenticated', 'public.scholarly_work_observations', 'select')
     or has_table_privilege('authenticated', 'public.scholarly_work_observations', 'insert') then
    raise exception 'Slice 3 verification failed: browser roles can access observations';
  end if;
  if has_table_privilege('service_role', 'public.scholarly_work_observations', 'update')
     or has_table_privilege('service_role', 'public.scholarly_work_observations', 'delete')
     or not has_table_privilege('service_role', 'public.scholarly_work_observations', 'insert') then
    raise exception 'Slice 3 verification failed: observations are not append-only for the server';
  end if;
end
$verify$;
