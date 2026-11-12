import { fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type Bibjson = {
  title?: string; abstract?: string; year?: string;
  author?: Array<{ name?: string }>;
  identifier?: Array<{ type?: string; id?: string }>;
  journal?: { title?: string; publisher?: string; issns?: string[]; volume?: string; number?: string };
  start_page?: string; end_page?: string;
  link?: Array<{ type?: string; url?: string; content_type?: string }>;
  keywords?: string[]; subject?: Array<{ term?: string }>;
};
type Result = { id?: string; bibjson?: Bibjson };

const text = (value: unknown) => (typeof value === 'string' ? stripMarkup(value) : '');
/** DOAJ reads the path as an Elasticsearch query string; its operators are removed so a title stays plain words. */
export const doajQuery = (query: string) => query.replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Articles from journals listed in the Directory of Open Access Journals
 * (DOC-31-04). No key is needed; every record is open access by listing,
 * and only what DOAJ states is kept.
 */
export class DOAJService implements AcademicSearchProvider {
  readonly id = 'doaj' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const terms = doajQuery(query);
    if (!terms) return [];
    const url = new URL(`https://doaj.org/api/search/articles/${encodeURIComponent(terms)}`);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', String(Math.min(20, Math.max(1, limit))));
    const data = await fetchJson<{ results?: Result[] }>(url);
    return (data.results || []).flatMap((result) => {
      const record = result.bibjson || {};
      const title = text(record.title);
      if (!result.id || !title) return [];
      const fulltext = (record.link || []).find((link) => link.type === 'fulltext' && link.url);
      const link = safeUrl(fulltext?.url);
      const journal = record.journal || {};
      const pages = [text(record.start_page), text(record.end_page)].filter(Boolean).join('-') || null;
      const subjects = [...new Set([...(record.subject || []).map((subject) => text(subject.term)), ...(record.keywords || []).map(text)].filter(Boolean))];
      return [{
        id: `doaj:${result.id}`, title, abstract: text(record.abstract), year: Number(record.year) || 0, citationCount: 0,
        authors: (record.author || []).map((author) => text(author.name)).filter(Boolean),
        doi: normaliseDoi((record.identifier || []).find((identifier) => identifier.type?.toLowerCase() === 'doi')?.id),
        pdfUrl: /pdf/i.test(fulltext?.content_type || '') ? link : null, url: link,
        source: this.id, sources: [this.id], subjects, publicationType: 'journal-article', openAccess: true,
        journal: text(journal.title) || null, containerTitle: text(journal.title) || null, publisher: text(journal.publisher) || null,
        issn: (journal.issns || []).filter(Boolean), volume: text(journal.volume) || null, issue: text(journal.number) || null, pages,
      } satisfies AcademicPaper];
    });
  }
}
