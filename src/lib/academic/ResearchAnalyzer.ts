import type { ResearchEvidence } from '@/types/OpenAlex';
import type { ResearchAnalysis, TopValue } from '@/types/ResearchAnalysis';

function mostFrequent(counts: Map<string, number>): TopValue {
  let value: string | null = null;
  let count = 0;

  for (const [candidate, candidateCount] of counts) {
    if (candidateCount > count) {
      value = candidate;
      count = candidateCount;
    }
  }

  return { value, count };
}

export class ResearchAnalyzer {
  static analyze(papers: ResearchEvidence[]): ResearchAnalysis {
    const safePapers = Array.isArray(papers) ? papers : [];
    const years = safePapers
      .map((paper) => paper.publicationYear)
      .filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
    const journalCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();

    for (const paper of safePapers) {
      if (paper.journal) {
        journalCounts.set(paper.journal, (journalCounts.get(paper.journal) ?? 0) + 1);
      }
      for (const country of new Set(paper.countries)) {
        if (country) countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
      }
    }

    const totalCitations = safePapers.reduce((sum, paper) => sum + Math.max(0, paper.citationCount), 0);

    return {
      totalPapers: safePapers.length,
      latestPublicationYear: years.length > 0 ? Math.max(...years) : null,
      oldestPublicationYear: years.length > 0 ? Math.min(...years) : null,
      averageCitationCount: safePapers.length > 0
        ? Math.round((totalCitations / safePapers.length) * 10) / 10
        : null,
      numberOfJournals: journalCounts.size,
      numberOfCountries: countryCounts.size,
      topJournal: mostFrequent(journalCounts),
      topCountry: mostFrequent(countryCounts),
    };
  }
}
