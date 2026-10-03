// Reference check (v0): does each reference in a researcher's list correspond to
// a record in the scholarly indexes that were searched, and do its details agree?
//
// Deterministic throughout: the reference list is split and parsed with fixed
// rules, and each reference is compared with records returned by the indexes.
// No model is involved and nothing is stored.
//
// The result never says a reference is fake, invalid or verified. A reference
// that is not found was not found in the indexes searched during this check; it
// may be a book, a thesis, a regional journal or a work those indexes do not
// cover, which is especially common for Arabic references. When an index could
// not be reached, the reference is reported as not checked, never as not found.

import { normaliseDoi } from '@/lib/academic/integrations/normalization';

export const MAX_REFERENCES = 60;
export const MAX_INPUT_CHARS = 200_000;

export type ReferenceProviderId = 'crossref' | 'openalex';

export type FoundRecord = {
  provider: ReferenceProviderId;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string | null;
};

/** One index used by the check. Throwing means the index could not be reached. */
export type ReferenceProvider = {
  id: ReferenceProviderId;
  /** The record for a DOI, or null when the index has no record for it. */
  byDoi(doi: string): Promise<FoundRecord | null>;
  search(query: string): Promise<FoundRecord[]>;
};

export type ParsedReference = {
  index: number;
  raw: string;
  doi: string | null;
  year: number | null;
  title: string | null;
  firstAuthor: string | null;
  arabic: boolean;
};

export type ReferenceStatus =
  | 'matched' // a record with the same title (and year, author and DOI where given) was found
  | 'matched_with_differences' // a record was found, but some cited details differ
  | 'doi_mismatch' // the cited DOI resolves to a different work
  | 'not_found' // no corresponding record in the indexes searched
  | 'not_checked' // the indexes could not be reached
  | 'unparsed'; // no title or DOI could be read from the reference

export type ReferenceDifference = { field: 'title' | 'year' | 'author' | 'doi'; cited: string; found: string };

export type ReferenceResult = ParsedReference & {
  status: ReferenceStatus;
  record: FoundRecord | null;
  differences: ReferenceDifference[];
  providersSearched: ReferenceProviderId[];
  providersUnavailable: ReferenceProviderId[];
  /** For a reference not found: the most similar record returned, which is not a match. */
  closest?: FoundRecord;
};

export type ReferenceCheckReport = {
  checkedAt: string;
  totalFound: number;
  truncated: boolean;
  sectionDetected: boolean;
  results: ReferenceResult[];
  counts: Record<ReferenceStatus, number>;
  providers: ReferenceProviderId[];
  /** How many references are in Arabic script, which these indexes cover poorly. */
  arabicReferences: number;
};

// ---- Extraction ------------------------------------------------------------------

const SECTION_HEADING = /^[\s#*\d.\-–]*(references|reference list|bibliography|works cited|literature cited|قائمة المراجع|المراجع والمصادر|المصادر والمراجع|المراجع|المصادر)(\s+(العربية|الأجنبية|الانجليزية|الإنجليزية|باللغة العربية|باللغة الإنجليزية))?\s*[:：]?\s*$/i;
const END_HEADING = /^[\s#*\d.\-–]*(appendix|appendices|الملاحق|ملحق|ملاحق)(?=[\s:：]|$)/i;

/**
 * The reference section of a document. A heading in the first half is taken
 * to be a table of contents entry, so the first heading in the second half is
 * used; text pasted without a heading is treated as a reference list.
 */
export function extractReferenceSection(text: string): { section: string; detected: boolean } {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const headings = lines.map((line, index) => (SECTION_HEADING.test(line.trim()) ? index : -1)).filter((index) => index >= 0);
  if (!headings.length) return { section: text, detected: false };
  const start = headings.find((index) => index >= lines.length / 2) ?? headings[headings.length - 1];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => END_HEADING.test(line.trim()));
  return { section: (end >= 0 ? rest.slice(0, end) : rest).join('\n'), detected: true };
}

const NUMBERED = /^\s*(\[\d{1,3}\]|\d{1,3}[.)-](?!\d))\s+/;
// An author-year reference starts with a name and has a year in parentheses early on.
const AUTHOR_YEAR_START = /^\s*[\p{L}][^\n]{0,160}?\(\s*(\d{4}[a-z]?|n\.\s?d\.|د\.\s?ت)\s*[,)]/iu;

/** Split a reference section into individual references, joining wrapped lines. */
export function splitReferences(section: string): string[] {
  const lines = section.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim());
  const nonEmpty = lines.filter(Boolean);
  if (!nonEmpty.length) return [];

  let entries: string[];
  if (nonEmpty.filter((line) => NUMBERED.test(line)).length >= Math.max(2, nonEmpty.length * 0.2)) {
    entries = joinByStart(nonEmpty, (line) => NUMBERED.test(line)).map((entry) => entry.replace(NUMBERED, ''));
  } else if (nonEmpty.filter((line) => AUTHOR_YEAR_START.test(line)).length >= 2) {
    entries = joinByStart(nonEmpty, (line) => AUTHOR_YEAR_START.test(line));
  } else if (lines.some((line, index) => !line && index > 0 && lines[index - 1])) {
    entries = section.split(/\n\s*\n/).map((block) => block.replace(/\s*\n\s*/g, ' '));
  } else {
    entries = nonEmpty;
  }
  return entries.map((entry) => entry.replace(/\s+/g, ' ').replace(/-\s(?=\p{Ll})/gu, '').trim())
    .filter((entry) => entry.length >= 20 && entry.length <= 1500);
}

function joinByStart(lines: string[], isStart: (line: string) => boolean) {
  const entries: string[] = [];
  for (const line of lines) {
    if (isStart(line) || !entries.length) entries.push(line);
    else entries[entries.length - 1] += ` ${line}`;
  }
  return entries;
}

// ---- Parsing ---------------------------------------------------------------------

const ARABIC_LETTER = /[؀-ۿ]/g;

export function isArabicReference(text: string) {
  const letters = text.match(/\p{L}/gu)?.length || 1;
  return (text.match(ARABIC_LETTER)?.length || 0) / letters > 0.3;
}

function extractDoi(text: string) {
  const match = text.match(/\b10\.\d{4,9}\/[^\s"<>]+/i);
  return match ? normaliseDoi(match[0].replace(/[.,;:)\]]+$/, '')) : null;
}

function extractYear(text: string) {
  const inParens = text.match(/\(\s*((?:19|20)\d{2})[a-z]?\s*[,)]/);
  const any = inParens || text.match(/\b((?:19|20)\d{2})\b/);
  return any ? Number(any[1]) : null;
}

function cleanTitle(value: string) {
  const title = value.replace(/^[\s"“”'‘’«»]+|[\s"“”'‘’«».,;:]+$/g, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
  return title.length >= 8 ? title : null;
}

function extractTitle(text: string) {
  const quoted = text.match(/[“"«]([^”"»]{8,300})[”"»]/);
  if (quoted) return cleanTitle(quoted[1]);
  // Author-year: the title follows "(year)." and runs to the next sentence end.
  const afterYear = text.match(/\(\s*(?:\d{4}[a-z]?|n\.\s?d\.|د\.\s?ت)[^)]*\)\s*[.,]?\s*(.+)/iu);
  if (afterYear) {
    const title = afterYear[1].match(/^(.{8,300}?[^\s.]{2})[.?!؟](\s|$)/u)?.[1] || afterYear[1].slice(0, 300);
    return cleanTitle(title);
  }
  // Otherwise: the longest sentence segment that is not the author list or a locator.
  const segments = text.replace(/https?:\/\/\S+/g, ' ').split(/\.\s+|[؛]\s*/).map((segment) => segment.trim())
    .filter((segment) => segment.length >= 12 && !/^(doi|retrieved|available|vol|pp?\.|in:)/i.test(segment));
  segments.shift();
  const longest = segments.sort((a, b) => b.length - a.length)[0];
  return longest ? cleanTitle(longest.slice(0, 300)) : null;
}

function extractFirstAuthor(text: string) {
  const head = text.split(/[(,،.]/)[0]?.trim() || '';
  const surname = head.split(/\s+/).filter((word) => /\p{L}{2,}/u.test(word));
  return surname.length ? surname[0] : null;
}

export function parseReference(raw: string, index: number): ParsedReference {
  return { index, raw, doi: extractDoi(raw), year: extractYear(raw), title: extractTitle(raw), firstAuthor: extractFirstAuthor(raw), arabic: isArabicReference(raw) };
}

// ---- Comparison ------------------------------------------------------------------

export function normaliseForComparison(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'of', 'in', 'on', 'a', 'an', 'to', 'في', 'من', 'على', 'الى', 'عن', 'مع']);

/** Overlap of significant title words (0 to 1), with a bonus for one title containing the other. */
export function titleSimilarity(first: string, second: string) {
  const a = normaliseForComparison(first);
  const b = normaliseForComparison(second);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wordsA = new Set(a.split(' ').filter((word) => word.length > 1 && !STOP.has(word)));
  const wordsB = new Set(b.split(' ').filter((word) => word.length > 1 && !STOP.has(word)));
  if (!wordsA.size || !wordsB.size) return 0;
  const shared = [...wordsA].filter((word) => wordsB.has(word)).length;
  const jaccard = shared / new Set([...wordsA, ...wordsB]).size;
  // A cited title is often the main title only, without the subtitle.
  const contained = shared / Math.min(wordsA.size, wordsB.size);
  return Math.min(wordsA.size, wordsB.size) >= 4 && contained >= 0.95 ? Math.max(jaccard, 0.9) : jaccard;
}

export const TITLE_MATCH = 0.75;
export const TITLE_CLOSE = 0.5;

function authorAppears(author: string, record: FoundRecord) {
  const name = normaliseForComparison(author);
  return name.length < 2 || record.authors.some((candidate) => normaliseForComparison(candidate).split(' ').includes(name));
}

function differencesBetween(reference: ParsedReference, record: FoundRecord): ReferenceDifference[] {
  const differences: ReferenceDifference[] = [];
  if (reference.title && titleSimilarity(reference.title, record.title) < TITLE_MATCH) differences.push({ field: 'title', cited: reference.title, found: record.title });
  if (reference.year && record.year && Math.abs(reference.year - record.year) > 1) differences.push({ field: 'year', cited: String(reference.year), found: String(record.year) });
  if (reference.firstAuthor && record.authors.length && !authorAppears(reference.firstAuthor, record)) differences.push({ field: 'author', cited: reference.firstAuthor, found: record.authors.slice(0, 3).join('، ') });
  if (reference.doi && record.doi && normaliseDoi(record.doi) !== reference.doi) differences.push({ field: 'doi', cited: reference.doi, found: record.doi });
  return differences;
}

function searchQuery(reference: ParsedReference) {
  return [reference.title, reference.firstAuthor, reference.year].filter(Boolean).join(' ').slice(0, 300);
}

export async function checkReference(reference: ParsedReference, providers: ReferenceProvider[]): Promise<ReferenceResult> {
  const searched = new Set<ReferenceProviderId>();
  const unavailable = new Set<ReferenceProviderId>();
  const result = (status: ReferenceStatus, record: FoundRecord | null = null, differences: ReferenceDifference[] = []): ReferenceResult => ({
    ...reference, status, record, differences, providersSearched: [...searched], providersUnavailable: [...unavailable].filter((id) => !searched.has(id)),
  });
  if (!reference.title && !reference.doi) return result('unparsed');

  // 1. A cited DOI is looked up directly.
  let doiRecord: FoundRecord | null = null;
  if (reference.doi) {
    for (const provider of providers) {
      try {
        const record = await provider.byDoi(reference.doi);
        searched.add(provider.id);
        if (record) { doiRecord = record; break; }
      } catch { unavailable.add(provider.id); }
    }
    if (doiRecord) {
      if (reference.title && titleSimilarity(reference.title, doiRecord.title) < TITLE_CLOSE) {
        return result('doi_mismatch', doiRecord, [{ field: 'title', cited: reference.title, found: doiRecord.title }]);
      }
      const differences = differencesBetween(reference, doiRecord);
      return result(differences.length ? 'matched_with_differences' : 'matched', doiRecord, differences);
    }
  }

  // 2. Otherwise (or when the DOI is unknown to every index) search by title.
  if (reference.title) {
    let best: { record: FoundRecord; score: number } | null = null;
    for (const provider of providers) {
      try {
        const records = await provider.search(searchQuery(reference));
        searched.add(provider.id);
        for (const record of records) {
          const score = titleSimilarity(reference.title, record.title);
          if (!best || score > best.score) best = { record, score };
        }
        if (best && best.score >= TITLE_MATCH) break;
      } catch { unavailable.add(provider.id); }
    }
    // A title search returns loosely related works, so only a strong title
    // match counts as found. A weaker one is reported as not found, with the
    // closest record shown separately and never as a match.
    if (best && best.score >= TITLE_MATCH) {
      const differences = differencesBetween(reference, best.record);
      if (reference.doi) differences.push({ field: 'doi', cited: reference.doi, found: best.record.doi || 'لا يوجد DOI في السجل' });
      return result(differences.length ? 'matched_with_differences' : 'matched', best.record, differences);
    }
    if (best && best.score >= TITLE_CLOSE) return { ...result('not_found'), closest: best.record };
  }

  return searched.size ? result('not_found') : result('not_checked');
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

export async function checkReferenceList(text: string, providers: ReferenceProvider[], now = new Date()): Promise<ReferenceCheckReport> {
  const { section, detected } = extractReferenceSection(text.slice(0, MAX_INPUT_CHARS));
  const all = splitReferences(section);
  const parsed = all.slice(0, MAX_REFERENCES).map((raw, index) => parseReference(raw, index + 1));
  const results = await mapWithConcurrency(parsed, 4, (reference) => checkReference(reference, providers));
  const counts: Record<ReferenceStatus, number> = { matched: 0, matched_with_differences: 0, doi_mismatch: 0, not_found: 0, not_checked: 0, unparsed: 0 };
  for (const item of results) counts[item.status] += 1;

  return { checkedAt: now.toISOString(), totalFound: all.length, truncated: all.length > MAX_REFERENCES, sectionDetected: detected, results, counts, providers: providers.map((provider) => provider.id), arabicReferences: results.filter((item) => item.arabic).length };
}
