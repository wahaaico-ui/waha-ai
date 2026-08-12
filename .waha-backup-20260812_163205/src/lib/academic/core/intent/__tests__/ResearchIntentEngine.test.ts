import { ResearchIntentEngine } from '../ResearchIntentEngine';

describe('ResearchIntentEngine - Sprint 1 Task 1', () => {
  let engine: ResearchIntentEngine;

  beforeEach(() => {
    engine = new ResearchIntentEngine();
  });

  test('Case 1: NON_RESEARCH - "مرحبا كيف حالك"', () => {
    const result = engine.analyze('مرحبا كيف حالك');
    expect(result.intent).toBe('NON_RESEARCH');
    expect(result.confidence).toBe(100);
  });

  test('Case 2: INITIAL_IDEA - "أفكر في أثر الذكاء الاصطناعي على التحصيل الأكاديمي"', () => {
    const result = engine.analyze('أفكر في أثر الذكاء الاصطناعي على التحصيل الأكاديمي');
    expect(result.intent).toBe('INITIAL_IDEA');
    expect(result.confidence).toBe(80);
    expect(result.independentVariable).toBe('الذكاء الاصطناعي');
    expect(result.dependentVariable).toBe('التحصيل الأكاديمي');
  });

  test('Case 3: HAS_TITLE - "عنواني: أثر الذكاء الاصطناعي على التعليم"', () => {
    const result = engine.analyze('عنواني: أثر الذكاء الاصطناعي على التعليم');
    expect(result.intent).toBe('HAS_TITLE');
    expect(result.independentVariable).toBe('الذكاء الاصطناعي');
    expect(result.dependentVariable).toBe('التعليم');
    expect(result.missingParts.length).toBeGreaterThan(0);
  });

  test('Case 4: REJECTED_TITLE - "عنواني رفضه المشرف: أثر الذكاء الاصطناعي على التعليم"', () => {
    const result = engine.analyze('عنواني رفضه المشرف: أثر الذكاء الاصطناعي على التعليم');
    expect(result.intent).toBe('REJECTED_TITLE');
    expect(result.confidence).toBe(95);
  });

  test('Case 5: WANTS_PUBLICATION - "نود نشر بحث عن..."', () => {
    const result = engine.analyze('نود نشر بحث عن الذكاء الاصطناعي');
    expect(result.intent).toBe('WANTS_PUBLICATION');
    expect(result.confidence).toBe(90);
  });
});

