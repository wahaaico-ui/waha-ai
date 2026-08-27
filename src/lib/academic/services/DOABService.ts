import { fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type Metadata = { key?: string; value?: string };
type Item = { uuid?: string; handle?: string; name?: string; metadata?: Metadata[]; bitstreams?: Array<{ mimeType?: string; retrieveLink?: string; bundleName?: string }> };
const values = (item: Item, key: RegExp) => (item.metadata || []).filter((field) => key.test(field.key || '')).map((field) => stripMarkup(field.value)).filter(Boolean);

export class DOABService implements AcademicSearchProvider {
  readonly id = 'doab' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://directory.doabooks.org/rest/search'); url.searchParams.set('query', query); url.searchParams.set('limit', String(Math.min(20, limit))); url.searchParams.set('expand', 'metadata,bitstreams');
    const items = await fetchJson<Item[]>(url);
    return items.flatMap((item) => { const title = values(item, /^dc\.title$/i)[0] || stripMarkup(item.name); if (!title) return []; const doi = normaliseDoi(values(item, /identifier\.doi/i)[0] || values(item, /^dc\.identifier$/i).find((value) => value.includes('10.'))); const pdfPath = item.bitstreams?.find((bitstream) => bitstream.mimeType === 'application/pdf' || bitstream.bundleName === 'ORIGINAL')?.retrieveLink; const pdfUrl = safeUrl(pdfPath ? new URL(pdfPath, 'https://directory.doabooks.org').toString() : null); return [{ id: item.uuid || item.handle || doi || title, title, abstract: values(item, /^dc\.description\.abstract$/i)[0] || values(item, /^dc\.description$/i)[0] || '', year: Number(values(item, /^dc\.date\.issued$/i)[0]?.slice(0, 4)) || 0, citationCount: 0, authors: values(item, /^dc\.contributor\.author$|^dc\.creator$/i), doi, pdfUrl, url: safeUrl(item.handle ? `https://directory.doabooks.org/handle/${item.handle}` : null), source: this.id, sources: [this.id], subjects: values(item, /^dc\.subject/i), publicationType: 'book', openAccess: true } satisfies AcademicPaper]; });
  }
}
