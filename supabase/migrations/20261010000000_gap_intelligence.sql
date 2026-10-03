-- Slice 6: recorded search scope and conservative gap assessments.
--
-- research_search_runs records the scope of each search the server ran: the
-- query, which providers were attempted and available, how many results were
-- stored, and its limitations. Its id is the search_run_id already stored on
-- research_search_results. It is a record of what was searched, never a claim
-- that the literature was covered exhaustively.
--
-- gap_assessments records an explainable assessment of one gap claim, made by
-- the server from the claim, its researcher-confirmed evidence links and the
-- recorded search scope. classification is one of:
--   SIGNAL                                     no confirmed supporting evidence yet
--   NEEDS_MORE_EVIDENCE                        support is contested or insufficient
--   POTENTIAL_GAP                              some confirmed support, below the bar below
--   EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE  at least two grounded supporting items
--                                              from two distinct sources and at least one
--                                              recorded search with an available provider
-- There is no verified classification. Every assessment keeps its basis
-- (counts, evidence and contradicting evidence), the search runs in scope and
-- at least one limitation. Only the researcher decision (accepted or rejected)
-- can change after an assessment is recorded, and a new assessment is a new row.
--
-- Browser roles may only read rows of their own projects. All writes go
-- through server routes (service role) after an ownership check.
--
-- Depends on: 20261009000000 (claims).
--
-- Rollback (after rolling back the code), one statement per line:
--   drop table if exists public.gap_assessments
--   drop table if exists public.research_search_runs
--   drop function if exists public.gap_assessments_immutable()

create table if not exists public.research_search_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  context text not null check (context in ('literature', 'evidence_panel')),
  query text not null check (char_length(query) between 1 and 1000),
  domain text check (char_length(domain) <= 64),
  providers jsonb not null default '[]'::jsonb check (jsonb_typeof(providers) = 'array'),
  providers_attempted integer not null check (providers_attempted >= 0),
  providers_available integer not null check (providers_available >= 0),
  candidate_count integer check (candidate_count >= 0),
  result_count integer not null check (result_count >= 0),
  limitations text[] not null default '{}',
  executed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint research_search_runs_available check (providers_available <= providers_attempted)
);
create index if not exists research_search_runs_project_idx on public.research_search_runs (project_id, executed_at desc);

create table if not exists public.gap_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  claim_id uuid not null,
  classification text not null check (classification in ('SIGNAL', 'NEEDS_MORE_EVIDENCE', 'POTENTIAL_GAP', 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE')),
  rationale text[] not null check (cardinality(rationale) >= 1),
  limitations text[] not null check (cardinality(limitations) >= 1),
  basis jsonb not null check (jsonb_typeof(basis) = 'object'),
  search_run_ids uuid[] not null default '{}',
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope) = 'object'),
  origin text not null check (origin in ('system', 'researcher')),
  method_version text not null check (char_length(method_version) between 1 and 32),
  researcher_confirmation text not null default 'unreviewed' check (researcher_confirmation in ('unreviewed', 'accepted', 'rejected')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  constraint gap_assessments_claim_same_project foreign key (claim_id, project_id) references public.claims (id, project_id) on delete cascade,
  constraint gap_assessments_confirmation check ((researcher_confirmation = 'unreviewed') = (confirmed_at is null)),
  constraint gap_assessments_evidence_backed check (
    classification <> 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE' or (
      cardinality(search_run_ids) >= 1
      and coalesce((basis->>'groundedSupportingEvidence')::integer, 0) >= 2
      and coalesce((basis->>'distinctSupportingSources')::integer, 0) >= 2
      and coalesce((basis->>'searchRunsWithAvailableProviders')::integer, 0) >= 1)),
  constraint gap_assessments_potential check (
    classification <> 'POTENTIAL_GAP' or coalesce((basis->>'confirmedSupportingEvidence')::integer, 0) >= 1),
  constraint gap_assessments_contradictions_kept check (basis ? 'contradictingEvidence' and basis ? 'supportingEvidence')
);
create index if not exists gap_assessments_claim_idx on public.gap_assessments (project_id, claim_id, generated_at desc);

create or replace function public.gap_assessments_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $immutable$
begin
  if (to_jsonb(new) - array['researcher_confirmation', 'confirmed_by', 'confirmed_at'])
     is distinct from (to_jsonb(old) - array['researcher_confirmation', 'confirmed_by', 'confirmed_at']) then
    raise exception 'A gap assessment cannot be changed after it is recorded, except for the researcher decision. Record a new assessment instead.';
  end if;
  return new;
end
$immutable$;
revoke all on function public.gap_assessments_immutable() from public, anon, authenticated;
drop trigger if exists gap_assessments_immutable on public.gap_assessments;
create trigger gap_assessments_immutable before update on public.gap_assessments
  for each row execute function public.gap_assessments_immutable();

alter table public.research_search_runs enable row level security;
alter table public.gap_assessments enable row level security;
revoke all on table public.research_search_runs from public, anon, authenticated;
revoke all on table public.gap_assessments from public, anon, authenticated;
grant select on table public.research_search_runs to authenticated;
grant select on table public.gap_assessments to authenticated;
revoke update, delete, truncate on table public.research_search_runs from service_role;
grant select, insert on table public.research_search_runs to service_role;
revoke delete, truncate on table public.gap_assessments from service_role;
grant select, insert, update on table public.gap_assessments to service_role;

drop policy if exists "Owners can read search runs of their projects" on public.research_search_runs;
create policy "Owners can read search runs of their projects" on public.research_search_runs
  for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.projects p where p.id = research_search_runs.project_id and p.user_id = (select auth.uid())));
drop policy if exists "Owners can read gap assessments of their projects" on public.gap_assessments;
create policy "Owners can read gap assessments of their projects" on public.gap_assessments
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = gap_assessments.project_id and p.user_id = (select auth.uid())));

do $verify$
begin
  if to_regclass('public.research_search_runs') is null or to_regclass('public.gap_assessments') is null then
    raise exception 'Slice 6 verification failed: tables are missing';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.research_search_runs'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.gap_assessments'::regclass) then
    raise exception 'Slice 6 verification failed: RLS is not enabled';
  end if;
  if has_table_privilege('authenticated', 'public.gap_assessments', 'insert') or has_table_privilege('authenticated', 'public.gap_assessments', 'update')
     or has_table_privilege('authenticated', 'public.research_search_runs', 'insert') or has_table_privilege('anon', 'public.gap_assessments', 'select')
     or has_table_privilege('anon', 'public.research_search_runs', 'select') then
    raise exception 'Slice 6 verification failed: browser roles can write gap assessments or search runs';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.gap_assessments'::regclass and pg_get_constraintdef(oid) ilike '%VERIFIED%') then
    raise exception 'Slice 6 verification failed: a verified classification exists';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'gap_assessments_immutable' and tgrelid = 'public.gap_assessments'::regclass) then
    raise exception 'Slice 6 verification failed: the immutability trigger is missing';
  end if;
end
$verify$;
