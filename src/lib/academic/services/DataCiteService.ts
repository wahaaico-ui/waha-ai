import { APPLICATION_USER_AGENT, fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl, stripMarkup } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';

type Item = { id?: string; attributes?: { doi?: string; titles?: Array<{ title?: string }>; descriptions?: Array<{ description?: string; descriptionType?: string }>; creators?: Array<{ name?: string }>; publicationYear?: number; citationCount?: number; subjects?: Array<{ subject?: string }>; types?: { resourceTypeGeneral?: string }; url?: string; contentUrl?: string[]; rightsList?: Array<{ rightsUri?: string; rights?: string }> } };
type Response = { data?: Item[] };

export class DataCiteService implements AcademicSearchProvider {
  readonly id = 'datacite' as const;
  async search({ query, limit }: SearchOptions): Promise<AcademicPaper[]> {
    const url = new URL('https://api.datacite.org/dois'); url.searchParams.set('query', query); url.searchParams.set('page[size]', String(Math.min(25, limit)));
    const payload = await fetchJson<Response>(url, { headers: { 'User-Agent': APPLICATION_USER_AGENT } });
    return (payload.data || []).flatMap((item) => { const work = item.attributes; const title = stripMarkup(work?.titles?.[0]?.title); if (!work || !title) return []; const pdf = work.contentUrl?.find((value) => /\.pdf(?:$|\?)/i.test(value)); const open = (work.rightsList || []).some((right) => /creative commons|open/i.test(`${right.rights} ${right.rightsUri}`)); return [{ id: item.id || work.doi || title, title, abstract: stripMarkup(work.descriptions?.find((value) => value.descriptionType === 'Abstract')?.description || work.descriptions?.[0]?.description), year: work.publicationYear || 0, citationCount: work.citationCount || 0, authors: (work.creators || []).map((creator) => creator.name || '').filter(Boolean), doi: normaliseDoi(work.doi || item.id), pdfUrl: safeUrl(pdf), url: safeUrl(work.url || (work.doi ? `https://doi.org/${work.doi}` : null)), source: this.id, sources: [this.id], subjects: (work.subjects || []).map((subject) => subject.subject || '').filter(Boolean), publicationType: work.types?.resourceTypeGeneral || null, openAccess: open || Boolean(pdf) } satisfies AcademicPaper]; });
  }
}
