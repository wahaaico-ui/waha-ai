// src/lib/academic/types/IntentAnalysisResult.ts

export type ResearchIntentType = 
  | 'NO_IDEA' 
  | 'REJECTED_TITLE' 
  | 'HAS_PROPOSAL' 
  | 'WANTS_PUBLICATION' 
  | 'INITIAL_IDEA' 
  | 'HAS_TITLE' 
  | 'NON_RESEARCH';

export type DetectedLanguage = 'ar' | 'en' | 'mixed';

export interface IntentAnalysisResult {
  intent: ResearchIntentType;
  confidence: number;
  language: DetectedLanguage;
  independentVariable: string | null;
  dependentVariable: string | null;
  population: string | null;
  location: string | null;
  discipline: string | null;
  academicLevel: string | null;
  missingParts: string[];
  nextRoute: string;
}

export type ParsedAcademicIntent = IntentAnalysisResult;