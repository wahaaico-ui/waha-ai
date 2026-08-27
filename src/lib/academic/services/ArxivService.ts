import { APPLICATION_USER_AGENT, fetchText } from '../integrations/http';
import { safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

const tag = (xml: string, name: string) => stripMarkup(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);
const tags = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'gi'))].map((match) => stripMarkup(match[1])).filter(Boolean);

export class ArxivService implements AcademicSearchProvider {
  readonly id = 'arxiv' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://export.arxiv.org/api/query');
    url.searchParams.set('search_query', `all:"${query.replace(/["\r\n]/g, ' ')}"`); url.searchParams.set('start', '0'); url.searchParams.set('max_results', String(Math.min(20, limit)));
    const xml = await fetchText(url, { headers: { 'User-Agent': APPLICATION_USER_AGENT, Accept: 'application/atom+xml' } }, { retries: 0, timeoutMs: 15_000 });
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].flatMap((match) => {
      const entry = match[1]; const title = tag(entry, 'title'); if (!title) return [];
      const id = tag(entry, 'id'); const pdf = entry.match(/<link[^>]+href="([^"]+)"[^>]+type="application\/pdf"/i)?.[1]?.replace(/^http:/, 'https:') || null;
      const arxivId = id.split('/abs/').pop() || id.split('/').pop() || null;
      return [{ id, title, abstract: tag(entry, 'summary'), year: Number(tag(entry, 'published').slice(0, 4)) || 0, citationCount: 0, authors: tags(entry, 'name'), doi: null, pdfUrl: safeUrl(pdf), url: safeUrl(id), source: this.id, sources: [this.id], subjects: [...entry.matchAll(/<category[^>]+term="([^"]+)"/gi)].map((item) => item[1]), publicationType: 'preprint', openAccess: true, arxivId, fieldProvenance: { title: [this.id], authors: [this.id], year: [this.id], arxivId: [this.id] } } satisfies AcademicPaper];
    });
  }
}
