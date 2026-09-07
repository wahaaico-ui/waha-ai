export interface YearCount {
  year: number | string;
  count: number;
  [key: string]: unknown;
}

export interface RankedCount {
  name: string;
  count: number;
  [key: string]: unknown;
}

export interface MostCitedPaper {
  title: string;
  publicationYear: number | null;
  citationCount: number;
  journal: string | null;
  doi: string | null;
  openalexId: string;
  openalexUrl: string;
  authors: string[];
  [key: string]: unknown;
}

export interface ResearchStatistics {
  totalPapers: number;

  earliestPublicationYear: number | null;
  latestPublicationYear: number | null;
  averagePublicationYear: number | null;

  totalCitations: number;
  averageCitations: number | null;

  highestCitedPaper: MostCitedPaper | null;

  topJournals: RankedCount[];
  topConcepts: RankedCount[];

  publicationsPerYear: YearCount[];

  distinctJournals: number;
  distinctConcepts: number;

  coverage: {
    papersWithPublicationYear: number;
    papersWithJournal: number;
    papersWithConcepts: number;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}
