import type {
  OpenAlexFailure,
  ResearchEvidence,
  SearchAttempt,
  SearchStrategy,
} from '@/types/OpenAlex';
import type { ResearchStatistics, RankedCount } from '@/types/ResearchStatistics';

/** Language detected from the research idea using deterministic script counts. */
export type ResearchLanguage = 'ar' | 'en' | 'mixed' | 'unknown';

/** Reserved analysis slots. Their modules are not implemented yet. */
export type DuplicateAnalysis = null;
export type NoveltyAnalysis = null;
export type ResearchGap = null;
export type MethodologySuggestions = null;
export type TitleEvaluation = null;

export interface ResearchRetrievalStatus {
  success: boolean;
  totalAvailable: number;
  requestedLimit: number;
  attempts: SearchAttempt[];
  effectiveQuery: string | null;
  effectiveStrategy: SearchStrategy | null;
  error?: OpenAlexFailure;
}

/**
 * Central memory shared by the research pipeline.
 * This file is the single source of truth for ResearchContext.
 */
export interface ResearchContext {
  originalIdea: string;
  language: ResearchLanguage;
  extractedKeywords: string[];
  generatedQueries: string[];
  papers: ResearchEvidence[];
  statistics: ResearchStatistics;
  concepts: RankedCount[];
  journals: RankedCount[];
  countries: RankedCount[];
  latestYear: number | null;
  oldestYear: number | null;
  averageYear: number | null;
  totalCitations: number;

  duplicateAnalysis: DuplicateAnalysis;
  noveltyAnalysis: NoveltyAnalysis;
  researchGap: ResearchGap;
  methodologySuggestions: MethodologySuggestions;
  titleEvaluation: TitleEvaluation;

  retrieval: ResearchRetrievalStatus;
}
