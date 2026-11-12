-- Public share links for the research career page (DOC-30-03).
-- A link points at the ORCID iD and the sections the researcher chose.
-- It never exposes projects or account data. Only OpenAlex data is shown.
-- A revoked link stops working at once, and a researcher has at most one active link.

create table public.career_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (char_length(token) = 32 and token !~ '[^A-Za-z0-9_-]'),
  orcid text not null check (char_length(orcid) = 19 and orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]'),
  sections text[] not null check (
    cardinality(sections) between 1 and 3
    and sections <@ array['timeline', 'citations', 'directions']::text[]
  ),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index career_share_links_one_active
  on public.career_share_links (user_id)
  where revoked_at is null;

alter table public.career_share_links enable row level security;

revoke all on table public.career_share_links from anon;
revoke all on table public.career_share_links from authenticated;
grant select, insert on table public.career_share_links to authenticated;
grant update (revoked_at) on table public.career_share_links to authenticated;

create policy "Researchers read their own share links"
  on public.career_share_links
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Researchers create their own active share links"
  on public.career_share_links
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and revoked_at is null);

create policy "Researchers revoke their own share links"
  on public.career_share_links
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The public page reads one active link by its token and nothing else.
create or replace function public.shared_career(p_token text)
returns table (orcid text, sections text[], created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $function$
  select links.orcid, links.sections, links.created_at
  from public.career_share_links as links
  where links.token = p_token and links.revoked_at is null
  limit 1
$function$;

revoke all on function public.shared_career(text) from public;
grant execute on function public.shared_career(text) to anon;
grant execute on function public.shared_career(text) to authenticated;
