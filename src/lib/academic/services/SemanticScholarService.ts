export interface SemanticPaper {
  paperId: string;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  url: string;
  authors: string[];
  doi: string | null;
  pdfUrl: string | null;
  venue: string | null;
  pmid: string | null;
  pmcid: string | null;
  arxivId: string | null;
  semanticScholarId: string | null;
}

type SemanticResponse = { data?: Array<{ paperId?: string; title?: string; abstract?: string | null; year?: number; citationCount?: number; url?: string; venue?: string; authors?: Array<{ name?: string }>; externalIds?: { DOI?: string; PubMed?: string; PubMedCentral?: string; ArXiv?: string }; openAccessPdf?: { url?: string } | null }> };

const RETRYABLE_STATUS_CODES = new Set([401, 403, 429]);

export class SemanticScholarService implements AcademicSearchProvider {
  public readonly id = 'semantic-scholar' as const;

  public static async searchPapers(query: string, limit: number = 10): Promise<SemanticPaper[]> {
    const params = new URLSearchParams({ query, limit: String(Math.min(100, Math.max(1, limit))), fields: 'title,abstract,year,citationCount,url,venue,authors,externalIds,openAccessPdf' });
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params}`;

    const primaryKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const backupKey = process.env.SEMANTIC_SCHOLAR_API_KEY_2;

    try {
      return await this.fetchAndMap(url, primaryKey);
    } catch (error) {
      const status = error instanceof ExternalApiError ? error.status : null;
      const canFallback = Boolean(backupKey) && backupKey !== primaryKey && status !== null && RETRYABLE_STATUS_CODES.has(status);
      if (!canFallback) throw error;
      console.error(`Semantic Scholar primary key failed (status ${status}), retrying with backup key`);
      return await this.fetchAndMap(url, backupKey);
    }
  }

  private static async fetchAndMap(url: string, apiKey?: string): Promise<SemanticPaper[]> {
    const headers: HeadersInit = apiKey ? { 'x-api-key': apiKey } : {};
    const data = await fetchJson<SemanticResponse>(url, { headers });
    return (data.data || []).flatMap((p) => p.title?.trim() ? [{
      paperId: p.paperId || p.title,
      // The Semantic Scholar paper ID only when the API supplied one; never the title.
      semanticScholarId: p.paperId || null,
      pmcid: p.externalIds?.PubMedCentral || null,
      title: p.title || 'عنوان غير متوفر',
      abstract: p.abstract || 'المستخلص غير متوفر',
      year: p.year || 0,
      citationCount: p.citationCount || 0,
      url: p.url || '',
      authors: (p.authors || []).map((author) => author.name || '').filter(Boolean),
      doi: normaliseDoi(p.externalIds?.DOI),
      pdfUrl: safeUrl(p.openAccessPdf?.url),
      venue: p.venue || null,
      pmid: p.externalIds?.PubMed || null,
      arxivId: p.externalIds?.ArXiv || null,
    }] : []);
  }

  public async search(options: SearchOptions): Promise<AcademicPaper[]> {
    return (await SemanticScholarService.searchPapers(options.query, options.limit)).map((paper) => ({
      id: paper.paperId, title: paper.title, abstract: paper.abstract, year: paper.year,
      citationCount: paper.citationCount, authors: paper.authors, doi: paper.doi, pdfUrl: paper.pdfUrl,
      url: safeUrl(paper.url), source: this.id, sources: [this.id], subjects: [],
      publicationType: 'article', openAccess: Boolean(paper.pdfUrl), journal: paper.venue,
      containerTitle: paper.venue, pmid: paper.pmid, arxivId: paper.arxivId, pmcid: normalisePmcid(paper.pmcid),
      providerIds: paper.semanticScholarId ? { semantic_scholar: paper.semanticScholarId } : undefined,
      fieldProvenance: { title: [this.id], doi: [this.id], authors: [this.id], year: [this.id], journal: [this.id], citationCount: [this.id] },
    }));
  }
}
import { ExternalApiError, fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';
import { normalisePmcid } from '../identity';
