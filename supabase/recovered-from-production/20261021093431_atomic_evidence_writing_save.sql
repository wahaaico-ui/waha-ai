-- Only server-validated evidence snapshots may reach this service-only RPC.
-- The project row lock makes comparing the base and inserting one transaction.
create function public.commit_evidence_writing(
  p_project_id uuid, p_user_id uuid, p_document_id uuid,
  p_base_document_id uuid, p_content text
) returns jsonb language plpgsql security invoker
set search_path = ''
set lock_timeout = '5s'
as $writing_commit$
declare
  latest public.documents%rowtype;
  existing public.documents%rowtype;
  inserted_at timestamptz;
begin
  if p_document_id is null or p_content is null
    or jsonb_typeof(p_content::jsonb) is distinct from 'object' then
    raise exception 'Invalid writing snapshot' using errcode = '22023';
  end if;
  perform 1 from public.projects where id = p_project_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('outcome', 'missing'); end if;

  select * into latest from public.documents
    where project_id = p_project_id and type = 'evidence-writing:v1'
    order by created_at desc, id desc limit 1;
  select * into existing from public.documents where id = p_document_id;
  if found then
    if existing.project_id is distinct from p_project_id or existing.type is distinct from 'evidence-writing:v1'
      or existing.content is distinct from p_content then
      raise exception 'Writing receipt mismatch' using errcode = '22023';
    end if;
    if latest.id is distinct from p_document_id then
      return jsonb_build_object('outcome', 'conflict', 'saved', true, 'documentId', p_document_id);
    end if;
    return jsonb_build_object('outcome', 'saved', 'documentId', p_document_id);
  end if;
  if latest.id is distinct from p_base_document_id then
    return jsonb_build_object('outcome', 'conflict');
  end if;

  -- A request can start before another transaction finishes. Do not use now()
  -- (the transaction start time) to order a revision created after that wait.
  inserted_at := greatest(clock_timestamp(), coalesce(latest.created_at + interval '1 microsecond', clock_timestamp()));
  insert into public.documents(id, project_id, type, content, version, created_at)
    values (p_document_id, p_project_id, 'evidence-writing:v1', p_content, 1, inserted_at);
  return jsonb_build_object('outcome', 'saved', 'documentId', p_document_id);
end;
$writing_commit$;

revoke all on function public.commit_evidence_writing(uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.commit_evidence_writing(uuid,uuid,uuid,uuid,text) to service_role;
;
