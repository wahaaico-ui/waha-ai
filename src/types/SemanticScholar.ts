export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  citationCount?: number;
  authors?: { name: string }[];
}

export interface SemanticScholarFailure {
  error: string;
  code: number;
  message: string;
}
