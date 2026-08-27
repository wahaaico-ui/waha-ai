import { fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type Doc = { id?: string; title_display?: string; title?: string; abstract?: string[]; author_display?: string[]; publication_date?: string; article_type?: string; subject?: string[] };
type Response = { response?: { docs?: Doc[] } };

export class PLOSService implements AcademicSearchProvider {
  readonly id = 'plos' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://api.plos.org/search'); url.searchParams.set('q', query); url.searchParams.set('wt', 'json'); url.searchParams.set('rows', String(Math.min(10, limit))); url.searchParams.set('fl', 'id,title_display,title,abstract,author_display,publication_date,article_type,subject');
    const payload = await fetchJson<Response>(url, undefined, { retries: 0, timeoutMs: 15_000 });
    return (payload.response?.docs || []).flatMap((work) => { const title = stripMarkup(work.title_display || work.title); if (!title) return []; const doi = normaliseDoi(work.id); const url = doi ? `https://doi.org/${doi}` : null; return [{ id: work.id || title, title, abstract: stripMarkup(work.abstract?.join(' ')), year: Number(work.publication_date?.slice(0, 4)) || 0, citationCount: 0, authors: work.author_display || [], doi, pdfUrl: null, url: safeUrl(url), source: this.id, sources: [this.id], subjects: work.subject || [], publicationType: work.article_type || 'article', openAccess: true } satisfies AcademicPaper]; });
  }
}
