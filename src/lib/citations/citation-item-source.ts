import type { CitationItem } from './types';
import { bibliographyFromReference, readWritingBibliography } from './writing-bibliography';
import { normaliseDoi, safeUrl } from '@/lib/academic/integrations/normalization';

export function citationItemKey(item: CitationItem) {
  const doi = normaliseDoi(item.doi);
  return doi ? `doi:${doi}` : `reference:${item.id}`;
}

export function citationItemSource(item: CitationItem) {
  const bibliography = readWritingBibliography(item.bibliography) || bibliographyFromReference({ authors: item.authors, publication_title: item.journal, doi: item.doi,
    citation_data: { type: item.type, publisher: item.publisher, volume: item.volume, issue: item.issue, pages: item.pages } });
  return { id: item.id, kind: 'reference' as const, title: item.title, year: item.year, url: safeUrl(item.url), origin: 'supplied-citation-metadata', bibliography: { ...bibliography, doi: normaliseDoi(item.doi) } };
}
