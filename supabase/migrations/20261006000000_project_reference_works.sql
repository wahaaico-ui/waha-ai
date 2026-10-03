-- Slice 2B: link project references to canonical scholarly works.
--
-- A reference saved from a server-held search result points to the canonical
-- work that result was resolved to (project_references.work_id). The link is
-- set only by the server, from research_search_results.work_id, never from the
-- browser: browser roles cannot insert or update project_references (migration
-- 20261004000000) and nothing here changes that.
--
-- Manual (user_asserted), Zotero and legacy references keep work_id null. No
-- existing row is changed: there is no backfill.
--
-- A project holds at most one reference per canonical work, so the same work
-- saved from two searches is one reference.
--
-- Depends on: 20261004000000 (project_references write protection) and
-- 20261005000000 (scholarly_works).
--
-- Rollout: apply this migration BEFORE deploying the code that writes work_id.
--
-- Rollback (after rolling back the code), one statement per line:
--   drop index if exists public.project_references_project_work_idx
--   alter table public.project_references drop column if exists work_id

alter table public.project_references
  add column if not exists work_id uuid references public.scholarly_works(id) on delete set null;

create unique index if not exists project_references_project_work_idx
  on public.project_references (project_id, work_id) where work_id is not null;

-- Self-check: the column exists and browser roles still cannot write
-- references, so they cannot set work_id.
do $verify$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'project_references' and column_name = 'work_id' and is_nullable = 'YES') then
    raise exception 'Slice 2B verification failed: project_references.work_id is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_references'
                  and policyname = 'Browser cannot insert project references' and permissive = 'RESTRICTIVE')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_references'
                  and policyname = 'Browser cannot update project references' and permissive = 'RESTRICTIVE') then
    raise exception 'Slice 2B verification failed: project_references write protection (20261004000000) is missing'
      using hint = 'Apply 20261004000000_server_owned_references_and_sources.sql first.';
  end if;
end
$verify$;
