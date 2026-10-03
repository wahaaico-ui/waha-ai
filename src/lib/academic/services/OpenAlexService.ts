import { APPLICATION_EMAIL, fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';
import { normalisePmcid, normalisePmid } from '../identity';

export interface OpenAlexPaper {
  id: string;
  openalexId: string | null;
  pmid: string | null;
  pmcid: string | null;
  title: string;
  doi: string | null;
  publicationYear: number;
  citedByCount: number;
  authors: string[];
  pdfUrl: string | null;
  abstract: string;
  url: string | null;
  subjects: string[];
  journal: string | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  orcidIds: string[];
  publicationType: string | null;
  referencedWorksCount: number;
}

type OpenAlexResponse = { results?: Array<Record<string, unknown>> };

function abstractFromIndex(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const words: Record<number, string> = {};
  for (const [word, positions] of Object.entries(value)) {
    if (Array.isArray(positions)) positions.forEach((position) => { if (typeof position === 'number') words[position] = word; });
  }
  return Object.keys(words).map(Number).sort((a, b) => a - b).map((position) => words[position]).join(' ').slice(0, 4_000);
}

export class OpenAlexService implements AcademicSearchProvider {
  public readonly id = 'openalex' as const;

  public static async searchWorks(query: string, perPage: number = 10): Promise<OpenAlexPaper[]> {
    const params = new URLSearchParams({ search: query, 'per-page': String(Math.min(100, Math.max(1, perPage))), mailto: APPLICATION_EMAIL });
    if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
    const data = await fetchJson<OpenAlexResponse>(`https://api.openalex.org/works?${params}`);
    return (data.results || []).flatMap((work) => {
      const title = typeof work.title === 'string' ? work.title.trim() : '';
      if (!title) return [];
      const authorships = Array.isArray(work.authorships) ? work.authorships as Array<{ author?: { display_name?: string; orcid?: string } }> : [];
      const topics = Array.isArray(work.topics) ? work.topics as Array<{ display_name?: string }> : [];
      const openAccess = work.open_access && typeof work.open_access === 'object' ? work.open_access as { oa_url?: string } : {};
      const primary = work.primary_location && typeof work.primary_location === 'object' ? work.primary_location as { landing_page_url?: string; pdf_url?: string; source?: { display_name?: string; host_organization_name?: string } } : {};
      const ids = work.ids && typeof work.ids === 'object' ? work.ids as { pmid?: string; pmcid?: string } : {};
      const biblio = work.biblio && typeof work.biblio === 'object' ? work.biblio as { volume?: string; issue?: string; first_page?: string; last_page?: string } : {};
      return [{
        id: typeof work.id === 'string' ? work.id : title,
        // The OpenAlex work ID only when OpenAlex supplied one; never the title.
        openalexId: typeof work.id === 'string' ? work.id : null,
        pmid: typeof ids.pmid === 'string' ? ids.pmid : null,
        pmcid: typeof ids.pmcid === 'string' ? ids.pmcid : null,
        title,
        doi: normaliseDoi(typeof work.doi === 'string' ? work.doi : null),
        publicationYear: typeof work.publication_year === 'number' ? work.publication_year : 0,
        citedByCount: typeof work.cited_by_count === 'number' ? work.cited_by_count : 0,
        authors: authorships.map((entry) => entry.author?.display_name || '').filter(Boolean),
        pdfUrl: safeUrl(primary.pdf_url || openAccess.oa_url),
        abstract: abstractFromIndex(work.abstract_inverted_index),
        url: safeUrl(primary.landing_page_url || (typeof work.id === 'string' ? work.id : null)),
        subjects: topics.map((topic) => topic.display_name || '').filter(Boolean),
        journal: primary.source?.display_name || null,
        publisher: primary.source?.host_organization_name || null,
        volume: biblio.volume || null,
        issue: biblio.issue || null,
        pages: [biblio.first_page, biblio.last_page].filter(Boolean).join('-') || null,
        orcidIds: authorships.map((entry) => entry.author?.orcid?.replace(/^https?:\/\/orcid\.org\//, '') || '').filter(Boolean),
        publicationType: typeof work.type === 'string' ? work.type : null,
        referencedWorksCount: typeof work.referenced_works_count === 'number' ? work.referenced_works_count : 0,
      }];
    });
  }

  public async search(options: SearchOptions): Promise<AcademicPaper[]> {
    return (await OpenAlexService.searchWorks(options.query, options.limit)).map((paper) => ({
      id: paper.id, title: paper.title, abstract: paper.abstract, year: paper.publicationYear,
      citationCount: paper.citedByCount, authors: paper.authors, doi: paper.doi, pdfUrl: paper.pdfUrl,
      url: paper.url, source: this.id, sources: [this.id], subjects: paper.subjects,
      publicationType: paper.publicationType || 'article', openAccess: Boolean(paper.pdfUrl),
      journal: paper.journal, containerTitle: paper.journal, publisher: paper.publisher,
      volume: paper.volume, issue: paper.issue, pages: paper.pages, orcidIds: paper.orcidIds,
      referencedWorksCount: paper.referencedWorksCount,
      pmid: normalisePmid(paper.pmid), pmcid: normalisePmcid(paper.pmcid),
      providerIds: paper.openalexId ? { openalex: paper.openalexId } : undefined,
      fieldProvenance: { title: [this.id], doi: [this.id], authors: [this.id], year: [this.id], journal: [this.id], citationCount: [this.id], orcidIds: [this.id] },
    }));
  }
}
