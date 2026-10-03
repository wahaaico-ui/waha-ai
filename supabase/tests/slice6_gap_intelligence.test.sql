-- Slice 6 database checks (migration 20261010000000). Runs in one transaction
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

insert into auth.users values ('00000000-0000-0000-0000-0000000000a6'), ('00000000-0000-0000-0000-0000000000b6');
insert into public.projects (id, user_id, title) values
  ('10000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a6', 'Project A'),
  ('10000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000b6', 'Project B');

set local role service_role;
insert into public.claims (id, project_id, created_by, statement, claim_type, origin, status) values
  ('50000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a6', 'A gap', 'gap', 'researcher', 'active'),
  ('50000000-0000-0000-0000-0000000000b6', '10000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000b6', 'B gap', 'gap', 'researcher', 'active');
insert into public.research_search_runs (id, user_id, project_id, context, query, providers, providers_attempted, providers_available, result_count, limitations, executed_at)
values ('70000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a6', 'evidence_panel', 'q', '[]', 2, 1, 5, array['Not exhaustive'], now());
select pg_temp.rejects($s$update public.research_search_runs set result_count = 500$s$, 'a recorded search scope cannot be changed');

insert into public.gap_assessments (id, project_id, claim_id, classification, rationale, limitations, basis, search_run_ids, origin, method_version) values
  ('80000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE',
   array['two sources'], array['Not exhaustive'],
   '{"groundedSupportingEvidence":2,"distinctSupportingSources":2,"searchRunsWithAvailableProviders":1,"confirmedSupportingEvidence":2,"supportingEvidence":["e1","e2"],"contradictingEvidence":["e3"]}',
   array['70000000-0000-0000-0000-0000000000a6']::uuid[], 'system', 'gap-rules-v1');
select pg_temp.check(true, 'an evidence-backed assessment with scope, evidence and limitations is accepted');

select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE', array['x'], array['x'], '{"groundedSupportingEvidence":5,"distinctSupportingSources":5,"searchRunsWithAvailableProviders":1,"supportingEvidence":[],"contradictingEvidence":[]}', 'system', 'v')$s$, 'evidence-backed is refused without a recorded search');
select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, search_run_ids, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE', array['x'], array['x'], '{"groundedSupportingEvidence":1,"distinctSupportingSources":1,"searchRunsWithAvailableProviders":1,"supportingEvidence":[],"contradictingEvidence":[]}', array['70000000-0000-0000-0000-0000000000a6']::uuid[], 'system', 'v')$s$, 'evidence-backed is refused with too little evidence');
select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'VERIFIED_GAP', array['x'], array['x'], '{"supportingEvidence":[],"contradictingEvidence":[]}', 'system', 'v')$s$, 'there is no VERIFIED_GAP classification');
select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'SIGNAL', array['x'], array[]::text[], '{"supportingEvidence":[],"contradictingEvidence":[]}', 'system', 'v')$s$, 'an assessment without limitations is refused');
select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'SIGNAL', array['x'], array['x'], '{"supportingEvidence":[]}', 'system', 'v')$s$, 'an assessment must keep its contradicting evidence list');
select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000b6', 'SIGNAL', array['x'], array['x'], '{"supportingEvidence":[],"contradictingEvidence":[]}', 'system', 'v')$s$, 'an assessment cannot use a claim of another project');
select pg_temp.rejects($s$update public.gap_assessments set classification = 'SIGNAL' where id = '80000000-0000-0000-0000-0000000000a6'$s$, 'the classification cannot be changed after it is recorded');
select pg_temp.rejects($s$update public.gap_assessments set basis = basis - 'contradictingEvidence' where id = '80000000-0000-0000-0000-0000000000a6'$s$, 'the recorded contradicting evidence cannot be removed');
update public.gap_assessments set researcher_confirmation = 'accepted', confirmed_by = '00000000-0000-0000-0000-0000000000a6', confirmed_at = now() where id = '80000000-0000-0000-0000-0000000000a6';
select pg_temp.check((select researcher_confirmation = 'accepted' and classification = 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE' from public.gap_assessments where id = '80000000-0000-0000-0000-0000000000a6'), 'the researcher decision is recorded without changing the classification');
select pg_temp.rejects($s$delete from public.gap_assessments where id = '80000000-0000-0000-0000-0000000000a6'$s$, 'the server cannot delete an assessment');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
select pg_temp.check((select count(*) = 0 from public.gap_assessments) and (select count(*) = 0 from public.research_search_runs), 'another user reads no assessments or search runs');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
select pg_temp.check((select count(*) = 1 from public.gap_assessments) and (select count(*) = 1 from public.research_search_runs), 'the owner reads their assessments and search runs');
select pg_temp.rejects($s$insert into public.gap_assessments (project_id, claim_id, classification, rationale, limitations, basis, origin, method_version) values ('10000000-0000-0000-0000-0000000000a6', '50000000-0000-0000-0000-0000000000a6', 'SIGNAL', array['x'], array['x'], '{"supportingEvidence":[],"contradictingEvidence":[]}', 'researcher', 'v')$s$, 'the browser cannot write a gap classification');
select pg_temp.rejects($s$update public.gap_assessments set researcher_confirmation = 'rejected', confirmed_at = now()$s$, 'the browser cannot change an assessment');
select pg_temp.rejects($s$insert into public.research_search_runs (id, user_id, project_id, context, query, providers_attempted, providers_available, result_count, executed_at) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a6', 'literature', 'forged', 99, 99, 9999, now())$s$, 'the browser cannot forge search coverage');
reset role;

delete from public.projects where id = '10000000-0000-0000-0000-0000000000a6';
select pg_temp.check(not exists (select 1 from public.gap_assessments where project_id = '10000000-0000-0000-0000-0000000000a6'), 'deleting a project removes its assessments and search runs');

select 'ALL CHECKS PASSED' as result;
rollback;
