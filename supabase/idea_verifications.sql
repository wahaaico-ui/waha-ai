-- Run this ONCE in Supabase SQL Editor:
create table if not exists public.idea_verifications (
  id uuid primary key default gen_random_uuid(),
  user_ip text not null,
  topic text not null,
  translated_query text,
  acceptance_score int not null,
  decision text not null,
  total_papers int not null,
  gaps_count int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_verifications_ip on public.idea_verifications(user_ip, created_at desc);
create index if not exists idx_verifications_created on public.idea_verifications(created_at desc);
