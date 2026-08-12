export type IntentType = 'INITIAL_IDEA' | 'LITERATURE_REVIEW' | 'GAP_ANALYSIS' | 'METHODOLOGY';

export interface ParsedAcademicIntent {
  intent: IntentType;
  confidence: number;
  extractedKeywords: string[];
  rawQuery: string;
  domain?: string;
}
