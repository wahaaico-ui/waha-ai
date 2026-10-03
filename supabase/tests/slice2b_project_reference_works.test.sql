-- Slice 2B database checks (migration 20261006000000). Runs in one transaction
-- that is rolled back. Local disposable databases only.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $check$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_label; end if;
  raise notice 'PASS %', p_label;
end
$check$;

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1');
insert into public.projects (id, user_id, title) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Project A'),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Project A2');

set local role service_role;
insert into public.scholarly_works (id, identity_basis, identity_source, title, normalized_title)
values ('20000000-0000-0000-0000-0000000000a1', 'doi', 'crossref', 'Canonical work', 'canonical work');
insert into public.project_references (id, project_id, user_id, provider, external_item_key, title, work_id)
values ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
        'waha_discovery', '10.1000/x', 'Canonical work', '20000000-0000-0000-0000-0000000000a1');
select pg_temp.check(true, 'the server links a reference to a canonical work');

do $dup$ begin
  insert into public.project_references (project_id, user_id, provider, external_item_key, title, work_id)
  values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'waha_discovery', 'other-key', 'Same work again', '20000000-0000-0000-0000-0000000000a1');
  raise exception 'FAILED: a second reference to the same work was accepted in one project';
exception when unique_violation then raise notice 'PASS a project holds one reference per canonical work';
end $dup$;

insert into public.project_references (project_id, user_id, provider, external_item_key, title, work_id)
values ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'waha_discovery', '10.1000/x', 'Canonical work', '20000000-0000-0000-0000-0000000000a1');
select pg_temp.check(true, 'another project may reference the same canonical work');

insert into public.project_references (project_id, user_id, provider, external_item_key, title)
values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'user_asserted', 'manual-1', 'Manual study');
insert into public.project_references (project_id, user_id, provider, external_item_key, title)
values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'user_asserted', 'manual-2', 'Manual study two');
select pg_temp.check(true, 'references without a work are unconstrained by the per-work index');
reset role;

-- The owner cannot set or change work_id through the Data API.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $forge$ begin
  begin
    update public.project_references set work_id = '20000000-0000-0000-0000-0000000000a1' where external_item_key = 'manual-1';
    if found then raise exception 'FAILED: the owner linked a manual reference to a canonical work'; end if;
    raise notice 'PASS the owner cannot link a reference to a canonical work';
  exception when insufficient_privilege then raise notice 'PASS the owner cannot link a reference to a canonical work';
  end;
  begin
    insert into public.project_references (project_id, user_id, provider, external_item_key, title, work_id)
    values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'waha_discovery', 'forged', 'Forged', '20000000-0000-0000-0000-0000000000a1');
    raise exception 'FAILED: the owner inserted a reference with a work id';
  exception when insufficient_privilege or check_violation then raise notice 'PASS the owner cannot insert a reference with a work id';
  end;
end $forge$;
select pg_temp.check((select count(*) = 4 from public.project_references), 'the owner still reads their references');
reset role;

select pg_temp.check((select work_id is null from public.project_references where external_item_key = 'manual-1'), 'the manual reference stayed without a work');

select 'ALL CHECKS PASSED' as result;
rollback;
