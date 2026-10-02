import { randomUUID } from 'node:crypto';
import type { AcademicPaper } from '@/lib/academic/integrations/types';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import type { CitationItem } from '@/lib/citations/types';
import { createServiceClient } from '@/lib/supabase/service';
import { sanitizeLiteraturePapers } from '@/lib/research-trust';

// Server-held search results (Slice 1).
//
// Discovered paper metadata originates on the server: each search stores its
// results in research_search_results and the browser receives only their ids
// (plus display copies). Saving or citing a discovered result sends the id; the
// server rehydrates the metadata from this store, scoped to the same user and
// project and not expired. The browser may choose a server-known discovered
// source but may not define one.
//
// Discovery is not verification: a provider returning a record says nothing
// about its correctness, so rehydrated items stay unverified.

export const SERVER_DISCOVERED_METADATA = 'server_discovered';
export const USER_ASSERTED_METADATA = 'user_asserted';
export const DISCOVERY_PROVIDER = 'waha_discovery';
export const USER_ASSERTED_PROVIDER = 'user_asserted';

export type SearchContext = 'literature' | 'evidence_panel';

/** The metadata the server stores for one discovered result. */
export type DiscoveredPaper = {
  id: string;
  doi: string | null;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  url: string | null;
  pdfUrl: string | null;
  abstract: string;
  citationCount: number;
  publicationType: string | null;
  providers: string[];
};

export type ResolvedSearchResult = {
  resultId: string;
  searchRunId: string;
  query: string;
  retrievedAt: string;
  paper: DiscoveredPaper;
};

type ResultRow = { id: string; search_run_id: string; query: string; created_at: string; metadata: DiscoveredPaper };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isResultId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function discoveredPaperFrom(paper: AcademicPaper): DiscoveredPaper {
  const doi = normaliseDoi(paper.doi);
  return {
    id: String(doi || paper.pmid || paper.arxivId || paper.id).slice(0, 500),
    doi,
    title: paper.title.slice(0, 500),
    authors: paper.authors.slice(0, 100).map((author) => author.slice(0, 300)),
    year: paper.year || null,
    journal: paper.journal || paper.containerTitle || null,
    publisher: paper.publisher || null,
    volume: paper.volume || null,
    issue: paper.issue || null,
    pages: paper.pages || null,
    url: paper.url || null,
    pdfUrl: paper.pdfUrl || null,
    abstract: paper.abstract.slice(0, 4_000),
    citationCount: paper.citationCount,
    publicationType: paper.publicationType || null,
    providers: [...new Set(paper.sources)],
  };
}

/** Stores one search's results and returns their server-issued ids, in order. */
export async function storeSearchResults(input: { userId: string; projectId: string; context: SearchContext; query: string; papers: AcademicPaper[] }) {
  const service = createServiceClient();
  const now = new Date().toISOString();
  // Expired results are no longer selectable; remove this user's old ones.
  await service.from('research_search_results').delete().eq('user_id', input.userId).lt('expires_at', now);
  if (!input.papers.length) return [] as string[];
  const searchRunId = randomUUID();
  const rows = input.papers.map((paper, position) => ({
    search_run_id: searchRunId,
    user_id: input.userId,
    project_id: input.projectId,
    context: input.context,
    query: input.query.slice(0, 1_000),
    position,
    metadata: discoveredPaperFrom(paper),
  }));
  const { data, error } = await service.from('research_search_results').insert(rows).select('id, position');
  if (error || !data || data.length !== rows.length) throw new Error('SEARCH_RESULTS_NOT_STORED');
  const ids = new Array<string>(rows.length);
  for (const row of data as Array<{ id: string; position: number }>) ids[row.position] = row.id;
  return ids;
}

/**
 * Resolves result ids for the given user and project. Ids that are malformed,
 * unknown, expired or scoped to another user or project are returned as missing.
 */
export async function resolveSearchResults(input: { userId: string; projectId: string; resultIds: string[] }) {
  const requested = [...new Set(input.resultIds)];
  const wellFormed = requested.filter(isResultId);
  let rows: ResultRow[] = [];
  if (wellFormed.length) {
    const { data, error } = await createServiceClient()
      .from('research_search_results')
      .select('id, search_run_id, query, created_at, metadata')
      .in('id', wellFormed)
      .eq('user_id', input.userId)
      .eq('project_id', input.projectId)
      .gt('expires_at', new Date().toISOString());
    if (error) throw new Error('SEARCH_RESULTS_UNAVAILABLE');
    rows = (data || []) as ResultRow[];
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const resolved: ResolvedSearchResult[] = [];
  const missing: string[] = [];
  for (const id of requested) {
    const row = byId.get(id);
    if (!row) missing.push(id);
    else resolved.push({ resultId: row.id, searchRunId: row.search_run_id, query: row.query, retrievedAt: row.created_at, paper: row.metadata });
  }
  return { resolved, missing };
}

export function citationItemFromDiscovered(paper: DiscoveredPaper): CitationItem {
  return {
    id: paper.doi || paper.id,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    journal: paper.journal,
    publisher: paper.publisher,
    volume: paper.volume,
    issue: paper.issue,
    pages: paper.pages,
    doi: paper.doi,
    url: paper.url || paper.pdfUrl,
    type: paper.publicationType || 'article',
    verificationStatus: 'unverified',
    confidenceScore: 0,
    provenance: paper.providers,
  };
}

/** The journey:literature entry for a rehydrated result. */
export function literaturePaperFromResult(result: ResolvedSearchResult) {
  const { paper } = result;
  return {
    id: paper.id,
    doi: paper.doi,
    title: paper.title,
    authors: paper.authors.join('، ') || 'بيانات المؤلفين غير متاحة',
    year: paper.year || 'د.ت',
    citationCount: paper.citationCount,
    abstract: paper.abstract,
    pdfUrl: paper.pdfUrl || paper.url,
    item: citationItemFromDiscovered(paper),
    metadataOrigin: SERVER_DISCOVERED_METADATA,
    discovery: { resultId: result.resultId, searchRunId: result.searchRunId, providers: paper.providers, retrievedAt: result.retrievedAt },
  };
}

export type LiteratureSelection =
  | { ok: true; content: Record<string, unknown> }
  | { ok: false; status: 409 | 422; code: string; error: string };

function idList(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100 || value.some((id) => typeof id !== 'string' || !id.trim() || id.length > 500)) return null;
  return [...new Set(value as string[])];
}

/**
 * Builds journey:literature from ids only: `resultIds` are server-held search
 * results; `keepPaperIds` are papers already saved in this project's literature
 * stage. Paper objects sent by the browser are never stored.
 */
export async function buildLiteratureSelection(input: { content: Record<string, unknown>; savedLiterature: Record<string, unknown> | undefined; userId: string; projectId: string }): Promise<LiteratureSelection> {
  const resultIds = idList(input.content.resultIds);
  const keepPaperIds = idList(input.content.keepPaperIds);
  if (!resultIds || !keepPaperIds) return { ok: false, status: 422, code: 'invalid_selection', error: 'قائمة الدراسات المختارة غير صالحة.' };
  if (!resultIds.length && !keepPaperIds.length && input.content.papers !== undefined) {
    return { ok: false, status: 409, code: 'literature_selection_by_id_required', error: 'تغيّرت طريقة حفظ الأدبيات. حدّث الصفحة وأعد البحث ثم اختر الدراسات.' };
  }

  const { resolved, missing } = await resolveSearchResults({ userId: input.userId, projectId: input.projectId, resultIds });
  if (missing.length) return { ok: false, status: 422, code: 'search_result_unknown', error: 'بعض النتائج المختارة غير موجودة أو انتهت صلاحيتها أو لا تخص هذا المشروع. أعد البحث ثم اختر الدراسات.' };

  const savedPapers = Array.isArray(input.savedLiterature?.papers) ? input.savedLiterature.papers as Array<Record<string, unknown>> : [];
  const kept = keepPaperIds.map((id) => savedPapers.find((paper) => paper && typeof paper === 'object' && paper.id === id));
  if (kept.some((paper) => !paper)) return { ok: false, status: 422, code: 'saved_paper_unknown', error: 'بعض الدراسات المطلوب إبقاؤها غير محفوظة في هذا المشروع.' };
  // Kept papers are copied from the stored stage, never from the request.
  // Pre-Slice-1 entries keep a client-submitted label rather than gaining a
  // server-discovered one.
  const keptPapers = (kept as Array<Record<string, unknown>>).flatMap((paper) => paper.metadataOrigin === SERVER_DISCOVERED_METADATA ? [paper] : sanitizeLiteraturePapers([paper]));

  const papers = new Map<string, Record<string, unknown>>();
  for (const paper of [...resolved.map(literaturePaperFromResult), ...keptPapers]) {
    if (!papers.has(String(paper.id))) papers.set(String(paper.id), paper);
  }
  const query = resolved[0]?.query || (typeof input.savedLiterature?.query === 'string' ? input.savedLiterature.query : undefined);
  return { ok: true, content: { papers: [...papers.values()], ...(query ? { query } : {}) } };
}
