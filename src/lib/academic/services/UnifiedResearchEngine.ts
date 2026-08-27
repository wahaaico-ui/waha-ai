import { academicProviders } from '../integrations/registry';
import { deduplicatePapers, normaliseTitle } from '../integrations/normalization';
import type { AcademicDomain, AcademicPaper, AcademicSearchProvider, ProviderSearchResult } from '../integrations/types';
import { ResearchRouter } from '../ResearchRouter';
import { PaperEnrichmentEngine } from '../PaperEnrichmentEngine';
import { withAcademicCache } from '../integrations/cache';

export type UnifiedSearchOptions = { query: string; alternateQueries?: string[]; specialty?: string; limit?: number };
export type UnifiedSearchResult = { papers: Array<AcademicPaper & { relevanceScore: number }>; domain: AcademicDomain; providers: ProviderSearchResult[] };

function terms(values: string[]) {
  return new Set(values.flatMap((value) => normaliseTitle(value).split(' ')).filter((value) => value.length >= 3));
}

function rankPaper(paper: AcademicPaper, queries: string[]) {
  const wanted = terms(queries);
  const searchable = terms([paper.title, paper.abstract, ...paper.subjects]);
  const overlap = [...wanted].filter((term) => searchable.has(term)).length / Math.max(1, wanted.size);
  const crossValidation = Math.min(1, paper.sources.length / 3);
  const citations = Math.min(1, Math.log10(paper.citationCount + 1) / 3);
  const completeness = [paper.abstract, paper.doi, paper.authors.length, paper.year, paper.url].filter(Boolean).length / 5;
  return Math.round((overlap * 0.55 + crossValidation * 0.2 + citations * 0.1 + completeness * 0.1 + Number(paper.openAccess) * 0.05) * 100);
}

async function runProvider(provider: AcademicSearchProvider, query: string, limit: number, domain: AcademicDomain): Promise<ProviderSearchResult> {
  const started = Date.now();
  try {
    const papers = await provider.search({ query, limit, domain });
    return { provider: provider.id, available: true, papers, durationMs: Date.now() - started };
  } catch (error) {
    return { provider: provider.id, available: false, papers: [], error: error instanceof Error ? error.message : 'Unknown provider failure', durationMs: Date.now() - started };
  }
}

export class UnifiedResearchEngine {
  public static async searchDetailed(options: UnifiedSearchOptions): Promise<UnifiedSearchResult> {
    const query = options.query.trim();
    if (query.length < 3) throw new Error('Academic query is too short');
    const limit = Math.min(50, Math.max(1, options.limit || 25));
    const route = ResearchRouter.route(query, options.specialty);
    const domain = route.domain;
    const selected = academicProviders(route.providers);
    const providerResults = await withAcademicCache(`search:${domain}:${normaliseTitle(query)}:${limit}`, 15 * 60 * 1_000, async () => {
      const settled = await Promise.allSettled(selected.map((provider) => runProvider(provider, query, limit, domain)));
      return settled.map((entry, index): ProviderSearchResult => entry.status === 'fulfilled'
        ? entry.value
        : { provider: selected[index].id, available: false, papers: [], error: 'Provider execution failed', durationMs: 0 });
    });
    const merged = deduplicatePapers(providerResults.flatMap((result) => result.papers));
    const queries = [query, ...(options.alternateQueries || [])];
    const preliminarilyRanked = merged
      .map((paper) => ({ ...paper, relevanceScore: rankPaper(paper, queries) }))
      .sort((a, b) => (b.relevanceScore - a.relevanceScore) || (b.citationCount - a.citationCount));
    const enrichmentCount = Math.min(10, preliminarilyRanked.length);
    const enriched = await PaperEnrichmentEngine.enrichBatch(preliminarilyRanked.slice(0, enrichmentCount));
    const papers = [...enriched, ...preliminarilyRanked.slice(enrichmentCount)]
      .map((paper) => ({ ...paper, relevanceScore: rankPaper(paper, queries) }))
      .sort((a, b) => (b.relevanceScore - a.relevanceScore) || (b.citationCount - a.citationCount))
      .slice(0, limit);
    return { papers, domain, providers: providerResults };
  }

  public static async search(query: string, limit = 10) {
    return (await this.searchDetailed({ query, limit })).papers;
  }
}
