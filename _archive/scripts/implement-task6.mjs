import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 1  Task 6  —  Academic Decision Engine        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/lib/academic/types');
dir('src/lib/academic/core/decision');
dir('src/lib/academic/core/decision/__tests__');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — UnifiedAcademicReport type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/types/UnifiedAcademicReport.ts', `
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
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 2 — AcademicDecisionEngine.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/decision/AcademicDecisionEngine.ts', `
import { ResearchIntentEngine } from '../intent/ResearchIntentEngine';
import { ResearchReadinessEngine } from '../readiness/ResearchReadinessEngine';
import { EvidenceCollector } from '../evidence/EvidenceCollector';
import { ResearchIntelligenceEngine } from '../intelligence/ResearchIntelligenceEngine';
import { GapAnalysisEngine } from '../gaps/GapAnalysisEngine';
import { UnifiedAcademicReport } from '../../types/UnifiedAcademicReport';

export class AcademicDecisionEngine {
  private intentEngine = new ResearchIntentEngine();
  private readinessEngine = new ResearchReadinessEngine();
  private evidenceCollector = new EvidenceCollector();
  private intelligenceEngine = new ResearchIntelligenceEngine();
  private gapEngine = new GapAnalysisEngine();

  public evaluate(rawText: string): UnifiedAcademicReport {
    // 1. Analyze Intent
    const intentResult = this.intentEngine.analyze(rawText);

    // 2. Assess Readiness
    const readinessAssessment = this.readinessEngine.assess(intentResult);

    // 3. Collect Evidence
    const evidencePackage = this.evidenceCollector.collect(intentResult);

    // 4. Generate Intelligence
    const intelligenceReport = this.intelligenceEngine.analyze(intentResult, evidencePackage);

    // 5. Analyze Gaps
    const gapAnalysisResult = this.gapEngine.analyze(intentResult, evidencePackage, intelligenceReport);

    // 6. Compute Final Verdict Deterministically
    let status: 'APPROVED' | 'NEEDS_REVISION' | 'REJECTED' = 'APPROVED';
    let score = 85;

    if (!readinessAssessment.isReady && !readinessAssessment.proceedWithCaveats) {
      status = 'REJECTED';
      score = 40;
    } else if (gapAnalysisResult.overlapDegree > 0.7) {
      status = 'NEEDS_REVISION';
      score = 65;
    }

    const summaryMessage = status === 'APPROVED' 
      ? 'الفكرة أكاديمية واعدة وقابلة للتطوير والنشر.' 
      : 'الفكرة تحتاج إلى تعديلات جوهرية لتجنب التكرار.';

    return {
      intentResult,
      readinessAssessment,
      evidencePackage,
      intelligenceReport,
      gapAnalysisResult,
      finalVerdict: {
        status,
        score,
        summaryMessage
      }
    };
  }
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 3 — Unit Tests for Academic Decision Engine
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/decision/__tests__/AcademicDecisionEngine.test.ts', `
import { AcademicDecisionEngine } from '../AcademicDecisionEngine';

describe('AcademicDecisionEngine - Sprint 1 Task 6', () => {
  let engine: AcademicDecisionEngine;

  beforeEach(() => {
    engine = new AcademicDecisionEngine();
  });

  test('Case 1: Evaluates valid research idea completely', () => {
    const report = engine.evaluate('أفكر في أثر الذكاء الاصطناعي على التحصيل الأكاديمي');
    
    expect(report).toBeDefined();
    expect(report.intentResult.intent).toBe('INITIAL_IDEA');
    expect(report.readinessAssessment.isReady).toBe(true);
    expect(report.evidencePackage.referenceCount).toBeGreaterThan(0);
    expect(report.intelligenceReport.trendScore).toBeGreaterThan(0);
    expect(report.gapAnalysisResult.identifiedGaps.length).toBeGreaterThan(0);
    expect(report.finalVerdict.score).toBeGreaterThan(0);
  });
});
`);

console.log('\n✅ Task 6 implementation completed successfully.\n');
