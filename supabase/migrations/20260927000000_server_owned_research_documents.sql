-- Slice 0: server-owned research state.
--
-- The research journey and the exploration report are system state: the
-- server derives gate inputs from them. Until now the browser could insert,
-- change or delete these rows for its own projects through the Data API and so
-- bypass the workflow gates. Application routes now write these rows with the
-- server client after verifying project ownership.
--
-- Non-destructive: no rows are changed, no columns are dropped and no existing
-- policy is removed. RESTRICTIVE policies are ANDed with whatever permissive
-- policies exist, so this holds even if production policy names differ from
-- the migration history. The service role bypasses RLS and is unaffected.

-- documents: browser roles may still read their own rows (existing policy) and
-- write other document types, but not journey:* or idea_verification rows.
drop policy if exists "Browser cannot insert server-owned research documents" on public.documents;
create policy "Browser cannot insert server-owned research documents"
  on public.documents
  as restrictive
  for insert
  to anon, authenticated
  with check (coalesce(type, '') <> 'idea_verification' and coalesce(type, '') not like 'journey:%');

drop policy if exists "Browser cannot update server-owned research documents" on public.documents;
create policy "Browser cannot update server-owned research documents"
  on public.documents
  as restrictive
  for update
  to anon, authenticated
  using (coalesce(type, '') <> 'idea_verification' and coalesce(type, '') not like 'journey:%')
  with check (coalesce(type, '') <> 'idea_verification' and coalesce(type, '') not like 'journey:%');

drop policy if exists "Browser cannot delete server-owned research documents" on public.documents;
create policy "Browser cannot delete server-owned research documents"
  on public.documents
  as restrictive
  for delete
  to anon, authenticated
  using (coalesce(type, '') <> 'idea_verification' and coalesce(type, '') not like 'journey:%');

-- ai_generations_log is an audit record of model calls. It is written only by
-- the server; owners keep read access through the existing policy.
revoke insert, update, delete on table public.ai_generations_log from anon, authenticated;
