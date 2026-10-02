-- Slice 1: server-held search results, selected by ID.
--
-- Academic search results are written here by the server when a search runs.
-- The browser receives each result's id and later selects results by that id;
-- the server rehydrates the metadata from this table, so the browser can choose
-- a discovered source but cannot define one.
--
-- Additive only: one new table, no change to existing tables or rows. Results
-- are scoped to the user and project that ran the search and expire, so they
-- are a short-lived selection buffer, not a source of record. There is no
-- browser access: writes and reads go through server routes (service role).
--
-- Rollback (after rolling back the application code): drop table
-- public.research_search_results; it holds only transient search results.

create table if not exists public.research_search_results (
  id uuid primary key default gen_random_uuid(),
  search_run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  context text not null check (context in ('literature', 'evidence_panel')),
  query text not null check (char_length(query) between 1 and 1000),
  position integer not null check (position >= 0),
  metadata jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists research_search_results_owner_idx
  on public.research_search_results (user_id, project_id, expires_at);
create index if not exists research_search_results_expiry_idx
  on public.research_search_results (expires_at);

alter table public.research_search_results enable row level security;
revoke all on table public.research_search_results from public, anon, authenticated;
-- The server routes need only these; stated explicitly rather than relying on
-- the project's default privileges.
grant select, insert, delete on table public.research_search_results to service_role;
