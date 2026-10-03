import type { AcademicPaper } from './types';

export function normaliseDoi(value: string | null | undefined) {
  const doi = value?.trim().toLowerCase().replace(/^doi:\s*/, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '').replace(/[)\].,;:]+$/, '');
  return doi && /^10\.\d{4,9}\/.+/.test(doi) ? doi : null;
}

export function normaliseTitle(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function recordKey(paper: AcademicPaper) {
  const doi = normaliseDoi(paper.doi);
  if (doi) return `doi:${doi}`;
  const author = normaliseTitle(paper.authors[0] || '');
  return `meta:${normaliseTitle(paper.title)}:${paper.year || 0}:${author}`;
}

function metadataScore(paper: AcademicPaper) {
  return Number(Boolean(paper.abstract)) * 3 + Number(Boolean(paper.pdfUrl)) * 3 + paper.authors.length + paper.subjects.length + Number(Boolean(paper.doi));
}

function normalisedAuthors(paper: AcademicPaper) {
  return paper.authors.map(normaliseTitle).join('|');
}

/** The first author's family name, normalised; null when it cannot be read. */
function firstAuthorFamily(paper: AcademicPaper) {
  const author = (paper.authors[0] || '').trim();
  if (!author) return null;
  // "Family, Given" or "Given Family".
  const family = author.includes(',') ? author.split(',')[0] : author.split(/\s+/).pop() || '';
  return normaliseTitle(family) || null;
}

/**
 * Whether two records describe the same work. Two different DOIs are never the
 * same work. Without a DOI on both sides, identity needs the same normalised
 * title (long enough to be distinctive), a year within one (where both are
 * known) and the same first-author family name. When identity is uncertain the
 * records are kept apart: a duplicate is safer than a hybrid record.
 */
function sameWork(first: AcademicPaper, second: AcademicPaper) {
  const firstDoi = normaliseDoi(first.doi);
  const secondDoi = normaliseDoi(second.doi);
  if (firstDoi && secondDoi) return firstDoi === secondDoi;
  const title = normaliseTitle(first.title);
  if (title.length <= 12 || title !== normaliseTitle(second.title)) return false;
  if (first.year && second.year && Math.abs(first.year - second.year) > 1) return false;
  const firstFamily = firstAuthorFamily(first);
  return Boolean(firstFamily && firstFamily === firstAuthorFamily(second));
}

/**
 * Merges two records of the same work. Every identity-bearing field (DOI,
 * title, authors, year, venue and publication details, identifiers) comes from
 * one anchor record: the one with a DOI, otherwise the more complete one. The
 * other record only fills supplementary fields (abstract, links, counts,
 * subjects, provenance), so a merge cannot combine two scholarly identities.
 */
export function mergePaper(first: AcademicPaper, second: AcademicPaper): AcademicPaper {
  const firstDoi = normaliseDoi(first.doi);
  const secondDoi = normaliseDoi(second.doi);
  const anchor = firstDoi && !secondDoi ? first
    : secondDoi && !firstDoi ? second
    : metadataScore(second) > metadataScore(first) ? second : first;
  const other = anchor === first ? second : first;
  const anchorDoi = normaliseDoi(anchor.doi);
  // Provenance of an identity field includes the other record only where it
  // reported the same value.
  const corroborated = (field: 'title' | 'doi' | 'authors', agrees: boolean, has: (paper: AcademicPaper) => boolean) => {
    const own = (paper: AcademicPaper) => paper.fieldProvenance?.[field] || (has(paper) ? [paper.source] : []);
    return [...new Set([...own(anchor), ...(agrees ? own(other) : [])])];
  };
  return {
    ...anchor,
    id: anchorDoi || anchor.id,
    doi: anchorDoi,
    abstract: anchor.abstract || other.abstract,
    citationCount: Math.max(first.citationCount, second.citationCount),
    pdfUrl: anchor.pdfUrl || other.pdfUrl,
    url: anchor.url || other.url,
    sources: [...new Set([...first.sources, ...second.sources, first.source, second.source])],
    subjects: [...new Set([...first.subjects, ...second.subjects])].slice(0, 20),
    openAccess: first.openAccess || second.openAccess || Boolean(first.pdfUrl || second.pdfUrl),
    license: anchor.license || other.license || null,
    referencedWorksCount: Math.max(first.referencedWorksCount || 0, second.referencedWorksCount || 0),
    // Field provenance describes the anchor's values; the other record is
    // credited only for identity fields it corroborates.
    fieldProvenance: {
      ...(anchor.fieldProvenance || {}),
      title: corroborated('title', normaliseTitle(anchor.title) === normaliseTitle(other.title), () => true),
      doi: corroborated('doi', Boolean(anchorDoi) && anchorDoi === normaliseDoi(other.doi), (paper) => Boolean(paper.doi)),
      authors: corroborated('authors', normalisedAuthors(anchor) === normalisedAuthors(other), () => true),
    },
  };
}

export function deduplicatePapers(papers: AcademicPaper[]) {
  const records = new Map<string, AcademicPaper>();
  for (const paper of papers) {
    const exactKey = recordKey(paper);
    const existingEntry = [...records.entries()].find(([key, candidate]) => key === exactKey || sameWork(candidate, paper));
    if (existingEntry) {
      records.set(existingEntry[0], mergePaper(existingEntry[1], paper));
    } else {
      records.set(exactKey, paper);
    }
  }
  return [...records.values()];
}

export function stripMarkup(value: string | null | undefined) {
  return (value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 4_000);
}
