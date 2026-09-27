import type { CitationItem } from '@/lib/citations/types';
import { normaliseDoi, safeUrl } from '@/lib/academic/integrations/normalization';
import { normaliseResearchAnalysis } from '@/lib/research-analysis';
import { buildProvidedTitlesPath, type ResearchPath, type VerifyReport } from '@/lib/research-exploration';

// Trust boundary for research state (Slice 0).
//
// The browser may send researcher-written text, researcher choices and the IDs
// of records the server already holds. It is never the authority for system
// state: verification status, confidence, provenance, search coverage, gate
// inputs or system decisions. Helpers in this module either derive that state
// from server-held records or strip it from client payloads before storage.

export const SERVER_DERIVED_TRUST_MODEL = 'server-derived/v1';
export const CLIENT_SUBMITTED_METADATA = 'client_submitted';

export const LEGACY_SCORE_NOTICE = 'مؤشر استدلالي قديم مبني على أعداد النتائج المسترجعة ضمن حدود البحث الحالي؛ لا يقيس جودة الفكرة ولا يمثل حكماً أكاديمياً.';

/** Document types that only the server may create, change or remove. */
export function isServerOwnedDocumentType(type: string | null | undefined) {
  const value = type || '';
  return value === 'idea_verification' || value.startsWith('journey:');
}

const text = (value: unknown, maximum: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : null;
const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Keeps only bibliographic fields from a client-supplied citation item. The
 * server has not verified these fields, so verification state is reset rather
 * than copied from the request.
 */
export function sanitizeClientCitationItem(value: unknown): CitationItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const title = text(candidate.title, 1_000);
  if (!title) return null;
  const doi = normaliseDoi(typeof candidate.doi === 'string' ? candidate.doi : null);
  const authors = Array.isArray(candidate.authors)
    ? candidate.authors.filter((author): author is string => typeof author === 'string' && author.trim().length > 0).slice(0, 100).map((author) => author.trim().slice(0, 300))
    : [];
  const year = numberOrNull(candidate.year);
  return {
    id: text(doi || candidate.id, 500) || title.slice(0, 500),
    title,
    authors,
    year: year && year > 0 ? Math.trunc(year) : null,
    journal: text(candidate.journal, 500),
    publisher: text(candidate.publisher, 500),
    volume: text(candidate.volume, 50),
    issue: text(candidate.issue, 50),
    pages: text(candidate.pages, 50),
    doi,
    url: safeUrl(text(candidate.url, 2_000)),
    type: text(candidate.type, 100) || 'article',
    verificationStatus: 'unverified',
    confidenceScore: 0,
    provenance: [],
  };
}

/**
 * Literature papers arrive from the browser in the current architecture. Their
 * bibliographic text is kept, but relevance, verification and source labels are
 * system state and are removed. The record is marked as client-submitted.
 */
export function sanitizeLiteraturePapers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((paper) => {
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) return [];
    const candidate = paper as Record<string, unknown>;
    const id = text(candidate.id, 500);
    const title = text(candidate.title, 500);
    if (!id || !title) return [];
    const year = numberOrNull(candidate.year);
    const citationCount = numberOrNull(candidate.citationCount);
    return [{
      id,
      doi: normaliseDoi(typeof candidate.doi === 'string' ? candidate.doi : null),
      title,
      authors: text(candidate.authors, 1_000) || '',
      year: year && year > 0 ? Math.trunc(year) : (text(candidate.year, 20) || 'د.ت'),
      citationCount: citationCount && citationCount > 0 ? Math.trunc(citationCount) : 0,
      abstract: text(candidate.abstract, 4_000) || '',
      pdfUrl: safeUrl(text(candidate.pdfUrl, 2_000)),
      item: sanitizeClientCitationItem(candidate.item),
      metadataOrigin: CLIENT_SUBMITTED_METADATA,
    }];
  });
}

/** Read-side guard for records saved before Slice 0: never surface a client-reported verification as verified. */
export function withoutClientVerification<T>(papers: T): T {
  if (!Array.isArray(papers)) return papers;
  return papers.map((paper) => {
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) return paper;
    const candidate = paper as Record<string, unknown>;
    const item = candidate.item && typeof candidate.item === 'object' && !Array.isArray(candidate.item)
      ? { ...(candidate.item as Record<string, unknown>), verificationStatus: 'unverified', confidenceScore: 0 }
      : candidate.item;
    return { ...candidate, item };
  }) as T;
}

export type ServerVerificationDocument = { id: string; version: number | null; content: string | null };

export type VerifyDerivation =
  | { ok: true; content: Record<string, unknown> }
  | { ok: false; status: 409 | 422; error: string; code: string };

function parseReport(content: string | null): VerifyReport | null {
  if (!content) return null;
  try {
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const report = value as VerifyReport;
    return typeof report.topic === 'string' && Array.isArray(report.researchPaths) ? report : null;
  } catch {
    return null;
  }
}

/**
 * Builds the verify-stage output from the report the server itself stored when
 * it ran the exploration. Only the researcher's choice of path (by ID) is taken
 * from the request; decision, score, coverage and paths come from the server.
 */
export function deriveVerifyStageContent(clientContent: Record<string, unknown>, document: ServerVerificationDocument | null): VerifyDerivation {
  const report = parseReport(document?.content ?? null);
  if (!document || !report) {
    return { ok: false, status: 409, code: 'server_verification_missing', error: 'لا توجد نتيجة استكشاف محفوظة من الخادم لهذا المشروع. أعد تشغيل استكشاف الفكرة ثم اختر المسار.' };
  }
  const selected = clientContent.selectedResearchPath;
  const selectedId = selected && typeof selected === 'object' && !Array.isArray(selected)
    ? text((selected as Record<string, unknown>).id, 200)
    : null;
  if (!selectedId) {
    return { ok: false, status: 422, code: 'research_path_missing', error: 'اختر أحد المسارات المقترحة في نتيجة الاستكشاف.' };
  }

  let researchPaths: ResearchPath[] = report.researchPaths;
  let selectedResearchPath = researchPaths.find((path) => path.id === selectedId) || null;
  if (!selectedResearchPath && selectedId === 'provided-title-comparison' && report.researcherInput?.scenario === 'compare_titles') {
    selectedResearchPath = buildProvidedTitlesPath(report);
    researchPaths = [...researchPaths, selectedResearchPath];
  }
  if (!selectedResearchPath) {
    return { ok: false, status: 422, code: 'research_path_unknown', error: 'المسار المختار غير موجود في نتيجة الاستكشاف المحفوظة. اختر مساراً من النتيجة المعروضة.' };
  }

  return {
    ok: true,
    content: {
      topic: report.topic,
      decision: report.decision,
      acceptanceScore: report.acceptanceScore,
      scoreStatus: 'legacy_heuristic',
      scoreNotice: LEGACY_SCORE_NOTICE,
      gaps: report.gaps,
      sources: report.topPapers,
      searchCoverage: report.searchCoverage,
      researcherContext: report.researcherContext,
      contextMatch: report.contextMatch,
      researchPaths,
      selectedResearchPath,
      researcherInput: report.researcherInput,
      evidenceLimitations: report.evidenceLimitations,
      serverDerivation: {
        trustModel: SERVER_DERIVED_TRUST_MODEL,
        verificationDocumentId: document.id,
        verificationVersion: document.version,
        derivedAt: new Date().toISOString(),
      },
    },
  };
}

export type AnalysisDerivation =
  | { ok: true; content: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Re-validates a literature synthesis at save time against the literature the
 * project has already saved, instead of trusting the browser's copy of the
 * generation-time check.
 */
export function deriveAnalysisStageContent(clientContent: Record<string, unknown>, literatureOutput: Record<string, unknown> | undefined): AnalysisDerivation {
  const papers = Array.isArray(literatureOutput?.papers) ? literatureOutput.papers : [];
  const savedPapers = papers.flatMap((paper) => {
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) return [];
    const candidate = paper as Record<string, unknown>;
    const id = text(candidate.id, 500);
    const title = text(candidate.title, 500);
    return id && title ? [{ id, title, year: candidate.year ?? '' }] : [];
  });
  const analysis = normaliseResearchAnalysis(clientContent, savedPapers.map((paper) => paper.id));
  if (!analysis) {
    return { ok: false, error: 'رُفض حفظ التخليق لأنه لا يلتزم ببنية الأدلة أو يشير إلى دراسات غير محفوظة في أدبيات المشروع.' };
  }
  const generatedAt = typeof clientContent.generatedAt === 'string' && Number.isFinite(Date.parse(clientContent.generatedAt)) ? clientContent.generatedAt : null;
  return {
    ok: true,
    content: {
      ...analysis,
      sources: savedPapers,
      generatedAt,
      evidenceNote: 'هذا تخليق آلي مقيد بالدراسات المختارة وبياناتها المتاحة، ويحتاج مراجعة الباحث قبل الاعتماد.',
      serverDerivation: { trustModel: SERVER_DERIVED_TRUST_MODEL, validatedAt: new Date().toISOString() },
    },
  };
}
