import type { SemanticScholarFailure } from '@/types/SemanticScholar';

export type ResearchSource = 'openalex' | 'semantic-scholar' | 'both';

export interface UnifiedResearchPaper {
  title: string;
  publicationYear: number | null;
  doi: string | null;
  citationCount: number;
  referenceCount: number | null;
  journal: string | null;
  authors: string[];
  abstract: string | null;
  concepts: string[];
  countries: string[];
  url: string | null;
  openalexId: string | null;
  semanticScholarId: string | null;
  source: ResearchSource;
}

export interface ResearchAggregation {
  papers: UnifiedResearchPaper[];
  openAlexPapers: number;
  semanticScholarPapers: number;
  mergedTotalPapers: number;
  duplicatesRemoved: number;
  searchSources: ResearchSource[];
  semanticScholar: {
    success: boolean;
    query: string;
    totalAvailable: number;
    error?: SemanticScholarFailure;
  };
}

