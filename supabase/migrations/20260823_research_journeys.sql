create table if not exists public.research_journeys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  current_stage text not null default 'verify',
  status text not null default 'active' check (status in ('active', 'ready_for_publication', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_stage_outputs (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.research_journeys(id) on delete cascade,
  stage text not null,
  content jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (journey_id, stage, version)
);

create table if not exists public.research_decisions (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.research_journeys(id) on delete cascade,
  stage text not null,
  decision text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.research_journeys enable row level security;
alter table public.research_stage_outputs enable row level security;
alter table public.research_decisions enable row level security;

create policy "Users manage their own research journeys" on public.research_journeys for all
using (exists (select 1 from public.projects where projects.id = research_journeys.project_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.projects where projects.id = research_journeys.project_id and projects.user_id = auth.uid()));

create policy "Users manage their own research stage outputs" on public.research_stage_outputs for all
using (exists (select 1 from public.research_journeys join public.projects on projects.id = research_journeys.project_id where research_journeys.id = research_stage_outputs.journey_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.research_journeys join public.projects on projects.id = research_journeys.project_id where research_journeys.id = research_stage_outputs.journey_id and projects.user_id = auth.uid()));

create policy "Users manage their own research decisions" on public.research_decisions for all
using (exists (select 1 from public.research_journeys join public.projects on projects.id = research_journeys.project_id where research_journeys.id = research_decisions.journey_id and projects.user_id = auth.uid()))
with check (exists (select 1 from public.research_journeys join public.projects on projects.id = research_journeys.project_id where research_journeys.id = research_decisions.journey_id and projects.user_id = auth.uid()));
