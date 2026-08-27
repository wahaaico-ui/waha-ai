import type { EvidenceVerificationStatus } from '@/lib/academic/integrations/types';

export const CITATION_STYLES = ['apa-7', 'ieee', 'harvard', 'vancouver', 'chicago', 'mla'] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];
export type CitationItem = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  type: string;
  verificationStatus: EvidenceVerificationStatus;
  confidenceScore: number;
  provenance: string[];
};

export type StructuredCitation = {
  id: string;
  itemId: string;
  style: CitationStyle;
  inText: string;
  bibliography: string;
  locator?: string | null;
  context?: string | null;
  verificationStatus: EvidenceVerificationStatus;
  confidenceScore: number;
  insertedAt: string;
};
