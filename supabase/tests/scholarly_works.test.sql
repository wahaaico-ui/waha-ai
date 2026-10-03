-- Local database tests for migration 20261005000000 (Slice 2A).
--
-- Run with psql against a disposable local Postgres that has the Supabase
-- roles (anon, authenticated, service_role) and the repository migrations
-- applied. Never run it against production. Every check raises an exception
-- on failure, so psql exits non-zero.
\set ON_ERROR_STOP on
-- Everything runs in one transaction that is rolled back, so the script leaves
-- no rows behind and can be re-run.
begin;
set local role service_role;

create temporary table t_results (label text primary key, work_id uuid, outcome text) on commit drop;

create or replace function pg_temp.resolve(p_label text, p_record jsonb) returns uuid language plpgsql as $$
declare v jsonb;
begin
  v := public.resolve_scholarly_works(jsonb_build_array(p_record))->0;
  insert into t_results values (p_label, (v->>'workId')::uuid, v->>'outcome');
  return (v->>'workId')::uuid;
end $$;

create or replace function pg_temp.rec(p_ids jsonb, p_title text default 'Generative artificial intelligence in postgraduate learning',
  p_source text default 'openalex', p_priority integer default 50, p_fingerprint text default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'identifiers', p_ids, 'assertedBy', jsonb_build_array(p_source), 'fingerprint', p_fingerprint,
    'identitySource', p_source, 'identityPriority', p_priority,
    'fields', jsonb_build_object('title', p_title, 'normalizedTitle', lower(p_title), 'authors', '["Alice Smith"]'::jsonb,
      'firstAuthorFamily', 'smith', 'publicationYear', 2024, 'isOpenAccess', false),
    'citationCounts', jsonb_build_object(p_source, jsonb_build_object('value', 3, 'observedAt', '2026-10-05T00:00:00Z')),
    'fieldProvenance', jsonb_build_object('title', jsonb_build_object('source', p_source)))
$$;

create or replace function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_label; end if;
  raise notice 'PASS %', p_label;
end $$;

-- DOI
select pg_temp.resolve('doi-a', pg_temp.rec('{"doi":"10.1000/abc","openalex":"W1"}'));
select pg_temp.resolve('doi-a-again', pg_temp.rec('{"doi":"10.1000/abc","semantic_scholar":"0123456789abcdef0123456789abcdef01234567"}', 'Different wording', 'semantic-scholar', 40));
select pg_temp.check((select work_id from t_results where label = 'doi-a') = (select work_id from t_results where label = 'doi-a-again'), 'same DOI resolves to one work');
select pg_temp.check((select count(*) from scholarly_work_identifiers where work_id = (select work_id from t_results where label = 'doi-a')) = 3, 'DOI, OpenAlex and S2 IDs all point to that work');
select pg_temp.resolve('doi-b', pg_temp.rec('{"doi":"10.1000/other","openalex":"W1"}'));
select pg_temp.check((select work_id from t_results where label = 'doi-b') <> (select work_id from t_results where label = 'doi-a'), 'a different DOI is a different work even with a shared OpenAlex ID');
select pg_temp.check((select work_id from scholarly_work_identifiers where scheme = 'openalex' and value = 'W1') = (select work_id from t_results where label = 'doi-a'), 'the shared OpenAlex ID stays with its first work');

-- Identity fields change only for a higher-priority source sharing the DOI
select pg_temp.resolve('doi-a-crossref', pg_temp.rec('{"doi":"10.1000/abc"}', 'Registry title', 'crossref', 70));
select pg_temp.check((select title = 'Registry title' and identity_source = 'crossref' and record_version = 2 from scholarly_works where id = (select work_id from t_results where label = 'doi-a')), 'higher-priority registry record replaces identity fields and versions the change');
select pg_temp.resolve('doi-a-lower', pg_temp.rec('{"doi":"10.1000/abc"}', 'Lower priority title', 'core', 10));
select pg_temp.check((select title = 'Registry title' from scholarly_works where id = (select work_id from t_results where label = 'doi-a')), 'a lower-priority source does not replace identity fields');
select pg_temp.check((select citation_counts ?& array['openalex', 'semantic-scholar', 'crossref', 'core'] from scholarly_works where id = (select work_id from t_results where label = 'doi-a')), 'citation counts are kept per source');

-- PMID
select pg_temp.resolve('pmid-a', pg_temp.rec('{"pmid":"38012345"}', 'PubMed article', 'pubmed', 60));
select pg_temp.resolve('pmid-a-again', pg_temp.rec('{"pmid":"38012345","core":"77"}', 'Same article worded differently', 'core', 10));
select pg_temp.check((select work_id from t_results where label = 'pmid-a') = (select work_id from t_results where label = 'pmid-a-again'), 'same PMID resolves to one work');
select pg_temp.resolve('pmid-conflict', pg_temp.rec('{"pmid":"38012346","core":"77"}'));
select pg_temp.check((select work_id from t_results where label = 'pmid-conflict') <> (select work_id from t_results where label = 'pmid-a'), 'a conflicting PMID is a different work even with a shared CORE ID');
select pg_temp.resolve('pmid-gains-doi', pg_temp.rec('{"doi":"10.1000/pubmed-article","pmid":"38012345"}', 'PubMed article', 'europe-pmc', 60));
select pg_temp.check((select work_id from t_results where label = 'pmid-gains-doi') = (select work_id from t_results where label = 'pmid-a'), 'a work found by PMID gains its DOI when nothing conflicts');
select pg_temp.check((select identity_basis = 'doi' from scholarly_works where id = (select work_id from t_results where label = 'pmid-a')), 'its identity basis becomes doi');

-- arXiv: base ID across versions, conflicts, and preprint vs version of record
select pg_temp.resolve('arxiv-v1', pg_temp.rec('{"arxiv":"2401.12345"}', 'Preprint', 'arxiv', 30));
select pg_temp.resolve('arxiv-v2', pg_temp.rec('{"arxiv":"2401.12345","openalex":"W9"}', 'Preprint v2', 'openalex', 50));
select pg_temp.check((select work_id from t_results where label = 'arxiv-v1') = (select work_id from t_results where label = 'arxiv-v2'), 'same base arXiv ID resolves to one work');
select pg_temp.resolve('arxiv-other', pg_temp.rec('{"arxiv":"2401.54321","openalex":"W9"}'));
select pg_temp.check((select work_id from t_results where label = 'arxiv-other') <> (select work_id from t_results where label = 'arxiv-v1'), 'a conflicting arXiv ID is a different work even with a shared OpenAlex ID');
select pg_temp.resolve('published', pg_temp.rec('{"doi":"10.1000/published","arxiv":"2401.12345"}', 'Published version', 'semantic-scholar', 40));
select pg_temp.check((select work_id from t_results where label = 'published') <> (select work_id from t_results where label = 'arxiv-v1'), 'a published record listing the arXiv ID stays separate from the preprint');
select pg_temp.check(not exists (select 1 from scholarly_work_identifiers where work_id = (select work_id from t_results where label = 'published') and scheme = 'arxiv'), 'the arXiv ID is not attached to the published work');
select pg_temp.check(not exists (select 1 from scholarly_work_identifiers where work_id = (select work_id from t_results where label = 'arxiv-v1') and scheme = 'doi'), 'the preprint work never gains a publisher DOI');
select pg_temp.resolve('preprint-via-openalex', pg_temp.rec('{"doi":"10.1000/published-2","openalex":"W9"}'));
select pg_temp.check((select work_id from t_results where label = 'preprint-via-openalex') <> (select work_id from t_results where label = 'arxiv-v1'), 'a DOI record is not joined to a preprint work through a shared provider ID');

-- Metadata-only records
select pg_temp.resolve('meta-a', pg_temp.rec('{}', p_fingerprint => 'some title of four words|2024|smith'));
select pg_temp.resolve('meta-a-again', pg_temp.rec('{}', p_fingerprint => 'some title of four words|2024|smith'));
select pg_temp.check((select work_id from t_results where label = 'meta-a') = (select work_id from t_results where label = 'meta-a-again'), 'an identical fingerprint resolves to one metadata-only work');
select pg_temp.resolve('meta-b', pg_temp.rec('{}', p_fingerprint => 'some title of four words|2025|smith'));
select pg_temp.check((select work_id from t_results where label = 'meta-b') <> (select work_id from t_results where label = 'meta-a'), 'a different fingerprint is a different work');
select pg_temp.resolve('unidentified', pg_temp.rec('{}'));
select pg_temp.check((select work_id is null and outcome = 'unidentified' from t_results where label = 'unidentified'), 'a record without identifiers or fingerprint is not linked');

-- Ambiguity: identifiers that lead to more than one conflict-free work
select pg_temp.resolve('amb-w1', pg_temp.rec('{"pmid":"11111111"}', 'Ambiguity work one', 'pubmed', 60));
select pg_temp.resolve('amb-w2', pg_temp.rec('{"openalex":"W5000"}', 'Ambiguity work two'));
create temporary table t_snapshot on commit drop as
  select 'work' as kind, to_jsonb(w) as row from scholarly_works w where w.id in (select work_id from t_results where label in ('amb-w1', 'amb-w2'))
  union all
  select 'identifier', to_jsonb(i) from scholarly_work_identifiers i where i.work_id in (select work_id from t_results where label in ('amb-w1', 'amb-w2'));
create temporary table t_counts on commit drop as
  select (select count(*) from scholarly_works) as works, (select count(*) from scholarly_work_identifiers) as identifiers;

select pg_temp.resolve('amb-1', pg_temp.rec('{"pmid":"11111111","openalex":"W5000","core":"5001"}'));
select pg_temp.check((select work_id is null and outcome = 'ambiguous' from t_results where label = 'amb-1'), 'identifiers pointing to two existing works resolve to no work');
select pg_temp.check((select public.resolve_scholarly_works(jsonb_build_array(pg_temp.rec('{"pmid":"11111111","openalex":"W5000"}')))->0->'candidateWorkIds' @> to_jsonb(array[(select work_id from t_results where label = 'amb-w1'), (select work_id from t_results where label = 'amb-w2')])), 'the ambiguous outcome reports both candidate works for investigation');
select pg_temp.resolve('amb-doi', pg_temp.rec('{"doi":"10.1000/ambiguous-new","pmid":"11111111","openalex":"W5000"}'));
select pg_temp.check((select work_id is null and outcome = 'ambiguous' from t_results where label = 'amb-doi'), 'a new DOI whose other identifiers point to two works is also ambiguous');
select pg_temp.resolve('amb-repeat', pg_temp.rec('{"pmid":"11111111","openalex":"W5000","core":"5001"}'));
select pg_temp.check((select work_id is null and outcome = 'ambiguous' from t_results where label = 'amb-repeat'), 'repeating the ambiguous resolution gives the same result');
select pg_temp.check(not exists (
    (select kind, row from t_snapshot)
    except
    (select 'work', to_jsonb(w) from scholarly_works w where w.id in (select work_id from t_results where label in ('amb-w1', 'amb-w2'))
     union all
     select 'identifier', to_jsonb(i) from scholarly_work_identifiers i where i.work_id in (select work_id from t_results where label in ('amb-w1', 'amb-w2')))),
  'neither existing work nor its identifiers was modified');
select pg_temp.check((select works = (select count(*) from scholarly_works) and identifiers = (select count(*) from scholarly_work_identifiers) from t_counts), 'no third work and no new identifier was created');
select pg_temp.check(not exists (select 1 from scholarly_work_identifiers where (scheme, value) in (('core', '5001'), ('doi', '10.1000/ambiguous-new'))), 'the ambiguous record attached no identifier anywhere');

-- Not ambiguous: all identifiers lead to one work, or every other candidate provably conflicts
select pg_temp.resolve('amb-w1-openalex', pg_temp.rec('{"pmid":"11111111","openalex":"W5100"}'));
select pg_temp.check((select work_id from t_results where label = 'amb-w1-openalex') = (select work_id from t_results where label = 'amb-w1'), 'a record whose identifiers lead to one work resolves to it');
select pg_temp.resolve('consistent', pg_temp.rec('{"pmid":"11111111","openalex":"W5100","core":"5200"}'));
select pg_temp.check((select work_id from t_results where label = 'consistent') = (select work_id from t_results where label = 'amb-w1') and (select outcome from t_results where label = 'consistent') = 'matched', 'several identifiers that all point to one work resolve normally');
select pg_temp.check((select work_id from scholarly_work_identifiers where scheme = 'core' and value = '5200') = (select work_id from t_results where label = 'amb-w1'), 'and its new identifier is attached to that work');
select pg_temp.resolve('amb-w3', pg_temp.rec('{"pmid":"22222222","openalex":"W5300"}', 'A third work'));
select pg_temp.resolve('conflict-free-one', pg_temp.rec('{"pmid":"11111111","openalex":"W5300"}'));
select pg_temp.check((select work_id from t_results where label = 'conflict-free-one') = (select work_id from t_results where label = 'amb-w1'), 'a candidate with a conflicting PMID is not ambiguity: the one conflict-free work is chosen');

-- Constraints
do $$ begin
  begin
    insert into scholarly_work_identifiers (scheme, value, work_id) values ('doi', 'Generative artificial intelligence', (select work_id from t_results where label = 'doi-a'));
    raise exception 'FAILED: a title was accepted as an identifier';
  exception when check_violation then raise notice 'PASS a title is rejected as an identifier value';
  end;
  begin
    insert into scholarly_work_identifiers (scheme, value, work_id) values ('doi', '10.1000/second-doi', (select work_id from t_results where label = 'doi-a'));
    raise exception 'FAILED: a second DOI was attached to one work';
  exception when unique_violation then raise notice 'PASS a work cannot hold two DOIs';
  end;
  begin
    insert into scholarly_work_identifiers (scheme, value, work_id) values ('doi', '10.48550/arxiv.2401.12345', (select work_id from t_results where label = 'doi-b'));
    raise exception 'FAILED: an arXiv DOI was stored as a publisher DOI';
  exception when check_violation then raise notice 'PASS an arXiv DOI is not stored as a publisher DOI';
  end;
  insert into scholarly_work_identifiers (scheme, value, work_id) values ('openalex', 'W123456', (select work_id from t_results where label = 'doi-a'));
  raise notice 'PASS a work can hold more than one OpenAlex record ID';
end $$;

-- Abstracts are not stored
select pg_temp.check(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scholarly_works' and column_name like '%abstract%'), 'scholarly_works has no abstract column');

reset role;

-- Browser roles cannot read, write or resolve
do $$
declare v_denied int := 0; v_role text; v_statement text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_statement in array array[
      'select count(*) from public.scholarly_works',
      'select count(*) from public.scholarly_work_identifiers',
      $q$insert into public.scholarly_works (identity_basis, identity_source, title, normalized_title) values ('doi', 'browser', 'Forged', 'forged')$q$,
      $q$update public.scholarly_work_identifiers set work_id = work_id$q$,
      $q$select public.resolve_scholarly_works('[]'::jsonb)$q$
    ] loop
      begin
        execute format('set local role %I', v_role);
        execute v_statement;
        raise exception 'FAILED: % could run: %', v_role, v_statement;
      exception when insufficient_privilege then
        v_denied := v_denied + 1;
      end;
    end loop;
  end loop;
  raise notice 'PASS browser roles denied % of 10 canonical-table operations', v_denied;
  if v_denied <> 10 then raise exception 'FAILED: browser roles were not denied every operation'; end if;
end $$;

select 'ALL SCHOLARLY WORKS CHECKS PASSED' as result;
rollback;
