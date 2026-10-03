-- Integrity for project_references and sources.
--
-- Both tables hold metadata the server asserts: a reference's provider and
-- provenance (server-discovered vs user-asserted) and a source's parsed
-- citations and confidence. Until now an owner could insert or rewrite any of
-- it through the Data API, for example labelling a reference server_discovered.
--
-- From this migration rows are inserted and updated only by the server
-- (service role), after the route has verified the project or source belongs to
-- the caller; project_id and user_id come from that check. Browser roles keep
-- SELECT and DELETE on their own rows through the existing owner policies, so a
-- researcher can still read and remove their references and sources.
--
-- Rollout: deploy the application code that writes through the service role
-- FIRST, then apply this migration. Applied before that code, the current
-- routes (which write with the user's session) would fail.
--
-- No existing rows are changed.
--
-- Rollback (restores the previous privileges; the new code keeps working):
--   drop policy if exists "Browser cannot insert project references" on public.project_references;
--   drop policy if exists "Browser cannot update project references" on public.project_references;
--   drop policy if exists "Browser cannot insert sources" on public.sources;
--   drop policy if exists "Browser cannot update sources" on public.sources;
--   grant insert, update on table public.project_references to authenticated;
--   grant insert, update on table public.sources to authenticated;

revoke insert, update on table public.project_references from anon, authenticated;
revoke insert, update on table public.sources from anon, authenticated;

-- RESTRICTIVE policies are ANDed with the permissive owner policies, so these
-- hold even if a later migration grants the privileges again (as
-- 20260908233328 does for authenticated).
drop policy if exists "Browser cannot insert project references" on public.project_references;
create policy "Browser cannot insert project references"
  on public.project_references as restrictive for insert to anon, authenticated
  with check (false);

drop policy if exists "Browser cannot update project references" on public.project_references;
create policy "Browser cannot update project references"
  on public.project_references as restrictive for update to anon, authenticated
  using (false) with check (false);

drop policy if exists "Browser cannot insert sources" on public.sources;
create policy "Browser cannot insert sources"
  on public.sources as restrictive for insert to anon, authenticated
  with check (false);

drop policy if exists "Browser cannot update sources" on public.sources;
create policy "Browser cannot update sources"
  on public.sources as restrictive for update to anon, authenticated
  using (false) with check (false);

-- Server routes write these tables; stated explicitly rather than relying on
-- the project's default privileges.
grant select, insert, update, delete on table public.project_references to service_role;
grant select, insert, update, delete on table public.sources to service_role;
