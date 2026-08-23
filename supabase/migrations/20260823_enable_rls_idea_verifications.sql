-- Associate authenticated verification records with the Supabase user when
-- available. It remains nullable so the anonymous freemium flow can continue.
alter table public.idea_verifications
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_verifications_user_id_created
  on public.idea_verifications(user_id, created_at desc);

-- Visitors use the server-mediated freemium flow. They have no direct table
-- access. Server processes use the service role only for rate limiting and
-- controlled persistence operations.
alter table public.idea_verifications enable row level security;

create policy "Users can read own verifications"
  on public.idea_verifications
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own verifications"
  on public.idea_verifications
  for insert
  with check (auth.uid() = user_id);
