-- Slice 4: project evidence items and the research integrity audit log.
--
-- A scholarly work is a source. An evidence item is project-specific: a
-- finding, measure or other point a researcher recorded from a source for this
-- project, with an optional excerpt locator. It is never a statement that the
-- point is true.
--
-- state (who may set it):
--   recorded              system, when the item cites a server-discovered reference
--   user_asserted         system, when the source is manual, imported or absent
--   needs_review          system or researcher
--   source_supported      researcher only: the researcher confirmed the source says this
--   insufficient_support  researcher only
-- The system (including any model) can never set source_supported or
-- insufficient_support, and an item proposed by the system starts as
-- needs_review.
--
-- Integrity: an item can cite only a reference of the same project (composite
-- foreign key). A reference cited by evidence cannot be deleted on its own
-- (NO ACTION), while deleting the whole project still removes both.
--
-- research_integrity_events is an append-only audit log of changes to
-- evidence, claims, claim support and gap assessments (Slices 4 to 6).
--
-- Browser roles may only read rows of their own projects. All writes go
-- through server routes (service role) after an ownership check.
--
-- Depends on: 20261004000000, 20261006000000 (project_references.work_id).
--
-- Rollback (after rolling back the code), one statement per line:
--   drop table if exists public.evidence_items
--   drop table if exists public.research_integrity_events
--   drop index if exists public.project_references_id_project_idx

create unique index if not exists project_references_id_project_idx on public.project_references (id, project_id);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  project_reference_id uuid,
  work_id uuid references public.scholarly_works(id) on delete set null,
  source_kind text not null check (source_kind in ('server_discovered', 'user_asserted', 'zotero_import', 'legacy', 'none')),
  evidence_type text not null check (evidence_type in ('finding', 'method', 'measure', 'population', 'context', 'definition', 'limitation', 'other')),
  content text not null check (char_length(content) between 1 and 4000),
  locator text check (char_length(locator) <= 200),
  origin text not null check (origin in ('researcher', 'system')),
  state text not null check (state in ('recorded', 'user_asserted', 'source_supported', 'insufficient_support', 'needs_review')),
  state_set_by text not null check (state_set_by in ('system', 'researcher')),
  state_set_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_items_reference_same_project foreign key (project_reference_id, project_id)
    references public.project_references (id, project_id),
  constraint evidence_items_supported_needs_source check (state not in ('source_supported', 'insufficient_support') or project_reference_id is not null),
  constraint evidence_items_recorded_needs_discovery check (state <> 'recorded' or source_kind = 'server_discovered'),
  constraint evidence_items_researcher_judgement check (state not in ('source_supported', 'insufficient_support') or state_set_by = 'researcher'),
  constraint evidence_items_system_proposal check (origin = 'researcher' or state_set_by = 'researcher' or state = 'needs_review'),
  constraint evidence_items_source_kind check ((project_reference_id is null) = (source_kind = 'none'))
);
create unique index if not exists evidence_items_id_project_idx on public.evidence_items (id, project_id);
create index if not exists evidence_items_project_idx on public.evidence_items (project_id, created_at desc);
create index if not exists evidence_items_reference_idx on public.evidence_items (project_reference_id) where project_reference_id is not null;

create table if not exists public.research_integrity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor text not null check (actor in ('researcher', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('evidence_item', 'claim', 'claim_support', 'gap_assessment')),
  entity_id uuid not null,
  action text not null check (char_length(action) between 1 and 64),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists research_integrity_events_entity_idx on public.research_integrity_events (project_id, entity_type, entity_id, created_at);

alter table public.evidence_items enable row level security;
alter table public.research_integrity_events enable row level security;
revoke all on table public.evidence_items from public, anon, authenticated;
revoke all on table public.research_integrity_events from public, anon, authenticated;
grant select on table public.evidence_items to authenticated;
grant select on table public.research_integrity_events to authenticated;
grant select, insert, update, delete on table public.evidence_items to service_role;
revoke update, delete, truncate on table public.research_integrity_events from service_role;
grant select, insert on table public.research_integrity_events to service_role;

drop policy if exists "Owners can read evidence of their projects" on public.evidence_items;
create policy "Owners can read evidence of their projects" on public.evidence_items
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = evidence_items.project_id and p.user_id = (select auth.uid())));
drop policy if exists "Owners can read the audit log of their projects" on public.research_integrity_events;
create policy "Owners can read the audit log of their projects" on public.research_integrity_events
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = research_integrity_events.project_id and p.user_id = (select auth.uid())));

do $verify$
begin
  if to_regclass('public.evidence_items') is null or to_regclass('public.research_integrity_events') is null then
    raise exception 'Slice 4 verification failed: tables are missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.evidence_items'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.research_integrity_events'::regclass) then
    raise exception 'Slice 4 verification failed: RLS is not enabled';
  end if;
  if has_table_privilege('authenticated', 'public.evidence_items', 'insert') or has_table_privilege('authenticated', 'public.evidence_items', 'update')
     or has_table_privilege('authenticated', 'public.evidence_items', 'delete') or has_table_privilege('anon', 'public.evidence_items', 'select')
     or has_table_privilege('authenticated', 'public.research_integrity_events', 'insert') or has_table_privilege('anon', 'public.research_integrity_events', 'select') then
    raise exception 'Slice 4 verification failed: browser roles can write evidence or the audit log';
  end if;
  if has_table_privilege('service_role', 'public.research_integrity_events', 'update') or has_table_privilege('service_role', 'public.research_integrity_events', 'delete') then
    raise exception 'Slice 4 verification failed: the audit log is not append-only';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'evidence_items_reference_same_project') then
    raise exception 'Slice 4 verification failed: the same-project reference constraint is missing';
  end if;
end
$verify$;
