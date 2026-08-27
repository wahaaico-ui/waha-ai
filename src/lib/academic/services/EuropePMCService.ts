import { fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type Result = { id?: string; pmid?: string; pmcid?: string; doi?: string; title?: string; abstractText?: string; pubYear?: string; citedByCount?: number; authorString?: string; authorList?: { author?: Array<{ fullName?: string }> }; isOpenAccess?: string; fullTextUrlList?: { fullTextUrl?: Array<{ url?: string; documentStyle?: string }> }; pubTypeList?: { pubType?: string[] }; meshHeadingList?: { meshHeading?: Array<{ descriptorName?: string }> } };
type Response = { resultList?: { result?: Result[] } };

export class EuropePMCService implements AcademicSearchProvider {
  readonly id = 'europe-pmc' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query', query); url.searchParams.set('format', 'json'); url.searchParams.set('resultType', 'core'); url.searchParams.set('pageSize', String(Math.min(25, limit)));
    const payload = await fetchJson<Response>(url);
    return (payload.resultList?.result || []).flatMap((work) => { const title = stripMarkup(work.title); if (!title) return []; const pdf = work.fullTextUrlList?.fullTextUrl?.find((item) => /pdf/i.test(item.documentStyle || '') || /\.pdf/i.test(item.url || ''))?.url; return [{ id: work.pmcid || work.pmid || work.id || work.doi || title, title, abstract: stripMarkup(work.abstractText), year: Number(work.pubYear) || 0, citationCount: work.citedByCount || 0, authors: work.authorList?.author?.map((author) => author.fullName || '').filter(Boolean) || work.authorString?.split(',').map((value) => value.trim()).filter(Boolean) || [], doi: normaliseDoi(work.doi), pdfUrl: safeUrl(pdf), url: safeUrl(work.pmcid ? `https://europepmc.org/articles/${work.pmcid}` : work.pmid ? `https://europepmc.org/article/MED/${work.pmid}` : null), source: this.id, sources: [this.id], subjects: (work.meshHeadingList?.meshHeading || []).map((item) => item.descriptorName || '').filter(Boolean), publicationType: work.pubTypeList?.pubType?.[0] || 'article', openAccess: work.isOpenAccess === 'Y' || Boolean(pdf), pmid: work.pmid || null, pmcid: work.pmcid || null, fieldProvenance: { title: [this.id], authors: [this.id], doi: [this.id], pmid: [this.id], pmcid: [this.id] } } satisfies AcademicPaper]; });
  }
}
