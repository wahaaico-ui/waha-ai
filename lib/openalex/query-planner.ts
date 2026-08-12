// @ts-nocheck
/**
 * QueryPlanner
 *
 * Builds the ordered list of queries the pipeline will try against OpenAlex.
 * Pure text processing — NO AI, no network, no randomness. Same idea in, same
 * plan out.
 *
 * The order is deliberate: most specific first, broadest last. The executor
 * stops at the first query that returns enough results, so a precise query is
 * never discarded in favour of a broader one that merely returns more.
 *
 * Ladder:
 *   1. extracted-keywords    the keywords as the researcher wrote them
 *   2. dictionary            those keywords mapped to English (Arabic ideas)
 *   3. core-dictionary       the 3 strongest English terms
 *   4. core-keywords         the 3 strongest original-language keywords
 *   5. original-text         the raw idea, last resort
 *
 * Steps that cannot be built are skipped, not faked: with no dictionary hit
 * there is no `dictionary` step, and an English idea skips it entirely because
 * translation would be a no-op.
 */

import { ArabicResearchDictionary } from './arabic-dictionary';
import type { QueryCandidate } from '@/types/OpenAlex';

/** How many terms a "core" query keeps. Extraction already ranks topical terms first. */
const CORE_TERMS = 3;

export interface PlanInput {
  /** The idea as the researcher wrote it. */
  originalIdea: string;
  /** Keywords from KeywordExtractionService. */
  keywords: string[];
  /** The query that service built from those keywords. */
  searchQuery: string;
}

export class QueryPlanner {
  /**
   * Build the fallback ladder. Always returns at least one candidate as long as
   * the idea contains any text.
   */
  static plan(input: PlanInput): QueryCandidate[] {
    const keywords = (input.keywords ?? []).filter(Boolean);
    const originalIdea = (input.originalIdea ?? '').trim();
    const candidates: QueryCandidate[] = [];

    // 1. Exactly what the pipeline used before this change.
    this.add(candidates, {
      strategy: 'extracted-keywords',
      query: input.searchQuery ?? '',
      reason: 'الكلمات المفتاحية المستخرجة كما كتبها الباحث',
      terms: keywords,
    });

    // 2 & 3. Dictionary translation — the step that rescues Arabic ideas.
    const translation = ArabicResearchDictionary.translate(originalIdea, keywords);

    if (translation.hits.length > 0) {
      this.add(candidates, {
        strategy: 'dictionary',
        query: translation.terms.join(' '),
        reason: `ترجمة ${translation.hits.length} مصطلح عبر القاموس الداخلي`,
        terms: translation.terms,
      });

      if (translation.terms.length > CORE_TERMS) {
        this.add(candidates, {
          strategy: 'core-dictionary',
          query: translation.terms.slice(0, CORE_TERMS).join(' '),
          reason: `أقوى ${CORE_TERMS} مصطلحات مترجمة`,
          terms: translation.terms.slice(0, CORE_TERMS),
        });
      }
    }

    // 4. Fewer original keywords — a shorter query matches more works.
    if (keywords.length > CORE_TERMS) {
      this.add(candidates, {
        strategy: 'core-keywords',
        query: keywords.slice(0, CORE_TERMS).join(' '),
        reason: `أقوى ${CORE_TERMS} كلمات مفتاحية`,
        terms: keywords.slice(0, CORE_TERMS),
      });
    }

    // 5. Last resort: hand OpenAlex the whole idea.
    this.add(candidates, {
      strategy: 'original-text',
      query: originalIdea,
      reason: 'نص الفكرة الكامل كمحاولة أخيرة',
      terms: [originalIdea],
    });

    return candidates;
  }

  /**
   * Append a candidate unless its query is empty or already planned.
   * Deduplication is what keeps an English idea from being searched twice: its
   * "dictionary" query is identical to its keyword query, so it collapses.
   */
  private static add(candidates: QueryCandidate[], candidate: QueryCandidate): void {
    const query = candidate.query?.trim().replace(/\s+/g, ' ') ?? '';
    if (!query) return;

    const fingerprint = ArabicResearchDictionary.normalize(query);
    const seen = candidates.some(
      existing => ArabicResearchDictionary.normalize(existing.query ?? "") === fingerprint
    );
    if (seen) return;

    candidates.push({ ...candidate, query });
  }
}
