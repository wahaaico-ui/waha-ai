-- Slice 2A: canonical scholarly works and their identifiers.
--
-- A scholarly work is recorded once, whichever providers returned it. Its
-- identifiers (DOI, arXiv, PMID, PMCID and provider record IDs) point to it, and
-- each search result can point to the work it describes (research_search_results
-- .work_id). Identity is decided only by resolve_scholarly_works below, which
-- applies the rules in src/lib/academic/identity.ts:
--   * a different publisher DOI, PMID, PMCID or base arXiv ID is a different work
--   * the same DOI, PMID, PMCID, base arXiv ID or provider record ID is the same
--     work
--   * an arXiv ID belongs only to a work without a publisher DOI: a preprint and
--     its version of record stay separate works, even when a provider lists the
--     arXiv ID on the published record
--   * without any identifier, only an exact fingerprint (normalised title of at
--     least four words, year and first-author family name) matches
--   * if the identifiers of a record lead to more than one conflict-free existing
--     work, it is ambiguous: no work is chosen, changed or created, and the
--     search result is stored without one (work_id null)
--   * anything uncertain stays separate.
--
-- Abstracts are deliberately not stored here: provider terms for permanent
-- storage have not been verified. Abstract text stays in the 24-hour search
-- snapshot only.
--
-- Additive only: two new tables, one function, one nullable column. Existing
-- rows are not changed and code that ignores work_id keeps working. There is no
-- browser access to the tables or the function, the server (service role)
-- calls the function when it stores search results.
--
-- Rollout: apply this migration BEFORE deploying the code that uses it. Old code
-- does not use any of it.
--
-- Apply the file exactly as committed (for example from the raw file on
-- GitHub), not text copied from a rendered chat or document. The file avoids
-- constructs that some SQL tools split incorrectly (apostrophes or semicolons
-- in comments, unlabeled dollar quotes, dollar signs in string literals) and
-- verifies its own result at the end.
--
-- Rollback (after rolling back the code), one statement per line:
--   drop function if exists public.resolve_scholarly_works(jsonb)
--   alter table public.research_search_results drop column if exists work_id
--   drop table if exists public.scholarly_work_identifiers
--   drop table if exists public.scholarly_works

create table if not exists public.scholarly_works (
  id uuid primary key default gen_random_uuid(),
  identity_basis text not null check (identity_basis in ('doi', 'registry_id', 'provider_id', 'metadata_match')),
  identity_source text not null,
  identity_priority integer not null default 0,
  title text not null check (char_length(title) between 1 and 2000),
  normalized_title text not null,
  authors jsonb not null default '[]'::jsonb check (jsonb_typeof(authors) = 'array'),
  first_author_family text,
  publication_year integer check (publication_year between 1000 and 2100),
  venue text,
  publisher text,
  volume text,
  issue text,
  pages text,
  issn text[] not null default '{}',
  publication_type text,
  landing_url text,
  oa_url text,
  is_open_access boolean not null default false,
  citation_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(citation_counts) = 'object'),
  field_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(field_provenance) = 'object'),
  metadata_fingerprint text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_enriched_at timestamptz,
  record_version integer not null default 1
);

-- Works identified only by metadata are unique by fingerprint, so the same
-- unidentified work is not recorded twice.
create unique index if not exists scholarly_works_metadata_fingerprint_idx
  on public.scholarly_works (metadata_fingerprint) where identity_basis = 'metadata_match';

create table if not exists public.scholarly_work_identifiers (
  scheme text not null check (scheme in ('doi', 'arxiv', 'pmid', 'pmcid', 'openalex', 'semantic_scholar', 'core')),
  value text not null,
  work_id uuid not null references public.scholarly_works(id) on delete cascade,
  asserted_by text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Each identifier belongs to exactly one work.
  primary key (scheme, value),
  constraint scholarly_work_identifier_format check (
    (scheme = 'doi' and value ~ '^10\.[0-9]{4,9}/\S+\Z' and value = lower(value) and value not like '10.48550/arxiv.%')
    or (scheme = 'arxiv' and value ~ '^([0-9]{4}\.[0-9]{4,5}|[a-z-]+(\.[a-z]{2})?/[0-9]{7})\Z')
    or (scheme = 'pmid' and value ~ '^[1-9][0-9]{0,8}\Z')
    or (scheme = 'pmcid' and value ~ '^PMC[0-9]+\Z')
    or (scheme = 'openalex' and value ~ '^W[0-9]+\Z')
    or (scheme = 'semantic_scholar' and value ~ '^[0-9a-f]{40}\Z')
    or (scheme = 'core' and value ~ '^[1-9][0-9]{0,11}\Z')
  )
);
create index if not exists scholarly_work_identifiers_work_idx on public.scholarly_work_identifiers (work_id);
-- A work has at most one DOI, PMID, PMCID and base arXiv ID: a second value of
-- one of these is a different work, never an alias. Provider record IDs are not
-- limited: OpenAlex, Semantic Scholar and CORE can hold several records of one
-- work.
create unique index if not exists scholarly_work_identifiers_exclusive_idx
  on public.scholarly_work_identifiers (work_id, scheme) where scheme in ('doi', 'pmid', 'pmcid', 'arxiv');

alter table public.research_search_results
  add column if not exists work_id uuid references public.scholarly_works(id) on delete set null;
create index if not exists research_search_results_work_idx on public.research_search_results (work_id) where work_id is not null;

alter table public.scholarly_works enable row level security;
alter table public.scholarly_work_identifiers enable row level security;
revoke all on table public.scholarly_works from public, anon, authenticated;
revoke all on table public.scholarly_work_identifiers from public, anon, authenticated;
grant select, insert, update on table public.scholarly_works to service_role;
grant select, insert, update on table public.scholarly_work_identifiers to service_role;
grant update on table public.research_search_results to service_role;

-- Resolves a batch of provider records (built by src/lib/research-search-results
-- .ts) to canonical works and returns [{workId, outcome}] in input order.
create or replace function public.resolve_scholarly_works(p_records jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $resolve_scholarly_works$
declare
  v_record jsonb;
  v_ids jsonb;
  v_fields jsonb;
  v_keys text[];
  v_key text;
  v_results jsonb := '[]'::jsonb;
  v_work uuid;
  v_outcome text;
  v_match text;
  v_candidates uuid[];
  v_doi text;
  v_scheme text;
  v_value text;
  v_asserted text[];
  v_basis text;
  v_now timestamptz := now();
begin
  if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'p_records must be a JSON array'; end if;
  if jsonb_array_length(p_records) > 100 then raise exception 'at most 100 records per call'; end if;

  -- Resolutions that share an identifier or fingerprint are serialised. All
  -- locks are taken up front in one sorted order, so concurrent batches cannot
  -- deadlock, and two simultaneous resolutions of one DOI yield one work.
  select array_agg(k order by k) into v_keys from (
    select distinct e.key || ':' || (e.value #>> '{}') as k
      from jsonb_array_elements(p_records) r, jsonb_each(coalesce(r->'identifiers', '{}'::jsonb)) e
     where jsonb_typeof(e.value) = 'string'
    union
    select distinct 'fingerprint:' || (r->>'fingerprint') from jsonb_array_elements(p_records) r where r->>'fingerprint' is not null
  ) keys;
  if v_keys is not null then
    foreach v_key in array v_keys loop
      perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
    end loop;
  end if;

  for v_record in select value from jsonb_array_elements(p_records) loop
    v_ids := (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(coalesce(v_record->'identifiers', '{}'::jsonb))
              where key in ('doi', 'arxiv', 'pmid', 'pmcid', 'openalex', 'semantic_scholar', 'core') and jsonb_typeof(value) = 'string');
    v_fields := coalesce(v_record->'fields', '{}'::jsonb);
    v_asserted := array(select jsonb_array_elements_text(coalesce(v_record->'assertedBy', '[]'::jsonb)));
    v_doi := v_ids->>'doi';
    v_work := null; v_outcome := null; v_match := null; v_candidates := null;

    -- Ambiguity: when the identifiers of the record lead to more than one
    -- conflict-free existing work, no work is chosen, none is changed and no
    -- new work is created. The result is stored without a work (work_id null)
    -- and stays usable through its server-held result id.
    if v_doi is not null then
      select work_id into v_work from scholarly_work_identifiers where scheme = 'doi' and value = v_doi;
      if v_work is not null then
        v_outcome := 'matched'; v_match := 'doi';
      else
        -- A work without a DOI may gain this one only when its PMID, PMCID or
        -- provider record IDs lead to exactly one conflict-free work. A work
        -- that already has a (different) DOI, or a differing PMID, PMCID or
        -- arXiv ID, is provably another work and is not a candidate.
        select array_agg(distinct i.work_id) into v_candidates
          from scholarly_work_identifiers i join jsonb_each_text(v_ids) e on i.scheme = e.key and i.value = e.value
         where e.key in ('pmid', 'pmcid', 'openalex', 'semantic_scholar', 'core')
           and not exists (select 1 from scholarly_work_identifiers d where d.work_id = i.work_id and d.scheme = 'doi')
           and not exists (select 1 from scholarly_work_identifiers c join jsonb_each_text(v_ids) x on c.scheme = x.key
                            where c.work_id = i.work_id and c.scheme in ('pmid', 'pmcid', 'arxiv') and c.value <> x.value);
        if cardinality(v_candidates) = 1 then
          -- A preprint work (one with an arXiv ID) never gains a publisher DOI:
          -- the record is its version of record, a separate work.
          if not exists (select 1 from scholarly_work_identifiers c where c.work_id = v_candidates[1] and c.scheme = 'arxiv') then
            v_work := v_candidates[1]; v_outcome := 'matched'; v_match := 'identifier';
          end if;
        elsif cardinality(v_candidates) > 1 then
          v_outcome := 'ambiguous';
        end if;
      end if;
    elsif v_ids <> '{}'::jsonb then
      -- No publisher DOI: candidates by registry or provider IDs. An arXiv
      -- match never joins this record to a work that has a publisher DOI.
      select array_agg(distinct i.work_id) into v_candidates
        from scholarly_work_identifiers i join jsonb_each_text(v_ids) e on i.scheme = e.key and i.value = e.value
       where not exists (select 1 from scholarly_work_identifiers c join jsonb_each_text(v_ids) x on c.scheme = x.key
                          where c.work_id = i.work_id and c.scheme in ('pmid', 'pmcid', 'arxiv') and c.value <> x.value)
         and (e.key <> 'arxiv' or not exists (select 1 from scholarly_work_identifiers d where d.work_id = i.work_id and d.scheme = 'doi'));
      if cardinality(v_candidates) = 1 then
        v_work := v_candidates[1]; v_outcome := 'matched';
        v_match := case when v_ids ? 'pmid' or v_ids ? 'pmcid' then 'registry' else 'identifier' end;
      elsif cardinality(v_candidates) > 1 then
        v_outcome := 'ambiguous';
      end if;
    elsif v_record->>'fingerprint' is not null then
      select id into v_work from scholarly_works where identity_basis = 'metadata_match' and metadata_fingerprint = v_record->>'fingerprint';
      if v_work is not null then v_outcome := 'matched'; v_match := 'fingerprint'; end if;
    else
      v_outcome := 'unidentified';
    end if;

    -- A new work needs at least one identifier it can own, if every identifier
    -- of this record already belongs to works it conflicts with, it stays
    -- unlinked rather than becoming an identifier-less duplicate.
    if v_outcome is null and v_ids <> '{}'::jsonb and not exists (
      select 1 from jsonb_each_text(v_ids) e
       where not (e.key = 'arxiv' and v_doi is not null)
         and not exists (select 1 from scholarly_work_identifiers i where i.scheme = e.key and i.value = e.value)) then
      v_outcome := 'conflict';
    end if;

    if v_outcome is null then
      v_basis := case
        when v_doi is not null then 'doi'
        when v_ids ? 'pmid' or v_ids ? 'pmcid' or v_ids ? 'arxiv' then 'registry_id'
        when v_ids <> '{}'::jsonb then 'provider_id'
        else 'metadata_match' end;
      insert into scholarly_works (
        identity_basis, identity_source, identity_priority, title, normalized_title, authors, first_author_family,
        publication_year, venue, publisher, volume, issue, pages, issn, publication_type, landing_url, oa_url,
        is_open_access, citation_counts, field_provenance, metadata_fingerprint, first_seen_at, last_seen_at, last_enriched_at
      ) values (
        v_basis, coalesce(v_record->>'identitySource', 'unknown'), coalesce((v_record->>'identityPriority')::integer, 0),
        v_fields->>'title', v_fields->>'normalizedTitle', coalesce(v_fields->'authors', '[]'::jsonb), v_fields->>'firstAuthorFamily',
        (v_fields->>'publicationYear')::integer, v_fields->>'venue', v_fields->>'publisher', v_fields->>'volume', v_fields->>'issue',
        v_fields->>'pages', array(select jsonb_array_elements_text(coalesce(v_fields->'issn', '[]'::jsonb))), v_fields->>'publicationType',
        v_fields->>'landingUrl', v_fields->>'oaUrl', coalesce((v_fields->>'isOpenAccess')::boolean, false),
        coalesce(v_record->'citationCounts', '{}'::jsonb), coalesce(v_record->'fieldProvenance', '{}'::jsonb),
        case when v_basis = 'metadata_match' then v_record->>'fingerprint' end, v_now, v_now, v_now
      ) returning id into v_work;
      v_outcome := 'created';
    elsif v_outcome = 'matched' then
      update scholarly_works w set
        last_seen_at = v_now,
        last_enriched_at = v_now,
        citation_counts = w.citation_counts || coalesce(v_record->'citationCounts', '{}'::jsonb),
        oa_url = coalesce(w.oa_url, v_fields->>'oaUrl'),
        is_open_access = w.is_open_access or coalesce((v_fields->>'isOpenAccess')::boolean, false),
        landing_url = coalesce(w.landing_url, v_fields->>'landingUrl'),
        field_provenance = w.field_provenance
          || case when w.oa_url is null and v_fields->>'oaUrl' is not null and v_record->'fieldProvenance' ? 'oaUrl'
                  then jsonb_build_object('oaUrl', v_record->'fieldProvenance'->'oaUrl') else '{}'::jsonb end
          || case when w.landing_url is null and v_fields->>'landingUrl' is not null and v_record->'fieldProvenance' ? 'landingUrl'
                  then jsonb_build_object('landingUrl', v_record->'fieldProvenance'->'landingUrl') else '{}'::jsonb end
        , identity_basis = case when v_doi is not null then 'doi' else w.identity_basis end
      where w.id = v_work;
      -- Identity fields are replaced only by a higher-priority source that
      -- shares the DOI, PMID or PMCID of the work, the change is versioned.
      if v_match in ('doi', 'registry') then
        update scholarly_works w set
          identity_source = v_record->>'identitySource',
          identity_priority = (v_record->>'identityPriority')::integer,
          title = v_fields->>'title', normalized_title = v_fields->>'normalizedTitle',
          authors = coalesce(v_fields->'authors', '[]'::jsonb), first_author_family = v_fields->>'firstAuthorFamily',
          publication_year = (v_fields->>'publicationYear')::integer, venue = v_fields->>'venue', publisher = v_fields->>'publisher',
          volume = v_fields->>'volume', issue = v_fields->>'issue', pages = v_fields->>'pages',
          issn = array(select jsonb_array_elements_text(coalesce(v_fields->'issn', '[]'::jsonb))),
          publication_type = v_fields->>'publicationType',
          field_provenance = w.field_provenance || (
            select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(coalesce(v_record->'fieldProvenance', '{}'::jsonb))
             where key in ('title', 'authors', 'year', 'venue', 'publisher', 'volume', 'issue', 'pages', 'doi')),
          record_version = w.record_version + 1
        where w.id = v_work and coalesce((v_record->>'identityPriority')::integer, 0) > w.identity_priority;
      end if;
    end if;

    -- Attach the identifiers of the record to its work. An identifier owned by
    -- another work is left there, and an exclusive identifier is never added
    -- to a work that already has a different value of that scheme.
    if v_work is not null and v_outcome in ('created', 'matched') then
      for v_scheme, v_value in select key, value from jsonb_each_text(v_ids) loop
        -- arXiv IDs stay with the preprint work, never a work with a DOI.
        if v_scheme = 'arxiv' and (v_doi is not null or exists (
          select 1 from scholarly_work_identifiers where work_id = v_work and scheme = 'doi')) then
          continue;
        end if;
        if v_scheme in ('doi', 'pmid', 'pmcid', 'arxiv') and exists (
          select 1 from scholarly_work_identifiers where work_id = v_work and scheme = v_scheme and value <> v_value) then
          continue;
        end if;
        insert into scholarly_work_identifiers (scheme, value, work_id, asserted_by, first_seen_at, last_seen_at)
        values (v_scheme, v_value, v_work, v_asserted, v_now, v_now)
        on conflict (scheme, value) do nothing;
        update scholarly_work_identifiers
           set last_seen_at = v_now,
               asserted_by = array(select distinct unnest(asserted_by || v_asserted) order by 1)
         where scheme = v_scheme and value = v_value and work_id = v_work;
      end loop;
    end if;

    -- Diagnostics for unresolved records: candidate work ids and the
    -- identifier schemes involved (no titles, queries or users).
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'workId', v_work, 'outcome', v_outcome, 'match', v_match,
      'candidateWorkIds', case when v_outcome = 'ambiguous' then to_jsonb(v_candidates) else '[]'::jsonb end,
      'identifierSchemes', (select coalesce(jsonb_agg(key order by key), '[]'::jsonb) from jsonb_object_keys(v_ids) key)));
  end loop;
  return v_results;
end;
$resolve_scholarly_works$;

-- Privileges on the resolver are applied to the function object found by
-- to_regprocedure, and the migration aborts (rolling everything back) if the
-- function does not exist at this point, for example because the statement
-- above did not reach the database intact.
do $privileges$
declare
  v_resolver regprocedure := to_regprocedure('public.resolve_scholarly_works(jsonb)');
begin
  if v_resolver is null then
    raise exception 'Slice 2A migration incomplete: public.resolve_scholarly_works(jsonb) was not created. Apply the migration file exactly as committed.';
  end if;
  execute format('revoke all on function %s from public, anon, authenticated', v_resolver);
  execute format('grant execute on function %s to service_role', v_resolver);
end
$privileges$;

-- Final self-check: every object of this migration exists with the intended
-- access, or the whole migration is rolled back.
do $verify$
declare
  v_resolver regprocedure := to_regprocedure('public.resolve_scholarly_works(jsonb)');
begin
  if to_regclass('public.scholarly_works') is null or to_regclass('public.scholarly_work_identifiers') is null then
    raise exception 'Slice 2A verification failed: canonical tables are missing';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'research_search_results' and column_name = 'work_id') then
    raise exception 'Slice 2A verification failed: research_search_results.work_id is missing';
  end if;
  if v_resolver is null or (select prorettype from pg_proc where oid = v_resolver) <> 'jsonb'::regtype then
    raise exception 'Slice 2A verification failed: public.resolve_scholarly_works(jsonb) returning jsonb is missing';
  end if;
  if has_function_privilege('anon', v_resolver, 'execute') or has_function_privilege('authenticated', v_resolver, 'execute')
     or not has_function_privilege('service_role', v_resolver, 'execute') then
    raise exception 'Slice 2A verification failed: resolver privileges are not service-role only';
  end if;
  if exists (select 1 from aclexplode((select proacl from pg_proc where oid = v_resolver)) a where a.grantee = 0) then
    raise exception 'Slice 2A verification failed: PUBLIC can execute the resolver';
  end if;
  if has_table_privilege('anon', 'public.scholarly_works', 'select') or has_table_privilege('authenticated', 'public.scholarly_works', 'select')
     or has_table_privilege('anon', 'public.scholarly_work_identifiers', 'select') or has_table_privilege('authenticated', 'public.scholarly_work_identifiers', 'select') then
    raise exception 'Slice 2A verification failed: browser roles can read canonical tables';
  end if;
end
$verify$;
