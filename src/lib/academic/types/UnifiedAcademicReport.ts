import { IntentAnalysisResult } from './IntentAnalysisResult';
import { ReadinessAssessment } from './ReadinessAssessment';
import { EvidencePackage } from './EvidencePackage';
import { IntelligenceReport } from './IntelligenceReport';
import { GapAnalysisResult } from './GapAnalysisResult';

export interface UnifiedAcademicReport {
  intentResult:       IntentAnalysisResult;
  readinessAssessment: ReadinessAssessment;
  evidencePackage:    EvidencePackage;
  intelligenceReport: IntelligenceReport;
  gapAnalysisResult:  GapAnalysisResult;
  finalVerdict: {
    status:           'APPROVED' | 'NEEDS_REVISION' | 'REJECTED';
    score:            number; // 0 to 100
    summaryMessage:   string;
  };
}

