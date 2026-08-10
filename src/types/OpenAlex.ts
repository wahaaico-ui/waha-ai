export interface OpenAlexWork {
  id?: string;
  title?: string;
  abstract?: string;
  publication_year?: number;
  authorships?: Array<{ author?: { display_name?: string } }>;
  cited_by_count?: number;
  doi?: string;
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

export interface ResearchEvidence {
  [key: string]: any;
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
