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

