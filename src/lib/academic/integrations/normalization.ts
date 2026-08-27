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

export function mergePaper(first: AcademicPaper, second: AcademicPaper): AcademicPaper {
  const preferred = metadataScore(second) > metadataScore(first) ? second : first;
  const fallback = preferred === first ? second : first;
  return {
    ...preferred,
    id: normaliseDoi(first.doi || second.doi) || preferred.id,
    doi: normaliseDoi(first.doi || second.doi),
    abstract: preferred.abstract || fallback.abstract,
    authors: preferred.authors.length >= fallback.authors.length ? preferred.authors : fallback.authors,
    year: preferred.year || fallback.year,
    citationCount: Math.max(first.citationCount, second.citationCount),
    pdfUrl: preferred.pdfUrl || fallback.pdfUrl,
    url: preferred.url || fallback.url,
    sources: [...new Set([...first.sources, ...second.sources, first.source, second.source])],
    subjects: [...new Set([...first.subjects, ...second.subjects])].slice(0, 20),
    publicationType: preferred.publicationType || fallback.publicationType,
    openAccess: first.openAccess || second.openAccess || Boolean(first.pdfUrl || second.pdfUrl),
    journal: preferred.journal || fallback.journal || null,
    containerTitle: preferred.containerTitle || fallback.containerTitle || null,
    publisher: preferred.publisher || fallback.publisher || null,
    volume: preferred.volume || fallback.volume || null,
    issue: preferred.issue || fallback.issue || null,
    pages: preferred.pages || fallback.pages || null,
    pmid: preferred.pmid || fallback.pmid || null,
    pmcid: preferred.pmcid || fallback.pmcid || null,
    arxivId: preferred.arxivId || fallback.arxivId || null,
    orcidIds: [...new Set([...(first.orcidIds || []), ...(second.orcidIds || [])])],
    issn: [...new Set([...(first.issn || []), ...(second.issn || [])])],
    isbn: [...new Set([...(first.isbn || []), ...(second.isbn || [])])],
    license: preferred.license || fallback.license || null,
    referencedWorksCount: Math.max(first.referencedWorksCount || 0, second.referencedWorksCount || 0),
    fieldProvenance: {
      ...(first.fieldProvenance || {}),
      ...(second.fieldProvenance || {}),
      title: [...new Set([...(first.fieldProvenance?.title || [first.source]), ...(second.fieldProvenance?.title || [second.source])])],
      doi: [...new Set([...(first.fieldProvenance?.doi || (first.doi ? [first.source] : [])), ...(second.fieldProvenance?.doi || (second.doi ? [second.source] : []))])],
      authors: [...new Set([...(first.fieldProvenance?.authors || [first.source]), ...(second.fieldProvenance?.authors || [second.source])])],
    },
  };
}

export function deduplicatePapers(papers: AcademicPaper[]) {
  const records = new Map<string, AcademicPaper>();
  for (const paper of papers) {
    const exactKey = recordKey(paper);
    const title = normaliseTitle(paper.title);
    const existingEntry = [...records.entries()].find(([key, candidate]) =>
      key === exactKey || (title.length > 12 && normaliseTitle(candidate.title) === title && (!paper.year || !candidate.year || Math.abs(paper.year - candidate.year) <= 1)),
    );
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
