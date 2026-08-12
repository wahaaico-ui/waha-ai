export interface IntelligenceReport {
  fieldSaturation:    number; // 0 to 1
  trendScore:         number; // 0 to 1
  methodologyNorms:   string[];
  typicalScope: {
    variableCount:    number;
    sampleSizeMin:    number;
    sampleSizeMax:    number;
  };
  knownGaps:          string[];
  competingResearch:  number;
}

