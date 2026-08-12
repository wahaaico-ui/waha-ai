/**
 * ResearchStatisticsEngine
 *
 * Computes the full statistical profile of a set of OpenAlex works that the
 * project has already retrieved (`ResearchEvidence[]` from
 * `services/openalex.service.ts`).
 *
 * Contract:
 * - No AI, no network calls, no external providers — pure arithmetic.
 * - Nothing is invented. A field OpenAlex did not report stays `null`; it is
 *   never substituted with a zero or a placeholder that reads as data.
 * - Journals and concepts are counted once per *paper*, so a paper tagging the
 *   same concept twice cannot inflate a ranking.
 * - Deterministic: equal counts break alphabetically, so identical input
 *   always yields byte-identical output.
 *
 * Pure and side-effect free, so it runs identically on the server and in the
 * browser.
 */

import type { ResearchEvidence } from '@/types/OpenAlex';
import type {
  MostCitedPaper,
  RankedCount,
  ResearchStatistics,
  YearCount,
} from '@/types/ResearchStatistics';

export interface StatisticsOptions {
  /** How many journals to include in `topJournals` (default 5). */
  topJournalsLimit?: number;
  /** How many concepts to include in `topConcepts` (default 10). */
  topConceptsLimit?: number;
}

const DEFAULT_TOP_JOURNALS = 5;
const DEFAULT_TOP_CONCEPTS = 10;

/** Zeroed profile for an empty result set — a legitimate search outcome. */
const EMPTY_STATISTICS: ResearchStatistics = {
  totalPapers: 0,
  earliestPublicationYear: null,
  latestPublicationYear: null,
  averagePublicationYear: null,
  totalCitations: 0,
  averageCitations: null,
  highestCitedPaper: null,
  topJournals: [],
  topConcepts: [],
  publicationsPerYear: [],
  distinctJournals: 0,
  distinctConcepts: 0,
  coverage: {
    papersWithPublicationYear: 0,
    papersWithJournal: 0,
    papersWithConcepts: 0,
  },
};

export class ResearchStatisticsEngine {
  /**
   * Compute all ten statistics over a set of OpenAlex papers.
   * An empty or invalid input yields the zeroed profile rather than throwing,
   * because "OpenAlex matched nothing" is a real answer, not an error.
   */
  static compute(
    papers: ResearchEvidence[] | null | undefined,
    options: StatisticsOptions = {}
  ): ResearchStatistics {
    const list = Array.isArray(papers) ? papers.filter(Boolean) : [];

    if (list.length === 0) {
      // Cloned so a caller mutating the result cannot poison later calls.
      return structuredClone(EMPTY_STATISTICS);
    }

    const years = this.collectYears(list);
    const citations = this.collectCitations(list);
    const journalCounts = this.countPerPaper(list, this.journalsOf);
    const conceptCounts = this.countPerPaper(list, this.conceptsOf);

    const totalCitations = citations.reduce((sum, count) => sum + count, 0);

    return {
      totalPapers: list.length,
      earliestPublicationYear: years.length > 0 ? Math.min(...years) : null,
      latestPublicationYear: years.length > 0 ? Math.max(...years) : null,
      averagePublicationYear: this.mean(years),
      totalCitations,
      averageCitations: this.mean(citations),
      highestCitedPaper: this.findMostCited(list),
      topJournals: this.rank(journalCounts, options.topJournalsLimit ?? DEFAULT_TOP_JOURNALS),
      topConcepts: this.rank(conceptCounts, options.topConceptsLimit ?? DEFAULT_TOP_CONCEPTS),
      publicationsPerYear: this.groupByYear(years),
      distinctJournals: journalCounts.size,
      distinctConcepts: conceptCounts.size,
      coverage: {
        papersWithPublicationYear: years.length,
        papersWithJournal: list.filter(paper => Boolean(paper.journal?.trim())).length,
        papersWithConcepts: list.filter(paper => (paper.concepts ?? []).some(Boolean)).length,
      },
    };
  }

  /**
   * Journals across the papers, ranked descending by paper count.
   * Omit `limit` to get every journal — used by ResearchContext, which keeps
   * the complete aggregate rather than a top-N slice.
   */
  static rankJournals(
    papers: ResearchEvidence[] | null | undefined,
    limit?: number
  ): RankedCount[] {
    return this.rank(this.countPerPaper(this.normalize(papers), this.journalsOf), limit);
  }

  /** OpenAlex concepts across the papers, ranked descending. Omit `limit` for all. */
  static rankConcepts(
    papers: ResearchEvidence[] | null | undefined,
    limit?: number
  ): RankedCount[] {
    return this.rank(this.countPerPaper(this.normalize(papers), this.conceptsOf), limit);
  }

  /**
   * Author-affiliation countries (ISO codes) across the papers, ranked
   * descending. Omit `limit` for all. A paper with five authors from one
   * country counts once.
   */
  static rankCountries(
    papers: ResearchEvidence[] | null | undefined,
    limit?: number
  ): RankedCount[] {
    return this.rank(this.countPerPaper(this.normalize(papers), this.countriesOf), limit);
  }

  private static normalize(papers: ResearchEvidence[] | null | undefined): ResearchEvidence[] {
    return Array.isArray(papers) ? papers.filter(Boolean) : [];
  }

  /** The journal of one paper, or nothing when OpenAlex has no source for it. */
  private static journalsOf(paper: ResearchEvidence): string[] {
    const journal = paper.journal?.trim();
    return journal ? [journal] : [];
  }

  /** The concepts of one paper, blanks dropped. */
  private static conceptsOf(paper: ResearchEvidence): string[] {
    return (paper.concepts ?? [])
      .map((concept: string | null | undefined) => concept?.trim())
      .filter((concept: string | undefined): concept is string => Boolean(concept));
  }

  /** The affiliation countries of one paper, normalized to upper-case ISO codes. */
  private static countriesOf(paper: ResearchEvidence): string[] {
    return (paper.countries ?? [])
      .map((code: string) => code.trim().toUpperCase())
      .filter((code): code is string => Boolean(code));
  }

  /** Publication years OpenAlex actually reported. */
  private static collectYears(papers: ResearchEvidence[]): number[] {
    return papers
      .map(paper => paper.publicationYear)
      .filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
  }

  /**
   * Citation counts OpenAlex actually reported. A reported 0 is real data and
   * is kept; only non-numeric entries are dropped.
   */
  private static collectCitations(papers: ResearchEvidence[]): number[] {
    return papers
      .map(paper => paper.citationCount)
      .filter((count): count is number => typeof count === 'number' && Number.isFinite(count));
  }

  /** Arithmetic mean rounded to one decimal, or null when there is nothing to average. */
  private static mean(values: number[]): number | null {
    if (values.length === 0) return null;

    const total = values.reduce((sum, value) => sum + value, 0);
    return Math.round((total / values.length) * 10) / 10;
  }

  /**
   * value -> number of papers reporting it. `extract` returns the raw values
   * for one paper; duplicates within that paper collapse to a single count.
   * Matching is case-insensitive, and the first spelling seen is the one
   * reported, so "Machine Learning" and "machine learning" do not split a rank.
   */
  private static countPerPaper(
    papers: ResearchEvidence[],
    extract: (paper: ResearchEvidence) => string[]
  ): Map<string, RankedCount> {
    const counts = new Map<string, RankedCount>();

    for (const paper of papers) {
      const seenInThisPaper = new Set<string>();

      for (const value of extract(paper)) {
        const key = value.toLowerCase();
        if (seenInThisPaper.has(key)) continue;
        seenInThisPaper.add(key);

        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { name: value, count: 1 });
        }
      }
    }

    return counts;
  }

  /**
   * Highest count first; ties break alphabetically for a stable ordering.
   * `limit` undefined returns every entry; 0 returns none.
   */
  private static rank(counts: Map<string, RankedCount>, limit?: number): RankedCount[] {
    const ordered = [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map(entry => ({ ...entry }));

    if (limit === undefined) return ordered;

    const safeLimit = Math.max(Math.trunc(limit) || 0, 0);
    return safeLimit === 0 ? [] : ordered.slice(0, safeLimit);
  }

  /**
   * Papers per year, ascending. Only years present in the results appear —
   * a year with no papers is omitted rather than emitted as a zero, since
   * these are search results and not a complete census of the literature.
   */
  private static groupByYear(years: number[]): YearCount[] {
    const counts = new Map<number, number>();

    for (const year of years) {
      counts.set(year, (counts.get(year) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);
  }

  /**
   * The most-cited paper, copied field by field so the statistics payload
   * never carries the full abstract. Ties break on title alphabetically.
   */
  private static findMostCited(papers: ResearchEvidence[]): MostCitedPaper | null {
    let best: ResearchEvidence | null = null;

    for (const paper of papers) {
      const count = typeof paper.citationCount === 'number' ? paper.citationCount : 0;
      const bestCount = best && typeof best.citationCount === 'number' ? best.citationCount : -1;

      if (
        count > bestCount ||
        (count === bestCount && best !== null && paper.title.localeCompare(best.title) < 0)
      ) {
        best = paper;
      }
    }

    if (!best) return null;

    return {
      title: best.title,
      publicationYear: best.publicationYear ?? null,
      citationCount: typeof best.citationCount === 'number' ? best.citationCount : 0,
      journal: best.journal ?? null,
      doi: best.doi ?? null,
      openalexId: best.openalexId,
      openalexUrl: best.openalexUrl,
      authors: best.authors ?? [],
    };
  }
}
