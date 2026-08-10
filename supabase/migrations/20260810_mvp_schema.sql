cat supabase/migrations/20260810_mvp_schema.sql-- ==========================================
-- MVP Schema Migration
-- ==========================================

-- 1. جدول المشاريع (Projects)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text,
  created_at timestamptz default now()
);

-- 2. جدول المستندات (Documents)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text,
  content text,
  version int,
  created_at timestamptz default now()
);

-- 3. جدول المصادر والمراجع (Sources)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  raw_text text,
  parsed_citation_apa text,
  parsed_citation_ieee text,
  confidence text,
  created_at timestamptz default now()
);

-- 4. جدول سجل توليد الذكاء الاصطناعي (AI Generations Log)
create table if not exists public.ai_generations_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  feature text,
  prompt_hash text,
  model text,
  output text,
  confidence_label text,
  created_at timestamptz default now()
);

-- ==========================================
-- تفعيل سياسات الأمان (Row Level Security - RLS)
-- ==========================================

alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.sources enable row level security;
alter table public.ai_generations_log enable row level security;

-- سياسة جدول المشاريع: المستخدم يرى ويدير ممتلكاته فقط
create policy "Users can manage their own projects"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- سياسة جدول المستندات: مرتبطة بمشاريع المستخدم
create policy "Users can manage documents of their own projects"
  on public.documents
  for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = documents.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = documents.project_id
      and projects.user_id = auth.uid()
    )
  );

-- سياسة جدول المصادر: مرتبطة بمشاريع المستخدم
create policy "Users can manage sources of their own projects"
  on public.sources
  for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = sources.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = sources.project_id
      and projects.user_id = auth.uid()
    )
  );

-- سياسة جدول سجلات الذكاء الاصطناعي: مرتبطة بمشاريع المستخدم
create policy "Users can manage AI generation logs of their own projects"
  on public.ai_generations_log
  for all
  using (
    exists (
      select 1 from public.projects
      where projects.id = ai_generations_log.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = ai_generations_log.project_id
      and projects.user_id = auth.uid()
    )
  );
