import { isUuid } from '@/lib/research-evidence';
import { SUPPORT_RELATIONS, type SupportRelation } from '@/lib/research-claims';
import { CITATION_STYLES, type CitationStyle } from '@/lib/citations/types';
import { readWritingBibliography, type WritingBibliography } from '@/lib/citations/writing-bibliography';
import { readWritingRichDocument, writingRichText, type WritingRichDocument } from '@/lib/writing-rich-text';
import { pdfQuotePages, type PdfFileInfo } from '@/lib/pdf-evidence';

export const WRITING_DOCUMENT_TYPE = 'evidence-writing:v1';
export const MAX_WRITING_CHARACTERS = 120_000;
export type WritingSourceKind = 'reference' | 'pdf';
export type WritingSource = { id: string; kind: WritingSourceKind; title: string; text: string; hash: string; origin: string; url: string | null; year: number | null; bibliography?: WritingBibliography; pdf?: PdfFileInfo };
export type WritingCitation = {
  id: string; claimStart: number; claimEnd: number; claimText: string;
  sourceKind: WritingSourceKind; sourceId: string; sourceHash: string;
  quoteStart: number; quoteEnd: number; quoteText: string;
  relation: SupportRelation; note: string;
  /** Volume and page of the printed book, as the researcher read them; never taken from PDF page numbers. */
  volume?: string; page?: string;
};
export type WritingDraft = { text: string; citations: WritingCitation[]; citationStyle?: CitationStyle; richText?: WritingRichDocument };
export type SavedWritingCitation = WritingCitation & { source: Omit<WritingSource, 'text' | 'hash' | 'pdf'>; firstLine: number; lastLine: number; pdfPages?: { first: number; last: number; fileHash: string } };
export type SavedWritingDraft = Omit<WritingDraft, 'citations'> & { citations: SavedWritingCitation[] };

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
/** A volume or page: Western or Arabic-Indic digits, or a range of them. */
export function isLocator(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 20 && /^[0-9\u0660-\u0669]+(?:\s*[-–]\s*[0-9\u0660-\u0669]+)?$/.test(value);
}
function range(start: unknown, end: unknown): start is number {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && Number(start) >= 0 && Number(end) > Number(start);
}
export function isTextBoundary(text: string, offset: number) {
  return !(offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]));
}
export function claimIsAnchored(text: string, citation: WritingCitation) {
  return citation.claimEnd <= text.length && isTextBoundary(text, citation.claimStart) && isTextBoundary(text, citation.claimEnd)
    && text.slice(citation.claimStart, citation.claimEnd) === citation.claimText;
}
/** Offsets use the same UTF-16 positions as textarea selectionStart/End. */
export function parseWritingDraft(value: unknown): WritingDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!isText(body.text, MAX_WRITING_CHARACTERS) || !Array.isArray(body.citations)) return null;
  if (body.citationStyle !== undefined && !CITATION_STYLES.includes(body.citationStyle as CitationStyle)) return null;
  const richText = body.richText === undefined ? undefined : readWritingRichDocument(body.richText);
  if (richText === null || (richText && writingRichText(richText) !== body.text)) return null;
  const ids = new Set<string>();
  const links = new Set<string>();
  const citations: WritingCitation[] = [];
  for (const entry of body.citations) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const c = entry as Record<string, unknown>;
    if (!isUuid(c.id) || ids.has(c.id.toLowerCase()) || !isUuid(c.sourceId) || !['reference', 'pdf'].includes(String(c.sourceKind))
      || typeof c.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(c.sourceHash)
      || !range(c.claimStart, c.claimEnd) || !range(c.quoteStart, c.quoteEnd)
      || !isText(c.claimText, 4000) || !c.claimText.trim() || Number(c.claimEnd) - Number(c.claimStart) !== c.claimText.length
      || !isText(c.quoteText, 4000) || !c.quoteText.trim() || Number(c.quoteEnd) - Number(c.quoteStart) !== c.quoteText.length
      || !SUPPORT_RELATIONS.includes(c.relation as SupportRelation) || !isText(c.note, 2000)
      || (c.volume !== undefined && !isLocator(c.volume)) || (c.page !== undefined && !isLocator(c.page))) return null;
    const link = JSON.stringify([c.claimStart, c.claimEnd, c.sourceKind, c.sourceId.toLowerCase(), c.quoteStart, c.quoteEnd]);
    if (links.has(link)) return null;
    links.add(link); ids.add(c.id.toLowerCase());
    citations.push({ id: c.id, sourceId: c.sourceId, sourceKind: c.sourceKind as WritingSourceKind, sourceHash: c.sourceHash,
      claimStart: c.claimStart, claimEnd: Number(c.claimEnd), claimText: c.claimText,
      quoteStart: c.quoteStart, quoteEnd: Number(c.quoteEnd), quoteText: c.quoteText, relation: c.relation as SupportRelation, note: c.note,
      ...(c.volume ? { volume: c.volume as string } : {}), ...(c.page ? { page: c.page as string } : {}) });
  }
  // Several sources may support the same passage. Partially overlapping
  // anchored passages would make the inline reading ambiguous.
  const spans = citations.filter(c => claimIsAnchored(body.text as string, c)).sort((a, b) => a.claimStart - b.claimStart);
  for (let i = 1; i < spans.length; i++) {
    const a = spans[i - 1], b = spans[i];
    if (b.claimStart < a.claimEnd && (b.claimStart !== a.claimStart || b.claimEnd !== a.claimEnd)) return null;
  }
  return { text: body.text, citations, ...(body.citationStyle ? { citationStyle: body.citationStyle as CitationStyle } : {}), ...(richText ? { richText } : {}) };
}

/** A changed claim keeps its evidence but must be reviewed; no silent relink. */
export function rebaseWritingCitations(before: string, after: string, citations: WritingCitation[]): WritingCitation[] {
  if (before === after) return citations;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let suffix = 0;
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const oldEnd = before.length - suffix, delta = after.length - before.length;
  return citations.map(c => {
    if (!claimIsAnchored(before, c)) return c;
    if (c.claimEnd <= start) return c;
    if (c.claimStart >= oldEnd) return { ...c, claimStart: c.claimStart + delta, claimEnd: c.claimEnd + delta };
    // Retain the original claim and offsets. The mismatch is displayed as
    // needing review and is excluded from the inline citation preview.
    return c;
  });
}

export function quoteMatchesSource(citation: WritingCitation, source: WritingSource) {
  return citation.sourceKind === source.kind && citation.sourceId === source.id && citation.sourceHash === source.hash
    && citation.quoteEnd <= source.text.length && isTextBoundary(source.text, citation.quoteStart) && isTextBoundary(source.text, citation.quoteEnd)
    && source.text.slice(citation.quoteStart, citation.quoteEnd) === citation.quoteText;
}
export function attachWritingSource(c: WritingCitation, source: WritingSource): SavedWritingCitation {
  const { text } = source;
  const metadata = { id: source.id, kind: source.kind, title: source.title, origin: source.origin, url: source.url, year: source.year, ...(source.bibliography ? { bibliography: source.bibliography } : {}) };
  const pdfPages = source.kind === 'pdf' && source.pdf ? pdfQuotePages(source.pdf, c.quoteStart, c.quoteEnd) : null;
  return { ...c, source: metadata, firstLine: text.slice(0, c.quoteStart).split('\n').length, lastLine: text.slice(0, c.quoteEnd).split('\n').length, ...(pdfPages ? { pdfPages } : {}) };
}
export function readSavedWriting(content: unknown): SavedWritingDraft | null {
  try {
    const value = typeof content === 'string' ? JSON.parse(content) : content;
    const parsed = parseWritingDraft(value); if (!parsed) return null;
    const items = value.citations as Record<string, unknown>[];
    const citations: SavedWritingCitation[] = [];
    for (let i = 0; i < items.length; i++) {
      const s = items[i].source as Record<string, unknown> | undefined;
      if (!s || s.id !== parsed.citations[i].sourceId || s.kind !== parsed.citations[i].sourceKind || !isText(s.title, 1000)
        || typeof s.origin !== 'string' || (s.url !== null && typeof s.url !== 'string') || (s.year !== null && !Number.isInteger(s.year))
        || !Number.isSafeInteger(items[i].firstLine) || Number(items[i].firstLine) < 1 || !Number.isSafeInteger(items[i].lastLine) || Number(items[i].lastLine) < Number(items[i].firstLine)) return null;
      const bibliography = s.bibliography === undefined ? undefined : readWritingBibliography(s.bibliography);
      if (bibliography === null) return null;
      const pages = items[i].pdfPages as SavedWritingCitation['pdfPages'];
      if (pages !== undefined && (s.kind !== 'pdf' || !pages || !Number.isInteger(pages.first) || !Number.isInteger(pages.last) || pages.first < 1 || pages.last < pages.first || pages.last > 50 || !/^[a-f0-9]{64}$/.test(pages.fileHash))) return null;
      citations.push({ ...parsed.citations[i], source: { id: s.id as string, kind: s.kind as WritingSourceKind, title: s.title, origin: s.origin, url: safeWritingUrl(s.url), year: s.year as number | null, ...(bibliography ? { bibliography } : {}) }, firstLine: Number(items[i].firstLine), lastLine: Number(items[i].lastLine), ...(pages ? { pdfPages: { first: pages.first, last: pages.last, fileHash: pages.fileHash } } : {}) });
    }
    return { ...parsed, citations };
  } catch { return null; }
}
export function safeWritingUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function writingSegments(draft: WritingDraft) {
  const anchored = draft.citations.filter(c => claimIsAnchored(draft.text, c)).sort((a, b) => a.claimStart - b.claimStart);
  const segments: { text: string; citations: string[] }[] = [];
  let position = 0;
  for (let i = 0; i < anchored.length;) {
    const c = anchored[i];
    if (c.claimStart > position) segments.push({ text: draft.text.slice(position, c.claimStart), citations: [] });
    const same = anchored.filter(item => item.claimStart === c.claimStart && item.claimEnd === c.claimEnd);
    segments.push({ text: draft.text.slice(c.claimStart, c.claimEnd), citations: same.map(item => item.id) });
    position = c.claimEnd; i += same.length;
  }
  if (position < draft.text.length) segments.push({ text: draft.text.slice(position), citations: [] });
  return segments;
}
