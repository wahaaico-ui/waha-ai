export interface ReadinessAssessment {
  isReady:               boolean;
  missingElements:       string[];
  ambiguities:           string[];
  proceedWithCaveats:    boolean;
  caveats:               string[];
}

