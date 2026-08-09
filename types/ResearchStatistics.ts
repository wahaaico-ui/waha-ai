/**
 * Research Statistics Engine output types
 *
 * Every field is arithmetic over the OpenAlex works the project already
 * fetched. No AI, no scores, no estimates, no interpretation.
 * `null` always means "OpenAlex reported nothing to compute this from",
 * never zero.
 */

/** A value plus how many papers reported it. */
export interface RankedCount {
  name: string;
  /** Number of papers that reported this value (counted once per paper). */
  count: number;
}

/** Papers published in one calendar year, as reported by OpenAlex. */
export interface YearCount {
  year: number;
  count: number;
}

/** The single most-cited work in the result set, carried verbatim. */
export interface MostCitedPaper {
  title: string;
  publicationYear: number | null;
  citationCount: number;
  journal: string | null;
  doi: string | null;
  openalexId: string;
  openalexUrl: string;
  authors: string[];
}

/**
 * How much of the input actually carried each field. Reported so a consumer
 * can tell "3 of 10 papers have no journal" apart from "the journal counts
 * are wrong".
 */
export interface StatisticsCoverage {
  papersWithPublicationYear: number;
  papersWithJournal: number;
  papersWithConcepts: number;
}

export interface ResearchStatistics {
  /** 1. Number of papers the statistics were computed from. */
  totalPapers: number;
  /** 2. Oldest publication year present. */
  earliestPublicationYear: number | null;
  /** 3. Newest publication year present. */
  latestPublicationYear: number | null;
  /** 4. Mean publication year, rounded to one decimal. */
  averagePublicationYear: number | null;
  /** 5. Sum of `cited_by_count` across all papers. */
  totalCitations: number;
  /** 6. Mean citations per paper, rounded to one decimal. */
  averageCitations: number | null;
  /** 7. The most-cited paper in the set. */
  highestCitedPaper: MostCitedPaper | null;
  /** 8. Journals ranked by number of papers, descending. */
  topJournals: RankedCount[];
  /** 9. OpenAlex concepts ranked by number of papers, descending. */
  topConcepts: RankedCount[];
  /** 10. Papers per publication year, ascending by year. */
  publicationsPerYear: YearCount[];
  /** Distinct journals across all papers. */
  distinctJournals: number;
  /** Distinct concepts across all papers. */
  distinctConcepts: number;
  coverage: StatisticsCoverage;
}
