/**
 * OpenAlex API Response Types
 * https://docs.openalex.org/
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
  /** ISO country codes of the author affiliations, deduplicated per work. */
  countries: string[];
  openalexUrl: string;
}

export interface OpenAlexWork {
  id: string;
  title: string;
  publication_year: number | null;
  doi: string | null;
  cited_by_count: number;
  primary_location?: {
    source?: {
      display_name: string | null;
    };
  };
  authorships?: Array<{
    author: {
      display_name: string;
    };
    /** Affiliation countries for this author, as ISO codes. */
    countries?: string[];
    institutions?: Array<{
      display_name?: string | null;
      country_code?: string | null;
    }>;
  }>;
  abstract_inverted_index?: Record<string, number[]>;
  concepts?: Array<{
    display_name: string;
  }>;
}

export interface OpenAlexResponse {
  results: OpenAlexWork[];
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
}

export interface KeywordExtractionResult {
  originalText: string;
  keywords: string[];
  searchQuery: string;
}

/**
 * How a fallback query was derived. See lib/openalex/query-planner.ts for the
 * order in which they are tried.
 */
export type SearchStrategy =
  | 'extracted-keywords'
  | 'dictionary'
  | 'core-dictionary'
  | 'core-keywords'
  | 'original-text';

/** A planned query, before it is sent. */
export interface QueryCandidate {
  strategy: SearchStrategy;
  /** The exact string that will be sent to OpenAlex. */
  query: string;
  /** Why this query exists, for display and debugging. */
  reason: string;
  /** The terms the query was built from. */
  terms: string[];
}

/** One query that was actually sent, and what came back. */
export interface SearchAttempt {
  strategy: SearchStrategy;
  query: string;
  reason: string;
  /** Papers returned. `null` only when the call itself failed. */
  resultCount: number | null;
  /** Works OpenAlex holds for this query. `null` when the call failed. */
  totalAvailable: number | null;
  /** Whether this attempt's results are the ones the context ended up using. */
  used: boolean;
  /** Present only when this attempt failed. */
  error?: OpenAlexFailure;
}

/**
 * Shape of an OpenAlex error body, e.g.
 * { "error": "Pagination error.", "message": "per-page parameter must be between 1 and 200." }
 */
export interface OpenAlexErrorBody {
  error?: string;
  message?: string;
}

export type OpenAlexFailureCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'INVALID_RESPONSE';

export interface OpenAlexFailure {
  code: OpenAlexFailureCode;
  /** Human-readable reason, taken from OpenAlex when it supplies one. */
  message: string;
  httpStatus?: number;
  /** The exact URL that was requested, for reproducing the failure. */
  requestUrl?: string;
}

/** Result of a live OpenAlex query. `ok` is only true when the API really answered. */
export type OpenAlexSearchResult =
  | { ok: true; evidence: ResearchEvidence[]; totalAvailable: number; requestUrl: string }
  | { ok: false; failure: OpenAlexFailure };
