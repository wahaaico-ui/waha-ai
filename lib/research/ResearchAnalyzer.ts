/**
 * ResearchAnalyzer
 *
 * Computes descriptive statistics over OpenAlex results that the project has
 * already fetched (`ResearchEvidence[]` from `services/openalex.service.ts`).
 *
 * Contract:
 * - No AI, no network calls, no external providers — pure arithmetic.
 * - Nothing is invented. Missing OpenAlex metadata stays missing (`null`),
 *   it is never replaced by a placeholder or a zero that reads as data.
 * - Every counted metric counts *papers*, not authors: a paper with five
 *   authors from the same country contributes that country exactly once,
 *   so "Top Country" is not skewed by large author lists.
 *
 * Pure and side-effect free, so it runs identically on the server and in the
 * browser.
 */

import type { ResearchEvidence } from '@/types/OpenAlex';
import type { ResearchAnalysis, TopValue } from '@/types/ResearchAnalysis';

const NO_TOP_VALUE: TopValue = { value: null, count: 0 };

export class ResearchAnalyzer {
  /**
   * Analyze a set of OpenAlex papers.
   * An empty (or invalid) input yields zeroed counts and null values rather
   * than a thrown error, because "no papers" is a legitimate search outcome.
   */
  static analyze(papers: ResearchEvidence[] | null | undefined): ResearchAnalysis {
    const list = Array.isArray(papers) ? papers.filter(Boolean) : [];

    if (list.length === 0) {
      return {
        totalPapers: 0,
        latestPublicationYear: null,
        oldestPublicationYear: null,
        averageCitationCount: null,
        topJournal: NO_TOP_VALUE,
        topCountry: NO_TOP_VALUE,
        numberOfCountries: 0,
        numberOfJournals: 0,
      };
    }

    const years = this.collectYears(list);
    const journalCounts = this.countJournals(list);
    const countryCounts = this.countCountries(list);

    return {
      totalPapers: list.length,
      latestPublicationYear: years.length > 0 ? Math.max(...years) : null,
      oldestPublicationYear: years.length > 0 ? Math.min(...years) : null,
      averageCitationCount: this.averageCitations(list),
      topJournal: this.pickTop(journalCounts),
      topCountry: this.pickTop(countryCounts),
      numberOfCountries: countryCounts.size,
      numberOfJournals: journalCounts.size,
    };
  }

  /** Publication years OpenAlex actually reported. */
  private static collectYears(papers: ResearchEvidence[]): number[] {
    return papers
      .map(paper => paper.publicationYear)
      .filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
  }

  /**
   * Mean citation count, rounded to one decimal.
   * OpenAlex reports 0 citations as a real value, so zeros are included; only
   * non-numeric entries are skipped.
   */
  private static averageCitations(papers: ResearchEvidence[]): number | null {
    const counts = papers
      .map(paper => paper.citationCount)
      .filter((count): count is number => typeof count === 'number' && Number.isFinite(count));

    if (counts.length === 0) return null;

    const total = counts.reduce((sum, count) => sum + count, 0);
    return Math.round((total / counts.length) * 10) / 10;
  }

  /** journal name -> number of papers published in it. */
  private static countJournals(papers: ResearchEvidence[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const paper of papers) {
      const journal = paper.journal?.trim();
      if (!journal) continue; // OpenAlex has no source for this work
      counts.set(journal, (counts.get(journal) ?? 0) + 1);
    }

    return counts;
  }

  /**
   * country code -> number of papers with at least one author affiliated there.
   * Each country is counted once per paper.
   */
  private static countCountries(papers: ResearchEvidence[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const paper of papers) {
      const seenInThisPaper = new Set<string>();

      for (const raw of paper.countries ?? []) {
        const code = raw?.trim().toUpperCase();
        if (!code || seenInThisPaper.has(code)) continue;
        seenInThisPaper.add(code);
        counts.set(code, (counts.get(code) ?? 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Highest count wins; ties break alphabetically so the same input always
   * produces the same output.
   */
  private static pickTop(counts: Map<string, number>): TopValue {
    let top: TopValue = NO_TOP_VALUE;

    for (const [value, count] of counts) {
      if (count > top.count || (count === top.count && top.value !== null && value < top.value)) {
        top = { value, count };
      }
    }

    return top;
  }
}
