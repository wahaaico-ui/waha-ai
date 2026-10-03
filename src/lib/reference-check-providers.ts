// The indexes used by the reference check: Crossref and OpenAlex, reached
// through the existing academic services. A 404 for a DOI means the index has
// no record for it; any other failure is thrown so that the reference is
// reported as not checked rather than not found.

import { CrossrefService } from '@/lib/academic/services/CrossrefService';
import { OpenAlexService } from '@/lib/academic/services/OpenAlexService';
import { APPLICATION_EMAIL, APPLICATION_USER_AGENT, ExternalApiError, fetchJson } from '@/lib/academic/integrations/http';
import { normaliseDoi, safeUrl } from '@/lib/academic/integrations/normalization';
import type { FoundRecord, ReferenceProvider } from '@/lib/reference-check';

const LOOKUP = { timeoutMs: 8_000, retries: 1 };

async function orNullOn404<T>(request: Promise<T>) {
  try { return await request; } catch (error) {
    if (error instanceof ExternalApiError && error.status === 404) return null;
    throw error;
  }
}

type CrossrefWork = { DOI?: string; title?: string[]; author?: Array<{ given?: string; family?: string; name?: string }>; issued?: { 'date-parts'?: number[][] }; URL?: string };

function crossrefRecord(work: CrossrefWork): FoundRecord | null {
  const title = (work.title?.[0] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title) return null;
  const year = work.issued?.['date-parts']?.[0]?.[0];
  return {
    provider: 'crossref', title,
    authors: (work.author || []).map((author) => author.name || [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
    year: typeof year === 'number' ? year : null, doi: normaliseDoi(work.DOI), url: safeUrl(work.URL),
  };
}

type OpenAlexWork = { title?: string; doi?: string; publication_year?: number; id?: string; authorships?: Array<{ author?: { display_name?: string } }> };

function openAlexRecord(work: OpenAlexWork): FoundRecord | null {
  const title = (work.title || '').trim();
  if (!title) return null;
  return {
    provider: 'openalex', title,
    authors: (work.authorships || []).map((entry) => entry.author?.display_name || '').filter(Boolean),
    year: typeof work.publication_year === 'number' ? work.publication_year : null, doi: normaliseDoi(work.doi), url: safeUrl(work.id),
  };
}

export const crossrefReferenceProvider: ReferenceProvider = {
  id: 'crossref',
  async byDoi(doi) {
    const payload = await orNullOn404(fetchJson<{ message?: CrossrefWork }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(APPLICATION_EMAIL)}`, { headers: { 'User-Agent': APPLICATION_USER_AGENT } }, LOOKUP));
    return payload?.message ? crossrefRecord(payload.message) : null;
  },
  async search(query) {
    return (await CrossrefService.searchWorks(query, 5)).map((paper) => ({
      provider: 'crossref' as const, title: paper.title, authors: paper.authors, year: paper.year || null, doi: normaliseDoi(paper.doi), url: safeUrl(paper.url),
    }));
  },
};

export const openAlexReferenceProvider: ReferenceProvider = {
  id: 'openalex',
  async byDoi(doi) {
    const work = await orNullOn404(fetchJson<OpenAlexWork>(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(APPLICATION_EMAIL)}`, undefined, LOOKUP));
    return work ? openAlexRecord(work) : null;
  },
  async search(query) {
    return (await OpenAlexService.searchWorks(query, 5)).map((paper) => ({
      provider: 'openalex' as const, title: paper.title, authors: paper.authors, year: paper.publicationYear || null, doi: paper.doi, url: paper.url,
    }));
  },
};

export const REFERENCE_PROVIDERS: ReferenceProvider[] = [crossrefReferenceProvider, openAlexReferenceProvider];
