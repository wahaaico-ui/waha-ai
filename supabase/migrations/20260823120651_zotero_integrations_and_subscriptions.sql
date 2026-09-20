-- Version aligned with production migration history.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan text not null default 'researcher' check (plan in ('researcher', 'institutional')),
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('zotero')),
  external_user_id text not null,
  access_token_encrypted text,
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'connected' check (status in ('connected', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, provider)
);

create table if not exists public.project_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  external_item_key text not null,
  doi text,
  isbn text,
  title text not null,
  authors jsonb not null default '[]'::jsonb,
  publication_year integer,
  publication_title text,
  url text,
  citation_data jsonb not null default '{}'::jsonb,
  source_version integer,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, provider, external_item_key)
);

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists user_integrations_user_id_idx on public.user_integrations(user_id);
create index if not exists project_references_user_id_idx on public.project_references(user_id);
create index if not exists project_references_project_id_idx on public.project_references(project_id);
create index if not exists project_references_project_doi_idx
  on public.project_references(project_id, lower(doi)) where doi is not null and doi <> '';

alter table public.subscriptions enable row level security;
alter table public.user_integrations enable row level security;
alter table public.project_references enable row level security;

revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.user_integrations from anon, authenticated;
revoke all on table public.project_references from anon, authenticated;
grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.project_references to authenticated;

create policy "Users can view their own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own project references"
  on public.project_references for select to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.projects where projects.id = project_references.project_id and projects.user_id = (select auth.uid())
  ));

create policy "Users can add their own project references"
  on public.project_references for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.projects where projects.id = project_references.project_id and projects.user_id = (select auth.uid())
  ));

create policy "Users can update their own project references"
  on public.project_references for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.projects where projects.id = project_references.project_id and projects.user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.projects where projects.id = project_references.project_id and projects.user_id = (select auth.uid())
  ));

create policy "Users can delete their own project references"
  on public.project_references for delete to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.projects where projects.id = project_references.project_id and projects.user_id = (select auth.uid())
  ));
