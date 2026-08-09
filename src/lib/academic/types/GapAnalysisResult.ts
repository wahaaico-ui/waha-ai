export interface ResearchGap {
  id: string;
  description: string;
  significance: 'HIGH' | 'MODERATE' | 'LOW';
}

export interface GapAnalysisResult {
  identifiedGaps:         ResearchGap[];
  gapRelevance:           Record<string, number>;
  overlapDegree:          number; // 0 to 1
  differentiators:        string[];
  narrowingOpportunities: string[];
  expansionOpportunities: string[];
}

