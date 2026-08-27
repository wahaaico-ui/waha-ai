import { APPLICATION_EMAIL, fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type SearchResponse = { esearchresult?: { idlist?: string[] } };
type Author = { name?: string };
type Summary = { uid?: string; title?: string; pubdate?: string; sortpubdate?: string; authors?: Author[]; articleids?: Array<{ idtype?: string; value?: string }>; fulljournalname?: string; pubtype?: string[] };
type SummaryResponse = { result?: Record<string, Summary | string[]> };

export class PubMedService implements AcademicSearchProvider {
  readonly id = 'pubmed' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const common = { db: 'pubmed', retmode: 'json', tool: 'WAHA_AI', email: APPLICATION_EMAIL };
    const apiKey = process.env.NCBI_API_KEY;
    const search = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'); Object.entries({ ...common, term: query, retmax: String(Math.min(25, limit)), ...(apiKey ? { api_key: apiKey } : {}) }).forEach(([key, value]) => search.searchParams.set(key, value));
    const ids = (await fetchJson<SearchResponse>(search)).esearchresult?.idlist || []; if (!ids.length) return [];
    const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi'); Object.entries({ ...common, id: ids.join(','), ...(apiKey ? { api_key: apiKey } : {}) }).forEach(([key, value]) => summaryUrl.searchParams.set(key, value));
    const payload = await fetchJson<SummaryResponse>(summaryUrl); const records = payload.result || {};
    return ids.flatMap((id) => { const work = records[id]; if (!work || Array.isArray(work)) return []; const title = stripMarkup(work.title); if (!title) return []; const doi = normaliseDoi(work.articleids?.find((item) => item.idtype === 'doi')?.value); return [{ id, title, abstract: '', year: Number((work.sortpubdate || work.pubdate)?.slice(0, 4)) || 0, citationCount: 0, authors: (work.authors || []).map((author) => author.name || '').filter(Boolean), doi, pdfUrl: null, url: safeUrl(`https://pubmed.ncbi.nlm.nih.gov/${id}/`), source: this.id, sources: [this.id], subjects: work.fulljournalname ? [work.fulljournalname] : [], publicationType: work.pubtype?.[0] || 'article', openAccess: false, pmid: id, journal: work.fulljournalname || null, containerTitle: work.fulljournalname || null, fieldProvenance: { title: [this.id], authors: [this.id], doi: [this.id], pmid: [this.id], journal: [this.id] } } satisfies AcademicPaper]; });
  }
}
