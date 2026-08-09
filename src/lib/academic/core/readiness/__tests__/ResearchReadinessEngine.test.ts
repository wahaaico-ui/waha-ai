import { ResearchReadinessEngine } from '../ResearchReadinessEngine';
import { IntentAnalysisResult } from '../../../types/IntentAnalysisResult';

describe('ResearchReadinessEngine - Sprint 1 Task 2', () => {
  let engine: ResearchReadinessEngine;

  beforeEach(() => {
    engine = new ResearchReadinessEngine();
  });

  test('Case 1: Not ready for NON_RESEARCH intent', () => {
    const intent: IntentAnalysisResult = {
      intent: 'NON_RESEARCH', confidence: 100, language: 'ar',
      independentVariable: null, dependentVariable: null,
      population: null, location: null, discipline: null, academicLevel: null,
      missingParts: [], nextRoute: '/error'
    };

    const result = engine.assess(intent);
    expect(result.isReady).toBe(false);
  });

  test('Case 2: Ready with caveats for NO_IDEA intent', () => {
    const intent: IntentAnalysisResult = {
      intent: 'NO_IDEA', confidence: 90, language: 'ar',
      independentVariable: null, dependentVariable: null,
      population: null, location: null, discipline: null, academicLevel: null,
      missingParts: [], nextRoute: '/generator'
    };

    const result = engine.assess(intent);
    expect(result.isReady).toBe(true);
    expect(result.proceedWithCaveats).toBe(true);
  });

  test('Case 3: Fully ready when independent and dependent variables exist', () => {
    const intent: IntentAnalysisResult = {
      intent: 'HAS_TITLE', confidence: 80, language: 'ar',
      independentVariable: 'الذكاء الاصطناعي', dependentVariable: 'التعليم',
      population: 'الطلاب', location: 'السعودية', discipline: 'التربية', academicLevel: 'ماجستير',
      missingParts: [], nextRoute: '/evaluator'
    };

    const result = engine.assess(intent);
    expect(result.isReady).toBe(true);
    expect(result.missingElements.length).toBe(0);
  });
});

