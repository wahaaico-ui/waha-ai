export interface UnifiedResearchPaper {
  id?: string;
  paperId?: string;

  title: string;
  abstract?: string;

  authors: string[];

  publicationYear?: number;
  citationCount: number;

  countries: string[];
  concepts: string[];

  journal?: string;
  doi?: string;
  source?: string;

  [key: string]: unknown;
}

export interface ResearchAggregation {
  papers: UnifiedResearchPaper[];
  totalAvailable: number;

  requestUrl?: string;
  openAlexPapers?: number;
  semanticScholarPapers?: number;
  searchSources?: string[];
  mergedTotalPapers?: number;
  duplicatesRemoved?: number;

  [key: string]: unknown;
}

export interface ResearchAggregationResult {
  success: boolean;
  papers: UnifiedResearchPaper[];
  totalAvailable?: number;
  requestUrl?: string;

  failure?: {
    error: string;
    code: number;
    message: string;
  };
}
