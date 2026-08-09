import type { IntelligenceRankedValue } from '@/types/ResearchIntelligence';

export type ResearchDensity = 'Very High' | 'High' | 'Medium' | 'Low';
export type RecentResearchTrend = 'Growing' | 'Stable' | 'Declining';

export interface TopicCoverage {
  globalPaperCount: number;
  coveredConceptCount: number;
  dominantConcepts: IntelligenceRankedValue[];
  rareConcepts: IntelligenceRankedValue[];
}

export interface GeographicalCoverage {
  summary: string;
  topCountries: IntelligenceRankedValue[];
  missingCountries: string[];
}

export interface PopulationCoverage {
  coveredPopulations: IntelligenceRankedValue[];
  missingPopulations: string[];
}

export interface MethodologyCoverage {
  coveredMethodologies: IntelligenceRankedValue[];
  missingMethodologies: string[];
}

export interface KeywordCoverage {
  topRepeatedConcepts: IntelligenceRankedValue[];
  rareConcepts: IntelligenceRankedValue[];
}

export interface ResearchGapReport {
  topicCoverage: TopicCoverage;
  researchDensity: ResearchDensity;
  recentResearchTrend: RecentResearchTrend;
  geographicalCoverage: GeographicalCoverage;
  populationCoverage: PopulationCoverage;
  methodologyCoverage: MethodologyCoverage;
  keywordCoverage: KeywordCoverage;
  potentialResearchGap: string;
  recommendation: string;
  confidence: number;
}
