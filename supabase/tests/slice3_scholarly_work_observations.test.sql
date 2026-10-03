-- Slice 3 database checks (migration 20261007000000). Runs in one transaction
-- that is rolled back. Local disposable databases only.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $check$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_label; end if;
  raise notice 'PASS %', p_label;
end
$check$;

create or replace function pg_temp.rejects(p_sql text, p_label text) returns void language plpgsql as $rejects$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS %', p_label;
    return;
  end;
  raise exception 'FAILED: %', p_label;
end
$rejects$;

set local role service_role;
insert into public.scholarly_works (id, identity_basis, identity_source, title, normalized_title)
values ('20000000-0000-0000-0000-0000000000c1', 'doi', 'crossref', 'Observed work', 'observed work');

insert into public.scholarly_work_observations (work_id, facet, field, source, status, value, observed_at) values
  ('20000000-0000-0000-0000-0000000000c1', 'metadata', 'title', 'crossref', 'reported', '"Registry title"', now()),
  ('20000000-0000-0000-0000-0000000000c1', 'metadata', 'title', 'openalex', 'reported', '"Index title"', now()),
  ('20000000-0000-0000-0000-0000000000c1', 'metric', 'citation_count', 'opencitations', 'reported', '0', now());
insert into public.scholarly_work_observations (work_id, facet, field, source, status, error_code, observed_at)
values ('20000000-0000-0000-0000-0000000000c1', 'access', 'oa_url', 'unpaywall', 'error', 'timeout', now());
select pg_temp.check((select count(distinct value) = 2 from public.scholarly_work_observations where field = 'title'), 'disagreeing titles from two sources are both kept');
select pg_temp.check((select value is null and error_code = 'timeout' from public.scholarly_work_observations where source = 'unpaywall'), 'an error is recorded without a value');

select pg_temp.rejects($s$insert into public.scholarly_work_observations (work_id, facet, field, source, status, value, observed_at) values ('20000000-0000-0000-0000-0000000000c1', 'access', 'oa_url', 'unpaywall', 'error', '"x"', now())$s$, 'an error cannot carry a value');
select pg_temp.rejects($s$insert into public.scholarly_work_observations (work_id, facet, field, source, status, observed_at) values ('20000000-0000-0000-0000-0000000000c1', 'metadata', 'title', 'openalex', 'reported', now())$s$, 'a reported observation needs a value');
select pg_temp.rejects($s$insert into public.scholarly_work_observations (work_id, facet, field, source, status, value, observed_at) values ('20000000-0000-0000-0000-0000000000c1', 'metadata', 'title', 'openalex', 'not_reported', 'false', now())$s$, 'unknown cannot be stored as a negative value');
select pg_temp.rejects($s$insert into public.scholarly_work_observations (work_id, facet, field, source, status, value, observed_at) values ('20000000-0000-0000-0000-0000000000c1', 'metadata', 'abstract', 'openalex', 'reported', '"text"', now())$s$, 'abstracts cannot be stored');
select pg_temp.rejects($s$insert into public.scholarly_work_observations (work_id, facet, field, source, status, value, observed_at) values ('20000000-0000-0000-0000-0000000000c1', 'verification', 'verified', 'waha', 'reported', 'true', now())$s$, 'there is no verification facet');
select pg_temp.rejects($s$update public.scholarly_work_observations set value = '"Changed"' where source = 'openalex'$s$, 'the server cannot update an observation');
select pg_temp.rejects($s$delete from public.scholarly_work_observations where source = 'openalex'$s$, 'the server cannot delete an observation');
reset role;

select pg_temp.check(not exists (select 1 from information_schema.columns where table_name = 'scholarly_work_observations' and column_name ilike '%verif%'), 'no verified column exists');

set local role authenticated;
select pg_temp.rejects($s$select count(*) from public.scholarly_work_observations$s$, 'a browser user cannot read observations');
select pg_temp.rejects($s$insert into public.scholarly_work_observations (work_id, facet, field, source, status, value, observed_at) values ('20000000-0000-0000-0000-0000000000c1', 'metadata', 'title', 'browser', 'reported', '"Forged"', now())$s$, 'a browser user cannot add observations');
reset role;
set local role anon;
select pg_temp.rejects($s$select count(*) from public.scholarly_work_observations$s$, 'an anonymous user cannot read observations');
reset role;

select 'ALL CHECKS PASSED' as result;
rollback;
