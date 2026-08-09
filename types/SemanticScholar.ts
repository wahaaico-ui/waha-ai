export interface SemanticScholarAuthor {
  authorId: string | null;
  name: string;
}

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  authors: SemanticScholarAuthor[];
  publicationYear: number | null;
  citationCount: number;
  referenceCount: number;
  fieldsOfStudy: string[];
  venue: string | null;
  doi: string | null;
  url: string | null;
}

export type SemanticScholarFailureCode =
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'INVALID_RESPONSE';

export interface SemanticScholarFailure {
  code: SemanticScholarFailureCode;
  message: string;
  httpStatus?: number;
}

export type SemanticScholarSearchResult =
  | {
      ok: true;
      papers: SemanticScholarPaper[];
      totalAvailable: number;
      requestUrl: string;
    }
  | {
      ok: false;
      failure: SemanticScholarFailure;
    };

