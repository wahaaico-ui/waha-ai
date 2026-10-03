-- Slice 5 database checks (migration 20261009000000). Runs in one transaction
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

insert into auth.users values ('00000000-0000-0000-0000-0000000000a5'), ('00000000-0000-0000-0000-0000000000b5');
insert into public.projects (id, user_id, title) values
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'Project A'),
  ('10000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000b5', 'Project B');

set local role service_role;
insert into public.evidence_items (id, project_id, created_by, source_kind, evidence_type, content, origin, state, state_set_by) values
  ('40000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'none', 'finding', 'A evidence', 'researcher', 'user_asserted', 'system'),
  ('40000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'none', 'finding', 'A evidence two', 'researcher', 'user_asserted', 'system'),
  ('40000000-0000-0000-0000-0000000000b5', '10000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000b5', 'none', 'finding', 'B evidence', 'researcher', 'user_asserted', 'system');
insert into public.claims (id, project_id, created_by, statement, claim_type, origin, status) values
  ('50000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'A gap claim', 'gap', 'researcher', 'active');
insert into public.claim_supports (id, project_id, claim_id, evidence_item_id, relation, origin, confirmation, created_by, decided_by, decided_at) values
  ('60000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a5', '50000000-0000-0000-0000-0000000000a5', '40000000-0000-0000-0000-0000000000a5', 'contradicts', 'researcher', 'confirmed', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', now());
insert into public.claim_supports (id, project_id, claim_id, evidence_item_id, relation, origin, confirmation) values
  ('60000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a5', '50000000-0000-0000-0000-0000000000a5', '40000000-0000-0000-0000-0000000000a6', 'supports', 'system', 'suggested');
select pg_temp.check(true, 'researcher and suggested links are recorded');

select pg_temp.rejects($s$insert into public.claim_supports (project_id, claim_id, evidence_item_id, relation, origin, confirmation) values ('10000000-0000-0000-0000-0000000000a5', '50000000-0000-0000-0000-0000000000a5', '40000000-0000-0000-0000-0000000000b5', 'supports', 'system', 'suggested')$s$, 'a link cannot use evidence of another project');
select pg_temp.rejects($s$insert into public.claim_supports (project_id, claim_id, evidence_item_id, relation, origin, confirmation) values ('10000000-0000-0000-0000-0000000000b5', '50000000-0000-0000-0000-0000000000a5', '40000000-0000-0000-0000-0000000000b5', 'supports', 'system', 'suggested')$s$, 'a link cannot use a claim of another project');
select pg_temp.rejects($s$update public.claim_supports set relation = 'supports' where id = '60000000-0000-0000-0000-0000000000a5'$s$, 'a contradiction cannot be changed into support in place');
select pg_temp.rejects($s$update public.claim_supports set origin = 'researcher' where id = '60000000-0000-0000-0000-0000000000a6'$s$, 'a suggestion cannot be relabelled as a researcher link');
select pg_temp.rejects($s$insert into public.claim_supports (project_id, claim_id, evidence_item_id, relation, origin, confirmation) values ('10000000-0000-0000-0000-0000000000a5', '50000000-0000-0000-0000-0000000000a5', '40000000-0000-0000-0000-0000000000a5', 'supports', 'researcher', 'suggested')$s$, 'a researcher link cannot be stored as a suggestion');
select pg_temp.rejects($s$update public.claim_supports set confirmation = 'confirmed' where id = '60000000-0000-0000-0000-0000000000a6'$s$, 'a suggestion is confirmed only with the deciding researcher and time');
update public.claim_supports set confirmation = 'confirmed', decided_by = '00000000-0000-0000-0000-0000000000a5', decided_at = now() where id = '60000000-0000-0000-0000-0000000000a6';
select pg_temp.check((select origin = 'system' and confirmation = 'confirmed' from public.claim_supports where id = '60000000-0000-0000-0000-0000000000a6'), 'a confirmed suggestion keeps its system origin');
select pg_temp.rejects($s$insert into public.claims (project_id, statement, claim_type, origin, status) values ('10000000-0000-0000-0000-0000000000a5', 'Proposed', 'gap', 'system', 'active')$s$, 'a system claim cannot be active without researcher confirmation');
select pg_temp.rejects($s$delete from public.evidence_items where id = '40000000-0000-0000-0000-0000000000a5'$s$, 'evidence linked to a claim cannot be deleted on its own');
select pg_temp.check((select relation = 'contradicts' from public.claim_supports where id = '60000000-0000-0000-0000-0000000000a5'), 'the contradiction is still recorded');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
select pg_temp.check((select count(*) = 0 from public.claims) and (select count(*) = 0 from public.claim_supports), 'another user reads none of the claims or links');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
select pg_temp.check((select count(*) = 2 from public.claim_supports), 'the owner reads the links of their project');
select pg_temp.rejects($s$insert into public.claims (project_id, created_by, statement, claim_type, origin, status) values ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'Forged', 'gap', 'researcher', 'active')$s$, 'the browser cannot create claims');
select pg_temp.rejects($s$update public.claim_supports set confirmation = 'rejected' where id = '60000000-0000-0000-0000-0000000000a5'$s$, 'the browser cannot change links');
select pg_temp.rejects($s$delete from public.claim_supports where id = '60000000-0000-0000-0000-0000000000a5'$s$, 'the browser cannot delete links directly');
reset role;

delete from public.projects where id = '10000000-0000-0000-0000-0000000000a5';
select pg_temp.check(not exists (select 1 from public.claim_supports where project_id = '10000000-0000-0000-0000-0000000000a5'), 'deleting a project removes its claims, links and evidence together');

select 'ALL CHECKS PASSED' as result;
rollback;
