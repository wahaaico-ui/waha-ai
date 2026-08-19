-- ==========================================
-- Users Usage Log (تتبع محاولات المستخدمين لتحليل الأفكار البحثية)
-- ==========================================

create table if not exists public.users_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  idea_text text,
  report_score integer
);

create index if not exists users_usage_user_id_idx on public.users_usage(user_id);

alter table public.users_usage enable row level security;

-- المستخدم يرى محاولاته الخاصة فقط. الكتابة تتم من السيرفر (service role) فقط،
-- كي لا يستطيع المستخدم تزوير سجل استخدامه الخاص من المتصفح مباشرة.
create policy "Users can view their own usage"
  on public.users_usage
  for select
  using (auth.uid() = user_id);
