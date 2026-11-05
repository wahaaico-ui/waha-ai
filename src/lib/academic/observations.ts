// Enrichment observations (Slice 3): what each source reported about a
// canonical work, kept as separate append-only rows (migration 20261007000000).
//
// Identity, metadata, registry assertions, access and metrics are separate
// facets, and each row says whether the source reported a value, had no value,
// had no record, or failed. Nothing here produces a "verified" verdict: the
// summary only shows which sources agree or disagree.
import type { AcademicPaper } from './integrations/types';
import { providerObservationsOf } from './integrations/normalization';
import { identityYear, normaliseDoi } from './identity';

export type ObservationFacet = 'metadata' | 'registry_assertion' | 'access' | 'metric';
export type ObservationStatus = 'reported' | 'not_reported' | 'not_found' | 'error';

export type ObservationRow = {
  work_id: string;
  facet: ObservationFacet;
  field: string;
  source: string;
  status: ObservationStatus;
  value: unknown;
  error_code: string | null;
  provenance: Record<string, unknown>;
  search_run_id: string | null;
  observed_at: string;
};

const ENRICHMENT_FIELDS = { unpaywall: { facet: 'access', field: 'oa_url' }, opencitations: { facet: 'metric', field: 'citation_count' } } as const;

function present(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

/** Observation rows for one search record resolved to a canonical work. */
export function observationRowsFrom(workId: string, paper: AcademicPaper, observedAt: string, searchRunId: string | null): ObservationRow[] {
  const rows: ObservationRow[] = [];
  const add = (facet: ObservationFacet, field: string, source: string, value: unknown, method: 'provider_record' | 'enrichment', status?: ObservationStatus, errorCode?: string) => {
    const reported = status ? status === 'reported' : present(value);
    rows.push({
      work_id: workId, facet, field, source,
      status: status || (reported ? 'reported' : 'not_reported'),
      value: reported ? value : null,
      error_code: status === 'error' ? (errorCode || 'request_failed').slice(0, 200) : null,
      provenance: { method, identitySource: paper.source },
      search_run_id: searchRunId,
      observed_at: observedAt,
    });
  };

  const outcomes = paper.enrichmentOutcomes || {};
  for (const [source, observation] of Object.entries(providerObservationsOf(paper))) {
    if (!observation) continue;
    if (source in ENRICHMENT_FIELDS) continue;
    add('metadata', 'title', source, observation.title?.trim() || null, 'provider_record');
    add('metadata', 'year', source, identityYear(observation.year), 'provider_record');
    add('metadata', 'venue', source, observation.venue?.trim() || null, 'provider_record');
    add('registry_assertion', 'doi', source, normaliseDoi(observation.doi), 'provider_record');
    add('metric', 'citation_count', source, typeof observation.citationCount === 'number' && observation.citationCount >= 0 ? observation.citationCount : null, 'provider_record');
    if (observation.oaUrl) add('access', 'oa_url', source, observation.oaUrl, 'provider_record');
    // Only a positive open-access statement is recorded; a missing link is unknown.
    if (observation.isOpenAccess === true) add('access', 'is_open_access', source, true, 'provider_record');
  }
  for (const [source, target] of Object.entries(ENRICHMENT_FIELDS) as Array<[keyof typeof ENRICHMENT_FIELDS, (typeof ENRICHMENT_FIELDS)[keyof typeof ENRICHMENT_FIELDS]]>) {
    const outcome = outcomes[source];
    if (!outcome) continue;
    const observed = paper.providerObservations?.[source];
    const value = source === 'unpaywall' ? observed?.oaUrl : observed?.citationCount;
    const status: ObservationStatus = outcome.status === 'reported' && present(value) ? 'reported' : outcome.status === 'error' ? 'error' : 'not_reported';
    add(target.facet, target.field, source, status === 'reported' ? value : null, 'enrichment', status, outcome.errorCode);
  }
  return rows;
}

export type FieldSummary = {
  facet: ObservationFacet;
  field: string;
  /** Latest observation per source. */
  sources: Array<{ source: string; status: ObservationStatus; value: unknown; observedAt: string; errorCode: string | null }>;
  /** Comparison of reported values only; unknown and failed sources are not counted as agreement or disagreement. */
  agreement: 'no_reports' | 'single_source' | 'agree' | 'disagree' | 'not_compared';
};

function comparable(field: string, value: unknown) {
  if (typeof value === 'string') return field === 'title' || field === 'venue' ? value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() : value.trim().toLowerCase();
  return JSON.stringify(value);
}

/** Per-field summary of observations: every source's latest value, and whether reported values agree. */
export function summarizeObservations(rows: Array<Pick<ObservationRow, 'facet' | 'field' | 'source' | 'status' | 'value' | 'observed_at' | 'error_code'>>): FieldSummary[] {
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.facet}|${row.field}|${row.source}`;
    const current = latest.get(key);
    if (!current || row.observed_at > current.observed_at) latest.set(key, row);
  }
  const fields = new Map<string, FieldSummary>();
  for (const row of latest.values()) {
    const key = `${row.facet}|${row.field}`;
    const summary = fields.get(key) || { facet: row.facet, field: row.field, sources: [], agreement: 'no_reports' as const };
    summary.sources.push({ source: row.source, status: row.status, value: row.value, observedAt: row.observed_at, errorCode: row.error_code });
    fields.set(key, summary);
  }
  for (const summary of fields.values()) {
    summary.sources.sort((a, b) => a.source.localeCompare(b.source));
    const reported = summary.sources.filter((entry) => entry.status === 'reported');
    // Metrics differ by design (each source counts differently), so they are
    // listed per source and not compared.
    if (!reported.length) summary.agreement = 'no_reports';
    else if (reported.length === 1) summary.agreement = 'single_source';
    else if (summary.facet === 'metric') summary.agreement = 'not_compared';
    else summary.agreement = new Set(reported.map((entry) => comparable(summary.field, entry.value))).size === 1 ? 'agree' : 'disagree';
  }
  return [...fields.values()].sort((a, b) => `${a.facet}${a.field}`.localeCompare(`${b.facet}${b.field}`));
}
