import type { EvidenceVerificationStatus } from '@/lib/academic/integrations/types';
import type { WritingBibliography } from './writing-bibliography';

export const CITATION_STYLES = ['apa-7', 'ieee', 'harvard', 'vancouver', 'chicago', 'mla', 'heritage'] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];
export const WRITING_STYLE_LABELS: Record<CitationStyle, string> = { 'apa-7': 'APA 7', ieee: 'IEEE', harvard: 'Harvard · Cite Them Right', vancouver: 'Vancouver', chicago: 'Chicago · Author–date', mla: 'MLA', heritage: 'التوثيق التراثي (حواشٍ)' };
export type CitationItem = {
  id: string;
  title: string;
  authors: string[];
  /** Supplied publication name parts, never inferred from display names. */
  bibliography?: WritingBibliography;
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
