create table public.research_stage_drafts (
  project_id uuid not null references public.projects(id) on delete cascade,
  stage text not null check (stage in (
    'verify', 'title', 'problem', 'objectives', 'questions', 'hypotheses',
    'methodology', 'design', 'instrument', 'literature', 'analysis',
    'analysis_input', 'results', 'discussion', 'conclusions',
    'recommendations', 'publication'
  )),
  content jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, stage)
);

alter table public.research_stage_drafts enable row level security;

revoke all on table public.research_stage_drafts from anon;
revoke all on table public.research_stage_drafts from authenticated;
grant select, insert, update, delete on table public.research_stage_drafts to authenticated;

create policy "Users read drafts of their own projects"
  on public.research_stage_drafts
  for select
  to authenticated
  using ((select auth.uid()) = (
    select projects.user_id from public.projects where projects.id = project_id
  ));

create policy "Users insert drafts for their own projects"
  on public.research_stage_drafts
  for insert
  to authenticated
  with check ((select auth.uid()) = (
    select projects.user_id from public.projects where projects.id = project_id
  ));

create policy "Users update drafts of their own projects"
  on public.research_stage_drafts
  for update
  to authenticated
  using ((select auth.uid()) = (
    select projects.user_id from public.projects where projects.id = project_id
  ))
  with check ((select auth.uid()) = (
    select projects.user_id from public.projects where projects.id = project_id
  ));

create policy "Users delete drafts of their own projects"
  on public.research_stage_drafts
  for delete
  to authenticated
  using ((select auth.uid()) = (
    select projects.user_id from public.projects where projects.id = project_id
  ));

create or replace function public.save_research_stage_draft(
  p_project_id uuid,
  p_stage text,
  p_content jsonb,
  p_client_updated_at timestamptz
)
returns table (content jsonb, client_updated_at timestamptz, updated_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  insert into public.research_stage_drafts (
    project_id,
    stage,
    content,
    client_updated_at,
    updated_at
  )
  values (
    p_project_id,
    p_stage,
    p_content,
    p_client_updated_at,
    now()
  )
  on conflict (project_id, stage) do update
    set content = excluded.content,
        client_updated_at = excluded.client_updated_at,
        updated_at = now()
    where excluded.client_updated_at >= public.research_stage_drafts.client_updated_at
  returning
    research_stage_drafts.content,
    research_stage_drafts.client_updated_at,
    research_stage_drafts.updated_at;
$$;

revoke all on function public.save_research_stage_draft(uuid, text, jsonb, timestamptz) from public;
revoke all on function public.save_research_stage_draft(uuid, text, jsonb, timestamptz) from anon;
grant execute on function public.save_research_stage_draft(uuid, text, jsonb, timestamptz) to authenticated;
