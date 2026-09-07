export interface TopValue {
  value: string | null;
  count: number;
  [key: string]: unknown;
}

export interface ResearchAnalysis {
  totalPapers: number;
  latestPublicationYear: number | null;
  oldestPublicationYear: number | null;
  averageCitationCount: number | null;
  numberOfJournals: number;
  numberOfCountries: number;
  topJournal: TopValue;
  topCountry: TopValue;
  [key: string]: unknown;
}
