export interface OpenAlexWork {
  id?: string;
  title?: string;
  abstract?: string;
  publication_year?: number;
  authorships?: Array<{
    author?: {
      display_name?: string;
      [key: string]: any;
    };
    countries?: string[];
    institutions?: Array<{
      display_name?: string;
      id?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  }>;
  cited_by_count?: number;
  doi?: string;
  primary_location?: any;
  [key: string]: any;
}

export interface OpenAlexResponse {
  results?: OpenAlexWork[];
  meta?: any;
  [key: string]: any;
}

export interface OpenAlexErrorBody {
  message?: string;
  [key: string]: any;
}

/**
 * Canonical internal representation used by the research pipeline.
 *
 * Important:
 * OpenAlex itself may omit some fields. The OpenAlex client is responsible
 * for normalizing those missing values before creating ResearchEvidence.
 */
export interface ResearchEvidence {
  title: string;
  publicationYear: number | null;
  doi: string | null;
  openalexId: string;
  citationCount: number;
  journal: string | null;
  authors: string[];
  abstract: string | null;
  concepts: string[];
  countries: string[];
  openalexUrl: string;
}

export interface OpenAlexSearchResult {
  results?: OpenAlexWork[];
  meta?: any;
  [key: string]: any;
}

export interface OpenAlexFailure {
  code: string;
  message: string;
  [key: string]: any;
}

export interface KeywordExtractionResult {
  originalText: string;
  keywords: string[];
  searchQuery: string;
  terms?: string[];
  [key: string]: any;
}

export interface QueryCandidate {
  strategy: string;
  query: string;
  reason: string;
  terms: string[];
  [key: string]: any;
}

export interface SearchAttempt {
  strategy: string;
  query: string;
  reason?: string;
  resultCount?: number | null;
  totalAvailable?: number | null;
  used?: boolean;
  error?: string;
  [key: string]: any;
}

export interface SearchStrategy {
  strategy?: string;
  queries?: string[];
  [key: string]: any;
}
