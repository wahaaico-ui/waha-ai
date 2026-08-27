import { fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type CoreWork = { id?: number | string; title?: string; abstract?: string; yearPublished?: number; publishedDate?: string; citationCount?: number; authors?: Array<{ name?: string }>; doi?: string; downloadUrl?: string; fullTextIdentifier?: string; links?: Array<{ url?: string; type?: string }> };
type CoreResponse = { results?: CoreWork[] };

export class CoreService implements AcademicSearchProvider {
  readonly id = 'core' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://api.core.ac.uk/v3/search/works/');
    url.searchParams.set('q', query); url.searchParams.set('limit', String(Math.min(25, limit)));
    const key = process.env.CORE_API_KEY;
    const payload = await fetchJson<CoreResponse>(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
    return (payload.results || []).flatMap((work) => {
      const title = stripMarkup(work.title); if (!title) return [];
      const pdfUrl = safeUrl(work.downloadUrl || work.fullTextIdentifier || work.links?.find((link) => /pdf|download/i.test(link.type || ''))?.url);
      return [{ id: String(work.id || work.doi || title), title, abstract: stripMarkup(work.abstract), year: work.yearPublished || Number(work.publishedDate?.slice(0, 4)) || 0, citationCount: work.citationCount || 0, authors: (work.authors || []).map((author) => author.name || '').filter(Boolean), doi: normaliseDoi(work.doi), pdfUrl, url: pdfUrl, source: this.id, sources: [this.id], subjects: [], publicationType: 'article', openAccess: Boolean(pdfUrl) } satisfies AcademicPaper];
    });
  }
}
