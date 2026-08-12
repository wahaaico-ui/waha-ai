// @ts-nocheck
/**
 * OpenAlex Research Service
 *
 * Entry point of the research pipeline. It plans a ladder of queries, runs them
 * against OpenAlex until one returns usable results, and returns the project's
 * ResearchContext — the single object every downstream module reads and writes.
 *
 * Multi-query fallback (no AI anywhere in it):
 * - QueryPlanner produces candidates ordered most-specific first, including a
 *   dictionary translation of Arabic terms into English. That step matters
 *   because OpenAlex indexes almost no Arabic full text, so an Arabic query can
 *   legitimately match zero works on a topic with thousands of English papers.
 * - Candidates are tried in order and the FIRST one reaching `minResults` wins.
 *   A broader query is never preferred just because it returns more.
 * - If none reaches the threshold, the earliest attempt that returned anything
 *   is used — still the most specific of the non-empty ones.
 * - Every attempt is recorded in `retrieval.attempts`, so which query produced
 *   the papers is always visible and never implied.
 *
 * `retrieval.success` reflects whether OpenAlex actually answered — it is never
 * optimistic. Zero papers with success: true means every planned query really
 * matched nothing.
 */

import { OpenAlexClient } from '@/lib/openalex/client';
import { KeywordExtractionService } from '@/lib/openalex/keyword-extraction';
import { QueryPlanner } from '@/lib/openalex/query-planner';
import { ResearchContextBuilder } from '@/lib/research/ResearchContextBuilder';
import type { StatisticsOptions } from '@/lib/research/ResearchStatisticsEngine';
import type { ResearchEvidence, SearchAttempt, QueryCandidate } from '@/types/OpenAlex';
import type { ResearchContext } from '@/types/ResearchContext';

export interface SearchOptions extends StatisticsOptions {
  /**
   * Results a query must return to end the search. Below this the ladder keeps
   * going, because 1–2 papers are too thin a base for the statistics.
   * Default 3.
   */
  minResults?: number;
  /** Cap on queries sent per idea. Default 5 — the full ladder. */
  maxAttempts?: number;
}

/** A completed attempt whose results can be used. */
interface UsableResult {
  candidate: QueryCandidate;
  evidence: ResearchEvidence[];
  totalAvailable: number;
}

const DEFAULT_MIN_RESULTS = 3;
const DEFAULT_MAX_ATTEMPTS = 5;

export class OpenAlexResearchService {
  /**
   * Build the ResearchContext for a research idea, retrying with fallback
   * queries until OpenAlex returns usable results.
   *
   * @param ideaText Raw idea text, exactly as the researcher wrote it.
   * @param limit    How many papers to retrieve (OpenAlex caps this at 200).
   */
  static async queryResearchEvidence(
    ideaText: string,
    limit: number = 10,
    options: SearchOptions = {}
  ): Promise<ResearchContext> {
    const minResults = Math.max(options.minResults ?? DEFAULT_MIN_RESULTS, 1);
    const maxAttempts = Math.max(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 1);

    // Step 1: Extract keywords (pure text processing, no AI)
    const keywordResult = KeywordExtractionService.extract(ideaText);

    // Step 2: Plan the fallback ladder (pure text processing + internal dictionary)
    const plan = QueryPlanner.plan({
      originalIdea: ideaText,
      keywords: keywordResult.keywords ?? [],
      searchQuery: keywordResult.searchQuery,
    }).slice(0, maxAttempts);

    // Step 3: Walk the ladder
    const attempts: SearchAttempt[] = [];
    let chosen: UsableResult | null = null;
    /** First non-empty attempt — the most specific query that found anything. */
    let firstNonEmpty: UsableResult | null = null;

    for (const candidate of plan) {
      const result = await OpenAlexClient.searchWorks(candidate.query, limit);

      if (!result.ok) {
        attempts.push({
          strategy: candidate.strategy,
          query: candidate.query,
          reason: candidate.reason,
          resultCount: null,
          totalAvailable: null,
          used: false,
          error: result.failure,
        });

        // An outage will not resolve by rephrasing the query, so stop asking.
        // Results already in hand are still worth returning.
        if (firstNonEmpty) break;

        return ResearchContextBuilder.build({
          originalIdea: ideaText,
          extractedKeywords: keywordResult.keywords,
          generatedQueries: attempts.map(attempt => attempt.query),
          papers: [],
          success: false,
          totalAvailable: 0,
          requestedLimit: limit,
          error: result.failure,
          attempts,
          effectiveQuery: null,
          effectiveStrategy: null,
          statisticsOptions: options,
        });
      }

      attempts.push({
        strategy: candidate.strategy,
        query: candidate.query,
        reason: candidate.reason,
        resultCount: result.evidence.length,
        totalAvailable: result.totalAvailable,
        used: false,
      });

      const usable: UsableResult = {
        candidate,
        evidence: result.evidence,
        totalAvailable: result.totalAvailable,
      };

      if (result.evidence.length >= minResults) {
        chosen = usable;
        break;
      }

      if (result.evidence.length > 0 && !firstNonEmpty) {
        firstNonEmpty = usable;
      }
    }

    // Threshold hit, or else the most specific query that returned anything.
    const winner = chosen ?? firstNonEmpty;

    // Flag the attempt whose results are actually being used.
    if (winner) {
      const used = attempts.find(
        attempt =>
          attempt.strategy === winner.candidate.strategy && attempt.query === winner.candidate.query
      );
      if (used) used.used = true;
    }

    // Step 4: Assemble the context. Every planned query having matched nothing
    // is a real answer, reported as zero papers with success: true.
    return ResearchContextBuilder.build({
      originalIdea: ideaText,
      extractedKeywords: keywordResult.keywords,
      generatedQueries: attempts.map(attempt => attempt.query),
      papers: winner?.evidence ?? [],
      success: true,
      totalAvailable: winner?.totalAvailable ?? 0,
      requestedLimit: limit,
      attempts,
      effectiveQuery: winner?.candidate.query ?? null,
      effectiveStrategy: winner?.candidate.strategy ?? null,
      statisticsOptions: options,
    });
  }
}
