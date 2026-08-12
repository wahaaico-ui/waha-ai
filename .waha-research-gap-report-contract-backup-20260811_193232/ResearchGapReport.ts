import type { IntelligenceRankedValue, ResearchIntelligence } from './ResearchIntelligence';
import type { UnifiedResearchPaper } from './ResearchAggregation';

export type ResearchDensity =
  | 'Very High'
  | 'High'
  | 'Medium'
  | 'Low';

export type ResearchTrend =
  | 'Growing'
  | 'Declining'
  | 'Stable';

export interface ResearchGapTopicCoverage {
  globalPaperCount: number;
  coveredConceptCount: number;
  dominantConcepts: IntelligenceRankedValue[];
  rareConcepts: IntelligenceRankedValue[];
}

export interface ResearchGapGeographicalCoverage {
  summary: string;
  topCountries: IntelligenceRankedValue[];
  missingCountries: string[];
}

export interface ResearchGapPopulationCoverage {
  coveredPopulations: IntelligenceRankedValue[];
  missingPopulations: string[];
}

export interface ResearchGapMethodologyCoverage {
  coveredMethodologies: IntelligenceRankedValue[];
  missingMethodologies: string[];
}

export interface ResearchGapKeywordCoverage {
  topRepeatedConcepts: IntelligenceRankedValue[];
  rareConcepts: IntelligenceRankedValue[];
}

export interface ResearchGapReport {
  topicCoverage: ResearchGapTopicCoverage;

  researchDensity: ResearchDensity;

  recentResearchTrend: ResearchTrend;

  geographicalCoverage: ResearchGapGeographicalCoverage;

  populationCoverage: ResearchGapPopulationCoverage;

  methodologyCoverage: ResearchGapMethodologyCoverage;

  keywordCoverage: ResearchGapKeywordCoverage;

  potentialResearchGap: string;

  recommendation: string;

  confidence: number;

  [key: string]: unknown;
}
