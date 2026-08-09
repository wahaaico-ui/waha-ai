export type ResearchIntentType =
  | 'NO_IDEA'
  | 'INITIAL_IDEA'
  | 'HAS_TITLE'
  | 'REJECTED_TITLE'
  | 'HAS_PROPOSAL'
  | 'WANTS_PUBLICATION'
  | 'NON_RESEARCH';

export type DetectedLanguage = 'ar' | 'en' | 'mixed';

export interface IntentAnalysisResult {
  intent:              ResearchIntentType;
  confidence:          number;
  language:            DetectedLanguage;
  independentVariable: string | null;
  dependentVariable:   string | null;
  population:          string | null;
  location:            string | null;
  discipline:          string | null;
  academicLevel:       string | null;
  missingParts:        string[];
  nextRoute:           string;
}

