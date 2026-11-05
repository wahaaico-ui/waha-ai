-- Writing snapshots and derived analyses are validated by owned-project server
-- routes. Owners retain reads, but direct client writes must not bypass those
-- checks. Restrictive policies preserve existing ownership and other types.
create policy "Browser cannot insert evidence writing documents"
  on public.documents as restrictive for insert to anon, authenticated
  with check (coalesce(type, '') not like 'evidence-writing:%'
    and coalesce(type, '') not like 'writing-analysis:%');

create policy "Browser cannot update evidence writing documents"
  on public.documents as restrictive for update to anon, authenticated
  using (coalesce(type, '') not like 'evidence-writing:%'
    and coalesce(type, '') not like 'writing-analysis:%')
  with check (coalesce(type, '') not like 'evidence-writing:%'
    and coalesce(type, '') not like 'writing-analysis:%');

create policy "Browser cannot delete evidence writing documents"
  on public.documents as restrictive for delete to anon, authenticated
  using (coalesce(type, '') not like 'evidence-writing:%'
    and coalesce(type, '') not like 'writing-analysis:%');
;
