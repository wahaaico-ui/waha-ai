-- Physical PDF page manifests are server-derived. Owners retain read access,
-- but cannot forge, rewrite, retype or remove their authoritative page maps.
create policy "Browser cannot insert PDF manifests"
  on public.documents as restrictive for insert to anon, authenticated
  with check (coalesce(type, '') <> 'pdf-original:v1');
create policy "Browser cannot update PDF manifests"
  on public.documents as restrictive for update to anon, authenticated
  using (coalesce(type, '') <> 'pdf-original:v1')
  with check (coalesce(type, '') <> 'pdf-original:v1');
create policy "Browser cannot delete PDF manifests"
  on public.documents as restrictive for delete to anon, authenticated
  using (coalesce(type, '') <> 'pdf-original:v1');

-- Supabase supports bucket creation through SQL; no objects are inserted or
-- removed through SQL. Binaries are managed only by the Storage API.
-- https://supabase.com/docs/guides/storage/buckets/creating-buckets?language=sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('waha-research-pdfs', 'waha-research-pdfs', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;

-- Fail rather than silently rely on a bucket with unsafe configuration.
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'waha-research-pdfs'
    and public = false and file_size_limit = 4194304
    and allowed_mime_types = array['application/pdf']) then
    raise exception 'Unexpected PDF bucket configuration';
  end if;
end $$;
-- No anon/authenticated storage policies: bytes go through the owned-project
-- server route. A service-role credential never reaches the browser.
;
