// Slice 3: enrichment observations keep each source's value with its
// provenance, preserve disagreement, and never turn an unknown or a failed
// request into a negative finding.
import { observationRowsFrom, summarizeObservations } from '@/lib/academic/observations';
import { deduplicatePapers } from '@/lib/academic/integrations/normalization';
import type { AcademicPaper } from '@/lib/academic/integrations/types';

const observedAt = '2026-10-06T00:00:00.000Z';

function paper(overrides: Partial<AcademicPaper> = {}): AcademicPaper {
  return {
    id: 'record', title: 'Generative artificial intelligence in postgraduate learning', abstract: '', year: 2024, citationCount: 3,
    authors: ['Alice Smith'], doi: '10.1000/x', pdfUrl: null, url: null, source: 'openalex', sources: ['openalex'], subjects: [], publicationType: 'article', openAccess: false,
    ...overrides,
  };
}

test('each observation keeps its source, method and identity source', () => {
  const rows = observationRowsFrom('work-1', paper(), observedAt, 'run-1');
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row).toEqual(expect.objectContaining({ work_id: 'work-1', source: 'openalex', search_run_id: 'run-1', observed_at: observedAt, provenance: { method: 'provider_record', identitySource: 'openalex' } }));
  }
});

test('provider disagreement is preserved as separate observations, not overwritten', () => {
  const merged = deduplicatePapers([
    paper({ source: 'crossref', sources: ['crossref'], title: 'Generative AI in postgraduate learning', year: 2023, citationCount: 9 }),
    paper({ source: 'openalex', sources: ['openalex'], year: 2024, citationCount: 12 }),
  ])[0];
  const rows = observationRowsFrom('work-1', merged, observedAt, null);
  const titles = rows.filter((row) => row.field === 'title').map((row) => [row.source, row.value]);
  expect(titles).toEqual(expect.arrayContaining([['crossref', 'Generative AI in postgraduate learning'], ['openalex', 'Generative artificial intelligence in postgraduate learning']]));
  const summary = summarizeObservations(rows);
  expect(summary.find((field) => field.field === 'title')?.agreement).toBe('disagree');
  expect(summary.find((field) => field.field === 'year')?.agreement).toBe('disagree');
  expect(summary.find((field) => field.field === 'doi')?.agreement).toBe('agree');
  const counts = summary.find((field) => field.field === 'citation_count');
  expect(counts?.agreement).toBe('not_compared');
  expect(counts?.sources.map((entry) => [entry.source, entry.value])).toEqual([['crossref', 9], ['openalex', 12]]);
});

test('unknown and failed enrichment are distinguishable from a reported value', () => {
  const rows = observationRowsFrom('work-1', paper({
    providerObservations: { openalex: { title: 'T', citationCount: 3 }, opencitations: { citationCount: 0 } },
    enrichmentOutcomes: { unpaywall: { status: 'error', errorCode: 'timeout' }, opencitations: { status: 'reported' } },
  }), observedAt, null);
  expect(rows.find((row) => row.source === 'unpaywall')).toEqual(expect.objectContaining({ field: 'oa_url', status: 'error', value: null, error_code: 'timeout' }));
  // A reported zero is a value; it is not the same as unknown.
  expect(rows.find((row) => row.source === 'opencitations')).toEqual(expect.objectContaining({ status: 'reported', value: 0 }));
  const unknown = observationRowsFrom('work-1', paper({ enrichmentOutcomes: { unpaywall: { status: 'not_reported' } } }), observedAt, null);
  expect(unknown.find((row) => row.source === 'unpaywall')).toEqual(expect.objectContaining({ status: 'not_reported', value: null, error_code: null }));
});

test('a missing open-access link is unknown, never a closed-access finding', () => {
  const rows = observationRowsFrom('work-1', paper({ openAccess: false, pdfUrl: null }), observedAt, null);
  expect(rows.some((row) => row.field === 'is_open_access')).toBe(false);
  expect(rows.some((row) => row.value === false)).toBe(false);
});

test('errors and unknowns do not count as agreement or disagreement', () => {
  const summary = summarizeObservations([
    { facet: 'access', field: 'oa_url', source: 'openalex', status: 'reported', value: 'https://oa.example/x.pdf', observed_at: observedAt, error_code: null },
    { facet: 'access', field: 'oa_url', source: 'unpaywall', status: 'error', value: null, observed_at: observedAt, error_code: 'timeout' },
  ]);
  expect(summary[0].agreement).toBe('single_source');
  expect(summary[0].sources.map((entry) => entry.status)).toEqual(['reported', 'error']);
});

test('the latest observation per source is summarized, and no field or summary says verified', () => {
  const summary = summarizeObservations([
    { facet: 'metric', field: 'citation_count', source: 'openalex', status: 'reported', value: 3, observed_at: '2026-10-01T00:00:00.000Z', error_code: null },
    { facet: 'metric', field: 'citation_count', source: 'openalex', status: 'reported', value: 5, observed_at: '2026-10-05T00:00:00.000Z', error_code: null },
  ]);
  expect(summary[0].sources).toEqual([expect.objectContaining({ value: 5 })]);
  expect(JSON.stringify(summary)).not.toMatch(/verified/i);
});

test('abstracts are never observed', () => {
  const rows = observationRowsFrom('work-1', paper({ abstract: 'Provider abstract text' }), observedAt, null);
  expect(JSON.stringify(rows)).not.toContain('Provider abstract text');
});
