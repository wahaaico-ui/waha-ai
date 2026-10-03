-- Slice 4 database checks (migration 20261008000000). Runs in one transaction
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

insert into auth.users values ('00000000-0000-0000-0000-0000000000a4'), ('00000000-0000-0000-0000-0000000000b4');
insert into public.projects (id, user_id, title) values
  ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'Project A'),
  ('10000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b4', 'Project B');

set local role service_role;
insert into public.project_references (id, project_id, user_id, provider, external_item_key, title) values
  ('30000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'waha_discovery', 'a-key', 'A reference'),
  ('30000000-0000-0000-0000-0000000000b4', '10000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b4', 'waha_discovery', 'b-key', 'B reference');
insert into public.evidence_items (id, project_id, created_by, project_reference_id, source_kind, evidence_type, content, origin, state, state_set_by) values
  ('40000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a4', 'server_discovered', 'finding', 'A evidence', 'researcher', 'recorded', 'system'),
  ('40000000-0000-0000-0000-0000000000b4', '10000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000b4', '30000000-0000-0000-0000-0000000000b4', 'server_discovered', 'finding', 'B evidence', 'researcher', 'recorded', 'system');
select pg_temp.check(true, 'the server records evidence citing a reference of the same project');

select pg_temp.rejects($s$insert into public.evidence_items (project_id, created_by, project_reference_id, source_kind, evidence_type, content, origin, state, state_set_by) values ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000b4', 'server_discovered', 'finding', 'x', 'researcher', 'recorded', 'system')$s$, 'evidence cannot cite a reference of another project');
select pg_temp.rejects($s$insert into public.evidence_items (project_id, created_by, source_kind, evidence_type, content, origin, state, state_set_by) values ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'none', 'finding', 'x', 'researcher', 'source_supported', 'researcher')$s$, 'source_supported needs a cited source');
select pg_temp.rejects($s$update public.evidence_items set state = 'source_supported', state_set_by = 'system' where id = '40000000-0000-0000-0000-0000000000a4'$s$, 'the system cannot mark evidence as source_supported');
select pg_temp.rejects($s$insert into public.evidence_items (project_id, created_by, project_reference_id, source_kind, evidence_type, content, origin, state, state_set_by) values ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', '30000000-0000-0000-0000-0000000000a4', 'server_discovered', 'finding', 'x', 'system', 'recorded', 'system')$s$, 'evidence proposed by the system must start as needs_review');
select pg_temp.rejects($s$insert into public.evidence_items (project_id, created_by, source_kind, evidence_type, content, origin, state, state_set_by) values ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'none', 'finding', 'x', 'researcher', 'recorded', 'system')$s$, 'recorded requires a server-discovered source');
select pg_temp.rejects($s$insert into public.evidence_items (project_id, created_by, source_kind, evidence_type, content, origin, state, state_set_by) values ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'none', 'finding', 'x', 'researcher', 'verified', 'researcher')$s$, 'there is no verified state');
update public.evidence_items set state = 'source_supported', state_set_by = 'researcher' where id = '40000000-0000-0000-0000-0000000000a4';
select pg_temp.check(true, 'a researcher judgement can be recorded by the server');

insert into public.research_integrity_events (project_id, actor, entity_type, entity_id, action) values ('10000000-0000-0000-0000-0000000000a4', 'researcher', 'evidence_item', '40000000-0000-0000-0000-0000000000a4', 'created');
select pg_temp.rejects($s$update public.research_integrity_events set action = 'edited'$s$, 'the audit log cannot be updated');
select pg_temp.rejects($s$delete from public.research_integrity_events$s$, 'the audit log cannot be deleted');
select pg_temp.rejects($s$delete from public.project_references where id = '30000000-0000-0000-0000-0000000000a4'$s$, 'a reference cited by evidence cannot be deleted on its own');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
select pg_temp.check((select count(*) = 1 and bool_and(project_id = '10000000-0000-0000-0000-0000000000a4') from public.evidence_items), 'the owner reads only the evidence of their own project');
select pg_temp.check((select count(*) = 1 from public.research_integrity_events), 'the owner reads the audit log of their project');
select pg_temp.rejects($s$insert into public.evidence_items (project_id, created_by, source_kind, evidence_type, content, origin, state, state_set_by) values ('10000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a4', 'none', 'finding', 'forged', 'researcher', 'user_asserted', 'system')$s$, 'the browser cannot create evidence');
select pg_temp.rejects($s$update public.evidence_items set state = 'source_supported' where id = '40000000-0000-0000-0000-0000000000a4'$s$, 'the browser cannot change evidence state');
select pg_temp.rejects($s$delete from public.evidence_items where id = '40000000-0000-0000-0000-0000000000a4'$s$, 'the browser cannot delete evidence directly');
select pg_temp.rejects($s$insert into public.research_integrity_events (project_id, actor, entity_type, entity_id, action) values ('10000000-0000-0000-0000-0000000000a4', 'system', 'evidence_item', '40000000-0000-0000-0000-0000000000a4', 'forged')$s$, 'the browser cannot write the audit log');
reset role;
set local role anon;
select pg_temp.rejects($s$select count(*) from public.evidence_items$s$, 'an anonymous user cannot read evidence');
reset role;

delete from public.projects where id = '10000000-0000-0000-0000-0000000000a4';
select pg_temp.check(not exists (select 1 from public.evidence_items where project_id = '10000000-0000-0000-0000-0000000000a4'), 'deleting a project removes its references and evidence together');

select 'ALL CHECKS PASSED' as result;
rollback;
