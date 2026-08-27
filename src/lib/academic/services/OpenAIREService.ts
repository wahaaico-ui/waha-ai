import { fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type Product = { id?: string; mainTitle?: string; descriptions?: string[] | null; publicationDate?: string; citationCount?: number; authors?: Array<{ fullName?: string }>; pids?: Array<{ scheme?: string; value?: string }>; subjects?: Array<{ subject?: { value?: string } }>; type?: string; bestAccessRight?: { label?: string }; documentationUrls?: string[] | null; instances?: Array<{ urls?: string[]; accessRight?: { label?: string } }> };
type Response = { results?: Product[] };

export class OpenAIREService implements AcademicSearchProvider {
  readonly id = 'openaire' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://api.openaire.eu/graph/v3/research-products');
    url.searchParams.set('search', query); url.searchParams.set('page', '1'); url.searchParams.set('pageSize', String(Math.min(25, limit)));
    const token = process.env.OPENAIRE_ACCESS_TOKEN;
    const payload = await fetchJson<Response>(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return (payload.results || []).flatMap((work) => { const title = stripMarkup(work.mainTitle); if (!title) return []; const doi = normaliseDoi(work.pids?.find((pid) => pid.scheme?.toLowerCase() === 'doi')?.value); const candidate = work.documentationUrls?.[0] || work.instances?.flatMap((instance) => instance.urls || [])[0]; return [{ id: work.id || doi || title, title, abstract: stripMarkup(work.descriptions?.[0]), year: Number(work.publicationDate?.slice(0, 4)) || 0, citationCount: work.citationCount || 0, authors: (work.authors || []).map((author) => author.fullName || '').filter(Boolean), doi, pdfUrl: /pdf/i.test(candidate || '') ? safeUrl(candidate) : null, url: safeUrl(candidate), source: this.id, sources: [this.id], subjects: (work.subjects || []).map((item) => item.subject?.value || '').filter(Boolean), publicationType: work.type || null, openAccess: /open/i.test(work.bestAccessRight?.label || '') } satisfies AcademicPaper]; });
  }
}
