export type AcademicDomain = 'biomedical' | 'computing' | 'social-humanities' | 'engineering' | 'general';

export type AcademicProvider =
  | 'openalex' | 'semantic-scholar' | 'crossref' | 'core' | 'arxiv'
  | 'europe-pmc' | 'openaire' | 'plos' | 'doab' | 'datacite' | 'pubmed';

export type AcademicCapability = 'discovery' | 'metadata' | 'open-access' | 'citations' | 'author-identity' | 'books' | 'datasets';
export type EvidenceVerificationStatus = 'verified' | 'cross-checked' | 'partially-verified' | 'unverified';
export type FieldProvenance = Record<string, AcademicProvider[]>;

export type AcademicPaper = {
  id: string;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  authors: string[];
  doi: string | null;
  pdfUrl: string | null;
  url: string | null;
  source: AcademicProvider;
  sources: AcademicProvider[];
  subjects: string[];
  publicationType: string | null;
  openAccess: boolean;
  journal?: string | null;
  containerTitle?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  pmid?: string | null;
  pmcid?: string | null;
  arxivId?: string | null;
  orcidIds?: string[];
  issn?: string[];
  isbn?: string[];
  license?: string | null;
  referencedWorksCount?: number;
  verificationStatus?: EvidenceVerificationStatus;
  confidenceScore?: number;
  fieldProvenance?: FieldProvenance;
};

export type UnifiedResearchItem = AcademicPaper;

export type ResearchSourceDefinition = {
  id: string;
  label: string;
  role: string;
  capabilities: AcademicCapability[];
  domains: AcademicDomain[];
  priority: number;
  enabled: boolean;
  requiresKey: boolean;
  keyEnvironmentVariable?: string;
  authentication: 'none' | 'optional-key' | 'required-key' | 'oauth';
  rateLimitNotes: string;
  retryPolicy: { retries: number; retry429: boolean; retry5xx: boolean };
  termsUrl: string;
  documentationUrl: string;
};

export type SearchOptions = { query: string; limit: number; domain: AcademicDomain };

export type ProviderSearchResult = {
  provider: AcademicProvider;
  available: boolean;
  papers: AcademicPaper[];
  error?: string;
  durationMs: number;
};

export interface AcademicSearchProvider {
  readonly id: AcademicProvider;
  search(options: SearchOptions): Promise<AcademicPaper[]>;
}
