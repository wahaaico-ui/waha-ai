import type { AcademicPaper } from './types';
import { compareIdentity, identityPriority } from '../identity';

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


function metadataScore(paper: AcademicPaper) {
  return Number(Boolean(paper.abstract)) * 3 + Number(Boolean(paper.pdfUrl)) * 3 + paper.authors.length + paper.subjects.length + Number(Boolean(paper.doi));
}

function normalisedAuthors(paper: AcademicPaper) {
  return paper.authors.map(normaliseTitle).join('|');
}

/** This record's own values per source; a merged record carries every source's. */
export function providerObservationsOf(paper: AcademicPaper) {
  return paper.providerObservations || {
    [paper.source]: {
      title: paper.title || null,
      year: paper.year || null,
      venue: paper.journal || paper.containerTitle || null,
      doi: normaliseDoi(paper.doi),
      citationCount: paper.citationCount,
      oaUrl: paper.pdfUrl,
      // A provider without a link has not asserted the work is closed access.
      isOpenAccess: paper.openAccess ? true : null,
    },
  };
}

function citationCountsOf(paper: AcademicPaper) {
  return paper.citationCounts || { [paper.source]: paper.citationCount };
}

/**
 * Merges two records already judged the same work (see compareIdentity in
 * src/lib/academic/identity.ts). Every identity-bearing field (DOI, title,
 * authors, year, venue and publication details, exclusive identifiers) comes
 * from one anchor record: the one with a DOI, otherwise the one from the
 * higher-priority source (registries before indexes before repositories), then
 * the more complete one. The other record only fills supplementary fields
 * (abstract, links, counts, subjects, provider record IDs, provenance), so a
 * merge cannot combine two scholarly identities.
 */
export function mergePaper(first: AcademicPaper, second: AcademicPaper): AcademicPaper {
  const firstDoi = normaliseDoi(first.doi);
  const secondDoi = normaliseDoi(second.doi);
  const ranked = identityPriority(second.source) - identityPriority(first.source) || metadataScore(second) - metadataScore(first);
  const anchor = firstDoi && !secondDoi ? first
    : secondDoi && !firstDoi ? second
    : ranked > 0 ? second : first;
  const other = anchor === first ? second : first;
  const anchorDoi = normaliseDoi(anchor.doi);
  // Provenance of an identity field includes the other record only where it
  // reported the same value.
  const corroborated = (field: 'title' | 'doi' | 'authors', agrees: boolean, has: (paper: AcademicPaper) => boolean) => {
    const own = (paper: AcademicPaper) => paper.fieldProvenance?.[field] || (has(paper) ? [paper.source] : []);
    return [...new Set([...own(anchor), ...(agrees ? own(other) : [])])];
  };
  // Supplementary fields record which record supplied the kept value.
  const suppliedBy = (field: 'pdfUrl' | 'url') => {
    const supplier = anchor[field] ? anchor : other[field] ? other : null;
    return supplier ? supplier.fieldProvenance?.[field] || [supplier.source] : [];
  };
  return {
    ...anchor,
    id: anchorDoi || anchor.id,
    doi: anchorDoi,
    abstract: anchor.abstract || other.abstract,
    citationCount: Math.max(first.citationCount, second.citationCount),
    citationCounts: { ...citationCountsOf(other), ...citationCountsOf(anchor) },
    // Every source's own values are kept, so disagreement is not lost.
    providerObservations: { ...providerObservationsOf(other), ...providerObservationsOf(anchor) },
    pdfUrl: anchor.pdfUrl || other.pdfUrl,
    url: anchor.url || other.url,
    sources: [...new Set([...first.sources, ...second.sources, first.source, second.source])],
    subjects: [...new Set([...first.subjects, ...second.subjects])].slice(0, 20),
    openAccess: first.openAccess || second.openAccess || Boolean(first.pdfUrl || second.pdfUrl),
    license: anchor.license || other.license || null,
    referencedWorksCount: Math.max(first.referencedWorksCount || 0, second.referencedWorksCount || 0),
    // Provider record IDs are not exclusive (a provider may hold several records
    // of one work), so both records' IDs describe the merged work.
    providerIds: { ...(other.providerIds || {}), ...(anchor.providerIds || {}) },
    // Field provenance describes the anchor's values; the other record is
    // credited only for identity fields it corroborates.
    fieldProvenance: {
      ...(anchor.fieldProvenance || {}),
      title: corroborated('title', normaliseTitle(anchor.title) === normaliseTitle(other.title), () => true),
      doi: corroborated('doi', Boolean(anchorDoi) && anchorDoi === normaliseDoi(other.doi), (paper) => Boolean(paper.doi)),
      authors: corroborated('authors', normalisedAuthors(anchor) === normalisedAuthors(other), () => true),
      pdfUrl: suppliedBy('pdfUrl'),
      url: suppliedBy('url'),
    },
  };
}

/**
 * Collapses records of the same work, judged only by compareIdentity. When
 * identity is uncertain the records are kept as separate results, including
 * when a record matches more than one kept record: no record is chosen
 * arbitrarily.
 */
export function deduplicatePapers(papers: AcademicPaper[]) {
  const records: AcademicPaper[] = [];
  for (const paper of papers) {
    const matches = records.flatMap((candidate, index) => compareIdentity(candidate, paper).same ? [index] : []);
    if (matches.length === 1) records[matches[0]] = mergePaper(records[matches[0]], paper);
    else records.push(paper);
  }
  return records;
}

export function stripMarkup(value: string | null | undefined) {
  return (value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 4_000);
}
