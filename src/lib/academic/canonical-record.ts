// Builds the input that resolve_scholarly_works (migration 20261005000000)
// resolves to a canonical scholarly work, from one deduplicated search record.
//
// Identity-bearing fields come from the record's identity source (its anchor
// provider, see mergePaper) and each field states where it came from. No
// abstract is included: permanent storage terms for provider abstracts have not
// been verified, so abstracts stay in the 24-hour search snapshot only.
import type { AcademicPaper, ProvenanceSource } from './integrations/types';
import {
  firstAuthorFamily,
  identifiersOf,
  identityPriority,
  identityTitle,
  identityYear,
  metadataFingerprint,
  type IdentifierScheme,
} from './identity';

type FieldOrigin = { source: string; corroboratedBy?: string[]; observedAt: string; method: 'provider_record' | 'enrichment' };

export type CanonicalRecordInput = {
  identifiers: Partial<Record<IdentifierScheme, string>>;
  assertedBy: string[];
  fingerprint: string | null;
  identitySource: string;
  identityPriority: number;
  fields: {
    title: string;
    normalizedTitle: string;
    authors: string[];
    firstAuthorFamily: string | null;
    publicationYear: number | null;
    venue: string | null;
    publisher: string | null;
    volume: string | null;
    issue: string | null;
    pages: string | null;
    issn: string[];
    publicationType: string | null;
    landingUrl: string | null;
    oaUrl: string | null;
    isOpenAccess: boolean;
  };
  citationCounts: Record<string, { value: number; observedAt: string }>;
  fieldProvenance: Record<string, FieldOrigin & { assertedBy?: string[]; status?: 'registry_record' | 'provider_asserted' }>;
};

const REGISTRIES = new Set<string>(['crossref', 'datacite']);
const ENRICHMENT_SOURCES = new Set<string>(['unpaywall', 'opencitations']);

function text(value: string | null | undefined, max = 1_000) {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function canonicalRecordFrom(paper: AcademicPaper, observedAt: string): CanonicalRecordInput {
  const identifiers = identifiersOf(paper);
  delete identifiers.arxivVersion;
  const source = paper.source;
  const provenanceOf = (field: string) => paper.fieldProvenance?.[field] || [];
  const origin = (field: string): FieldOrigin => {
    const corroboratedBy = provenanceOf(field).filter((provider) => provider !== source);
    return { source, ...(corroboratedBy.length ? { corroboratedBy } : {}), observedAt, method: 'provider_record' };
  };
  // A link or count supplied by an enrichment service is attributed to it.
  const supplied = (field: 'pdfUrl' | 'url'): FieldOrigin => {
    const supplier: ProvenanceSource = provenanceOf(field)[0] || source;
    return { source: supplier, observedAt, method: ENRICHMENT_SOURCES.has(supplier) ? 'enrichment' : 'provider_record' };
  };
  const venue = text(paper.journal || paper.containerTitle);
  const fieldProvenance: CanonicalRecordInput['fieldProvenance'] = {
    title: origin('title'),
    authors: origin('authors'),
    year: origin('year'),
  };
  if (venue) fieldProvenance.venue = origin('journal');
  for (const field of ['publisher', 'volume', 'issue', 'pages'] as const) if (text(paper[field])) fieldProvenance[field] = origin(field);
  if (identifiers.doi) {
    // Which sources returned this DOI. A registry record is not verification
    // of the work; it only says where the identifier came from.
    const assertedBy = [...new Set([...provenanceOf('doi'), source])];
    fieldProvenance.doi = { source, assertedBy, observedAt, method: 'provider_record', status: assertedBy.some((provider) => REGISTRIES.has(provider)) ? 'registry_record' : 'provider_asserted' };
  }
  if (paper.pdfUrl) fieldProvenance.oaUrl = supplied('pdfUrl');
  if (paper.url) fieldProvenance.landingUrl = supplied('url');

  const counts = paper.citationCounts || { [source]: paper.citationCount };
  const citationCounts = Object.fromEntries(Object.entries(counts)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0)
    .map(([provider, value]) => [provider, { value, observedAt }]));

  return {
    identifiers,
    assertedBy: [...new Set([...paper.sources, source])],
    fingerprint: Object.keys(identifiers).length ? null : metadataFingerprint(paper),
    identitySource: source,
    identityPriority: identityPriority(source),
    fields: {
      title: paper.title.trim().slice(0, 2_000),
      normalizedTitle: identityTitle(paper.title),
      authors: paper.authors.slice(0, 100).map((author) => author.slice(0, 300)),
      firstAuthorFamily: firstAuthorFamily(paper.authors),
      publicationYear: identityYear(paper.year),
      venue,
      publisher: text(paper.publisher),
      volume: text(paper.volume, 50),
      issue: text(paper.issue, 50),
      pages: text(paper.pages, 50),
      issn: (paper.issn || []).filter((value) => /^\d{4}-\d{3}[\dX]$/i.test(value)).map((value) => value.toUpperCase()),
      publicationType: text(paper.publicationType, 100),
      landingUrl: paper.url,
      oaUrl: paper.pdfUrl,
      isOpenAccess: Boolean(paper.openAccess || paper.pdfUrl),
    },
    citationCounts,
    fieldProvenance,
  };
}
