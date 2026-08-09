/**
 * Research Statistics Service
 *
 * Thin layer over the research pipeline: it retrieves the ResearchContext and
 * hands back the part a caller asked for. It contains no statistics logic of
 * its own and makes no AI calls.
 *
 * The statistics live inside the context (`context.statistics`); this service
 * exists so a statistics-only endpoint does not have to know how the context
 * is built.
 */

import { OpenAlexResearchService, SearchOptions } from '@/services/openalex.service';
import { ResearchStatisticsEngine, StatisticsOptions } from '@/lib/research/ResearchStatisticsEngine';
import type { ResearchEvidence } from '@/types/OpenAlex';
import type { ResearchContext } from '@/types/ResearchContext';
import type { ResearchStatistics } from '@/types/ResearchStatistics';

export class ResearchStatisticsService {
  /**
   * Retrieve papers for an idea and return the full ResearchContext,
   * statistics included.
   *
   * @param ideaText Raw research idea text.
   * @param limit    How many papers to retrieve (OpenAlex caps this at 200).
   */
  static async analyzeIdea(
    ideaText: string,
    limit: number = 25,
    options: SearchOptions = {}
  ): Promise<ResearchContext> {
    return OpenAlexResearchService.queryResearchEvidence(ideaText, limit, options);
  }

  /**
   * Compute statistics over papers the caller already has, without touching
   * the network. Used by routes that fetched the works themselves.
   */
  static fromPapers(
    papers: ResearchEvidence[] | null | undefined,
    options: StatisticsOptions = {}
  ): ResearchStatistics {
    return ResearchStatisticsEngine.compute(papers, options);
  }
}
