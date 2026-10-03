-- Slice 5: project claims and how evidence relates to them.
--
-- A claim is a research assertion the researcher is evaluating (for example a
-- problem statement, a gap or a hypothesis). It is not a conclusion.
--
-- claim_supports links a claim to an evidence item of the same project with a
-- relation: supports, contradicts, contextual or unclear.
--
-- Origin and confirmation are separate, so a suggestion stays recognisable:
--   origin researcher  the researcher made the link (confirmation confirmed)
--   origin system      the server or a model proposed it (starts suggested)
--   confirmation       suggested, confirmed or rejected, and confirmed or
--                      rejected only with the researcher who decided
-- A system claim stays draft until the researcher activates it.
--
-- The relation, origin, claim and evidence of a link cannot be changed after it
-- is created (trigger): a contradiction is never turned into support in place.
-- Evidence linked to a claim cannot be deleted on its own.
--
-- Browser roles may only read rows of their own projects. All writes go
-- through server routes (service role) after an ownership check.
--
-- Depends on: 20261008000000 (evidence_items, research_integrity_events).
--
-- Rollback (after rolling back the code), one statement per line:
--   drop table if exists public.claim_supports
--   drop table if exists public.claims
--   drop function if exists public.claim_supports_immutable_link()

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  statement text not null check (char_length(statement) between 1 and 2000),
  claim_type text not null check (claim_type in ('background', 'problem', 'gap', 'objective', 'question', 'hypothesis', 'methodological', 'other')),
  origin text not null check (origin in ('researcher', 'system')),
  status text not null check (status in ('draft', 'active', 'retired')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_researcher_author check (origin <> 'researcher' or created_by is not null),
  constraint claims_system_draft check (origin <> 'system' or status = 'draft' or confirmed_at is not null)
);
create unique index if not exists claims_id_project_idx on public.claims (id, project_id);
create index if not exists claims_project_idx on public.claims (project_id, created_at desc);

create table if not exists public.claim_supports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  claim_id uuid not null,
  evidence_item_id uuid not null,
  relation text not null check (relation in ('supports', 'contradicts', 'contextual', 'unclear')),
  origin text not null check (origin in ('researcher', 'system')),
  confirmation text not null check (confirmation in ('suggested', 'confirmed', 'rejected')),
  rationale text check (char_length(rationale) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_supports_claim_same_project foreign key (claim_id, project_id) references public.claims (id, project_id) on delete cascade,
  constraint claim_supports_evidence_same_project foreign key (evidence_item_id, project_id) references public.evidence_items (id, project_id),
  constraint claim_supports_one_link unique (claim_id, evidence_item_id),
  constraint claim_supports_researcher_link check (origin <> 'researcher' or (confirmation = 'confirmed' and created_by is not null)),
  constraint claim_supports_suggestion_origin check (confirmation <> 'suggested' or origin = 'system'),
  constraint claim_supports_decision check ((confirmation = 'suggested') = (decided_at is null))
);
create index if not exists claim_supports_claim_idx on public.claim_supports (claim_id);
create index if not exists claim_supports_evidence_idx on public.claim_supports (evidence_item_id);

create or replace function public.claim_supports_immutable_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $immutable$
begin
  if new.relation is distinct from old.relation or new.origin is distinct from old.origin
     or new.claim_id is distinct from old.claim_id or new.evidence_item_id is distinct from old.evidence_item_id
     or new.project_id is distinct from old.project_id then
    raise exception 'A claim support link cannot change its relation, origin, claim or evidence. Record a new link instead.';
  end if;
  return new;
end
$immutable$;
revoke all on function public.claim_supports_immutable_link() from public, anon, authenticated;
drop trigger if exists claim_supports_immutable_link on public.claim_supports;
create trigger claim_supports_immutable_link before update on public.claim_supports
  for each row execute function public.claim_supports_immutable_link();

alter table public.claims enable row level security;
alter table public.claim_supports enable row level security;
revoke all on table public.claims from public, anon, authenticated;
revoke all on table public.claim_supports from public, anon, authenticated;
grant select on table public.claims to authenticated;
grant select on table public.claim_supports to authenticated;
grant select, insert, update, delete on table public.claims to service_role;
grant select, insert, update, delete on table public.claim_supports to service_role;

drop policy if exists "Owners can read claims of their projects" on public.claims;
create policy "Owners can read claims of their projects" on public.claims
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = claims.project_id and p.user_id = (select auth.uid())));
drop policy if exists "Owners can read claim support of their projects" on public.claim_supports;
create policy "Owners can read claim support of their projects" on public.claim_supports
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = claim_supports.project_id and p.user_id = (select auth.uid())));

do $verify$
begin
  if to_regclass('public.claims') is null or to_regclass('public.claim_supports') is null then
    raise exception 'Slice 5 verification failed: tables are missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.claims'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.claim_supports'::regclass) then
    raise exception 'Slice 5 verification failed: RLS is not enabled';
  end if;
  if has_table_privilege('authenticated', 'public.claims', 'insert') or has_table_privilege('authenticated', 'public.claims', 'update')
     or has_table_privilege('authenticated', 'public.claim_supports', 'insert') or has_table_privilege('authenticated', 'public.claim_supports', 'update')
     or has_table_privilege('authenticated', 'public.claim_supports', 'delete') or has_table_privilege('anon', 'public.claims', 'select') then
    raise exception 'Slice 5 verification failed: browser roles can write claims or claim support';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'claim_supports_immutable_link' and tgrelid = 'public.claim_supports'::regclass) then
    raise exception 'Slice 5 verification failed: the immutable link trigger is missing';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'claim_supports_evidence_same_project')
     or not exists (select 1 from pg_constraint where conname = 'claim_supports_claim_same_project') then
    raise exception 'Slice 5 verification failed: same-project constraints are missing';
  end if;
end
$verify$;
