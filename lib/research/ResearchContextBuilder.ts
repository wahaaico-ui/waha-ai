/**
 * ResearchContextBuilder
 *
 * Assembles the one ResearchContext object that carries a research project.
 * It is the only place a ResearchContext is constructed, so every consumer
 * sees the same shape and the same guarantees.
 *
 * Contract:
 * - Pure and side-effect free: no network calls, no AI, no randomness.
 *   It only rearranges input it is handed and computes arithmetic over it.
 * - The reserved analysis slots are always `null`. Their modules do not exist
 *   yet, and this builder must never pretend otherwise.
 */

import { ResearchStatisticsEngine, StatisticsOptions } from './ResearchStatisticsEngine';
import type {
  ResearchEvidence,
  OpenAlexFailure,
  SearchAttempt,
  SearchStrategy,
} from '@/types/OpenAlex';
import type { ResearchContext, ResearchLanguage } from '@/types/ResearchContext';

export interface ContextInput {
  /** The idea as the researcher wrote it. */
  originalIdea: string;
  /** Keywords produced by KeywordExtractionService. */
  extractedKeywords: string[];
  /** The queries actually issued to OpenAlex, in order. */
  generatedQueries: string[];
  /** Every fallback attempt and its outcome. */
  attempts?: SearchAttempt[];
  /** The query whose results `papers` holds. */
  effectiveQuery?: string | null;
  /** How that query was derived. */
  effectiveStrategy?: SearchStrategy | null;
  /** Works OpenAlex returned. Empty when it matched nothing, or when it failed. */
  papers: ResearchEvidence[];
  /** True only when OpenAlex really answered. */
  success: boolean;
  /** Total works OpenAlex holds for the query. */
  totalAvailable: number;
  /** How many papers were asked for. */
  requestedLimit: number;
  /** The real failure reason, when `success` is false. */
  error?: OpenAlexFailure;
  /** Ranking sizes for the `statistics` block only; the aggregates stay complete. */
  statisticsOptions?: StatisticsOptions;
}

/** Arabic script, including the Arabic Supplement and Extended-A blocks. */
const ARABIC_LETTERS = /[؀-ۿݐ-ݿࢠ-ࣿ]/g;
/** Latin letters, including accented forms. */
const LATIN_LETTERS = /[A-Za-zÀ-ɏ]/g;

/** A script needs this share of the letters before the text counts as mixed. */
const MIXED_THRESHOLD = 0.2;

export class ResearchContextBuilder {
  /**
   * Build the context from a completed retrieval.
   * A failed retrieval still yields a valid context: zeroed statistics, empty
   * aggregates, and the real failure reason in `retrieval.error`.
   */
  static build(input: ContextInput): ResearchContext {
    const papers = Array.isArray(input.papers) ? input.papers.filter(Boolean) : [];
    const statistics = ResearchStatisticsEngine.compute(papers, input.statisticsOptions);

    return {
      originalIdea: input.originalIdea?.trim() ?? '',
      language: this.detectLanguage(input.originalIdea),

      extractedKeywords: [...(input.extractedKeywords ?? [])],
      generatedQueries: [...(input.generatedQueries ?? [])].filter(Boolean),

      papers,
      statistics,

      // Complete aggregates, not the top-N slices held in `statistics`.
      concepts: ResearchStatisticsEngine.rankConcepts(papers),
      journals: ResearchStatisticsEngine.rankJournals(papers),
      countries: ResearchStatisticsEngine.rankCountries(papers),

      latestYear: statistics.latestPublicationYear,
      oldestYear: statistics.earliestPublicationYear,
      averageYear: statistics.averagePublicationYear,
      totalCitations: statistics.totalCitations,

      // Reserved slots — the modules behind these do not exist yet.
      duplicateAnalysis: null,
      noveltyAnalysis: null,
      researchGap: null,
      methodologySuggestions: null,
      titleEvaluation: null,

      retrieval: {
        success: input.success,
        totalAvailable: input.success ? input.totalAvailable : 0,
        requestedLimit: input.requestedLimit,
        attempts: input.attempts ?? [],
        effectiveQuery: input.effectiveQuery ?? null,
        effectiveStrategy: input.effectiveStrategy ?? null,
        ...(input.error ? { error: input.error } : {}),
      },
    };
  }

  /**
   * Detect the script of the idea by counting letters — no language model.
   * Returns 'mixed' when both scripts carry a real share of the text, and
   * 'unknown' when there are no letters at all to judge by (digits, symbols).
   */
  static detectLanguage(text: string | null | undefined): ResearchLanguage {
    if (!text) return 'unknown';

    const arabic = text.match(ARABIC_LETTERS)?.length ?? 0;
    const latin = text.match(LATIN_LETTERS)?.length ?? 0;
    const total = arabic + latin;

    if (total === 0) return 'unknown';

    const arabicShare = arabic / total;

    if (arabicShare >= 1 - MIXED_THRESHOLD) return 'ar';
    if (arabicShare <= MIXED_THRESHOLD) return 'en';
    return 'mixed';
  }
}
