/**
 * ResearchAnalyzer output types
 *
 * These describe plain descriptive statistics computed from OpenAlex results
 * that the project already fetched. No AI, no scores, no estimates.
 * `null` always means "OpenAlex did not report this", never zero.
 */

/** A value that occurs most often in the result set, with how often it occurred. */
export interface TopValue {
  /** The winning value, or null when no paper reported one. */
  value: string | null;
  /** How many papers reported that value. */
  count: number;
}

export interface ResearchAnalysis {
  /** 1. Number of papers analyzed. */
  totalPapers: number;
  /** 2. Newest publication year present in the papers. */
  latestPublicationYear: number | null;
  /** 3. Oldest publication year present in the papers. */
  oldestPublicationYear: number | null;
  /** 4. Mean citation count across the papers, rounded to one decimal. */
  averageCitationCount: number | null;
  /** 5. Journal that appears in the most papers. */
  topJournal: TopValue;
  /** 6. ISO country code that appears in the most papers. */
  topCountry: TopValue;
  /** 7. Distinct countries across all papers. */
  numberOfCountries: number;
  /** 8. Distinct journals across all papers. */
  numberOfJournals: number;
}
