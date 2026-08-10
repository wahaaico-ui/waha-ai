export interface OpenAlexPaper {
  id: string;
  title?: string;
  [key: string]: any;
}

export interface OpenAlexSearchResult {
  results?: OpenAlexPaper[];
  meta?: any;
  [key: string]: any;
}

export interface OpenAlexFailure {
  code: string;
  message: string;
  [key: string]: any;
}
