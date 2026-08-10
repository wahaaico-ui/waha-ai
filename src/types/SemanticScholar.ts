export interface SemanticScholarPaper {
  paperId: string;
  title?: string;
  abstract?: string;
  year?: number;
  authors?: Array<{ authorId?: string | null; name?: string }>;
  citationCount?: number;
  url?: string;
  [key: string]: any;
}

export interface SemanticScholarSearchResult {
  data?: SemanticScholarPaper[];
  papers?: SemanticScholarPaper[];
  total?: number;
  totalAvailable?: number;
  offset?: number;
  next?: number;
  ok?: boolean;
  requestUrl?: string;
  failure?: {
    code: string;
    message: string;
    httpStatus?: number;
    [key: string]: any;
  };
  [key: string]: any;
}
