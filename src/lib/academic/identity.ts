// Canonical scholarly identity (Slice 2A).
//
// Decides whether two records returned by academic providers describe the same
// work, using identifiers only in a fixed order and a strict metadata fallback.
// The rules are conservative: a conflicting strong identifier always means two
// works, title similarity never overrides an identifier, and when identity is
// uncertain the records stay separate. A duplicate is safer than a hybrid
// scholarly record.
//
// The same rules are applied by the database function resolve_scholarly_works
// (migration 20261005000000) when results are linked to canonical works.
import type { AcademicPaper, AcademicProvider } from './integrations/types';

export type IdentifierScheme = 'doi' | 'arxiv' | 'pmid' | 'pmcid' | 'openalex' | 'semantic_scholar' | 'core';

/** Normalised identifiers of one record. A missing identifier is absent, never a guess. */
export type ScholarlyIdentifiers = Partial<Record<IdentifierScheme, string>> & { arxivVersion?: string };

/**
 * Identifiers a work can carry only one of. Two different values are a
 * conflict: the records are different works. Provider record IDs (OpenAlex,
 * Semantic Scholar, CORE) are not exclusive: a provider can hold more than one
 * record for the same work, so they are used to match but never to conflict.
 */
export const EXCLUSIVE_SCHEMES = ['doi', 'pmid', 'pmcid', 'arxiv'] as const;
export const PROVIDER_ID_SCHEMES = ['openalex', 'semantic_scholar', 'core'] as const;

const ARXIV_DOI_PREFIX = '10.48550/arxiv.';

export function normaliseDoi(value: string | null | undefined) {
  if (!value) return null;
  let doi = value.trim();
  try { doi = decodeURIComponent(doi); } catch { /* keep the raw value */ }
  doi = doi.toLowerCase().replace(/^doi:\s*/, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '').replace(/[)\].,;:]+$/, '');
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}

/** arXiv identifier without its version: modern 2401.12345 or legacy hep-th/9901001. */
export function normaliseArxivId(value: string | null | undefined): { base: string; version: string | null } | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase()
    .replace(/^https?:\/\/(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf)\//, '')
    .replace(/^arxiv:\s*/, '')
    .replace(/\.pdf$/, '');
  const modern = raw.match(/^(\d{4}\.\d{4,5})(v\d+)?$/);
  if (modern) return { base: modern[1], version: modern[2] || null };
  const legacy = raw.match(/^([a-z-]+(?:\.[a-z]{2})?\/\d{7})(v\d+)?$/);
  return legacy ? { base: legacy[1], version: legacy[2] || null } : null;
}

export function normalisePmid(value: string | number | null | undefined) {
  const pmid = String(value ?? '').trim().replace(/^pmid:\s*/i, '').replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//, '').replace(/\/$/, '');
  return /^\d{1,9}$/.test(pmid) ? String(Number(pmid)) : null;
}

export function normalisePmcid(value: string | null | undefined) {
  const pmcid = String(value ?? '').trim().toUpperCase().replace(/^HTTPS?:\/\/(?:WWW\.)?NCBI\.NLM\.NIH\.GOV\/PMC\/ARTICLES\//, '').replace(/\/$/, '');
  if (/^PMC\d+$/.test(pmcid)) return pmcid;
  return /^\d+$/.test(pmcid) ? `PMC${pmcid}` : null;
}

export function normaliseOpenAlexId(value: string | null | undefined) {
  const id = String(value ?? '').trim().replace(/^https?:\/\/openalex\.org\//i, '').toUpperCase();
  return /^W\d+$/.test(id) ? id : null;
}

export function normaliseSemanticScholarId(value: string | null | undefined) {
  const id = String(value ?? '').trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(id) ? id : null;
}

export function normaliseCoreId(value: string | number | null | undefined) {
  const id = String(value ?? '').trim();
  return /^\d{1,12}$/.test(id) ? String(Number(id)) : null;
}

/** Title for identity comparison: markup-free, case-folded, without punctuation or Arabic diacritics and tatweel. */
export function identityTitle(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A year WAHA can use; 0, NaN and implausible values are missing. */
export function identityYear(value: number | null | undefined) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1000 && year <= new Date().getUTCFullYear() + 1 ? year : null;
}

/** The first author's family name, normalised; null when it cannot be read. */
export function firstAuthorFamily(authors: string[]) {
  const author = (authors[0] || '').trim();
  if (!author) return null;
  const family = author.includes(',') ? author.split(',')[0] : author.split(/\s+/).pop() || '';
  return identityTitle(family) || null;
}

/**
 * The record's identifiers. Provider record IDs come only from the explicit
 * providerIds field and must match the provider's ID format, so a title (which
 * some providers used as a fallback `id`) is never treated as an identifier.
 * An arXiv DOI (10.48550/arXiv.*) is the arXiv identifier, not a publisher DOI.
 */
export function identifiersOf(paper: Pick<AcademicPaper, 'doi' | 'arxivId' | 'pmid' | 'pmcid' | 'providerIds'>): ScholarlyIdentifiers {
  const identifiers: ScholarlyIdentifiers = {};
  const doi = normaliseDoi(paper.doi);
  const arxiv = normaliseArxivId(paper.arxivId) || (doi?.startsWith(ARXIV_DOI_PREFIX) ? normaliseArxivId(doi.slice(ARXIV_DOI_PREFIX.length)) : null);
  if (doi && !doi.startsWith(ARXIV_DOI_PREFIX)) identifiers.doi = doi;
  if (arxiv) {
    identifiers.arxiv = arxiv.base;
    if (arxiv.version) identifiers.arxivVersion = arxiv.version;
  }
  const pmid = normalisePmid(paper.pmid);
  if (pmid) identifiers.pmid = pmid;
  const pmcid = normalisePmcid(paper.pmcid);
  if (pmcid) identifiers.pmcid = pmcid;
  const openalex = normaliseOpenAlexId(paper.providerIds?.openalex);
  if (openalex) identifiers.openalex = openalex;
  const semanticScholar = normaliseSemanticScholarId(paper.providerIds?.semantic_scholar);
  if (semanticScholar) identifiers.semantic_scholar = semanticScholar;
  const core = normaliseCoreId(paper.providerIds?.core);
  if (core) identifiers.core = core;
  return identifiers;
}

export type IdentityDecision =
  | { same: true; basis: 'doi' | 'pmid' | 'pmcid' | 'arxiv' | 'provider_id' | 'metadata_match' }
  | { same: false; reason: 'doi_conflict' | 'pmid_conflict' | 'pmcid_conflict' | 'arxiv_conflict' | 'preprint_and_published' | 'uncertain' };

const MIN_FALLBACK_TITLE_TOKENS = 4;

/** Exact metadata fingerprint used only when no identifier decides identity. */
export function metadataFingerprint(paper: Pick<AcademicPaper, 'title' | 'year' | 'authors'>) {
  const title = identityTitle(paper.title);
  const year = identityYear(paper.year);
  const family = firstAuthorFamily(paper.authors);
  if (title.split(' ').length < MIN_FALLBACK_TITLE_TOKENS || !year || !family) return null;
  return `${title}|${year}|${family}`;
}

function metadataMatch(first: AcademicPaper, second: AcademicPaper) {
  const title = identityTitle(first.title);
  if (title.split(' ').length < MIN_FALLBACK_TITLE_TOKENS || title !== identityTitle(second.title)) return false;
  const firstYear = identityYear(first.year);
  const secondYear = identityYear(second.year);
  // Both years are required: a missing year is uncertainty, not agreement.
  if (!firstYear || !secondYear || Math.abs(firstYear - secondYear) > 1) return false;
  const family = firstAuthorFamily(first.authors);
  return Boolean(family && family === firstAuthorFamily(second.authors));
}

/**
 * Whether two provider records are the same work, in priority order:
 * 1. Both have a (non-arXiv) DOI: equal means same, different means different.
 * 2. Different PMID, PMCID or base arXiv ID: different works.
 * 3. A preprint record (arXiv ID, no publisher DOI) and a record with a
 *    publisher DOI: different works. A preprint and its version of record stay
 *    separate, even when a provider lists the arXiv ID on the published record.
 * 4. Same PMID or PMCID: same work.
 * 5. Same base arXiv ID (any version): same work.
 * 6. Same OpenAlex, Semantic Scholar or CORE record ID: same work.
 * 7. Fallback: identical normalised title of at least four words, both years
 *    present and within one, and the same first-author family name.
 * Anything else is uncertain and the records stay separate.
 */
export function compareIdentity(first: AcademicPaper, second: AcademicPaper): IdentityDecision {
  const a = identifiersOf(first);
  const b = identifiersOf(second);
  if (a.doi && b.doi) return a.doi === b.doi ? { same: true, basis: 'doi' } : { same: false, reason: 'doi_conflict' };
  // Raw DOIs (including arXiv DOIs) that differ are also different works.
  const rawFirst = normaliseDoi(first.doi);
  const rawSecond = normaliseDoi(second.doi);
  if (rawFirst && rawSecond && rawFirst !== rawSecond) return { same: false, reason: 'doi_conflict' };
  for (const scheme of ['pmid', 'pmcid', 'arxiv'] as const) {
    if (a[scheme] && b[scheme] && a[scheme] !== b[scheme]) return { same: false, reason: `${scheme}_conflict` };
  }
  if ((a.arxiv && !a.doi && b.doi) || (b.arxiv && !b.doi && a.doi)) return { same: false, reason: 'preprint_and_published' };
  if (a.pmid && a.pmid === b.pmid) return { same: true, basis: 'pmid' };
  if (a.pmcid && a.pmcid === b.pmcid) return { same: true, basis: 'pmcid' };
  if (a.arxiv && a.arxiv === b.arxiv) return { same: true, basis: 'arxiv' };
  for (const scheme of PROVIDER_ID_SCHEMES) {
    if (a[scheme] && a[scheme] === b[scheme]) return { same: true, basis: 'provider_id' };
  }
  if (metadataMatch(first, second)) return { same: true, basis: 'metadata_match' };
  return { same: false, reason: 'uncertain' };
}

/**
 * Providers in the order their bibliographic metadata is preferred as the
 * identity source of a merged record: registries first, then curated indexes,
 * then aggregators and repositories.
 */
const IDENTITY_PRIORITY: Partial<Record<AcademicProvider, number>> = {
  crossref: 70, datacite: 70, pubmed: 60, 'europe-pmc': 60, openalex: 50, 'semantic-scholar': 40, arxiv: 30, plos: 30,
};

export function identityPriority(provider: AcademicProvider) {
  return IDENTITY_PRIORITY[provider] ?? 10;
}
