-- Keep idea-verification history private to its authenticated owner.
-- Writes remain server-only through the service role.
alter table public.idea_verifications enable row level security;

revoke all on table public.idea_verifications from anon;
revoke insert, update, delete on table public.idea_verifications from authenticated;
grant select on table public.idea_verifications to authenticated;

drop policy if exists "Users can read own verifications" on public.idea_verifications;
create policy "Users can read own verifications"
on public.idea_verifications
for select
to authenticated
using ((select auth.uid()) = user_id);
