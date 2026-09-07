export interface CoverageValue {
  name: string;
  count: number;
}

import type { IntelligenceRankedValue } from './ResearchIntelligence';

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
  rareConcepts: CoverageValue[];
}

export interface ResearchGapGeographicalCoverage {
  summary: string;
  topCountries: IntelligenceRankedValue[];
  missingCountries: string[];
}

export interface ResearchGapPopulationCoverage {
  coveredPopulations: CoverageValue[];
  missingPopulations: string[];
}

export interface ResearchGapMethodologyCoverage {
  coveredMethodologies: CoverageValue[];
  missingMethodologies: string[];
}

export interface ResearchGapKeywordCoverage {
  topRepeatedConcepts: IntelligenceRankedValue[];
  rareConcepts: CoverageValue[];
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
