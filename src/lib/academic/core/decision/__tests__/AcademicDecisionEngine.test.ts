import { AcademicDecisionEngine } from '../AcademicDecisionEngine';

describe('AcademicDecisionEngine', () => {
  let engine: AcademicDecisionEngine;

  beforeEach(() => {
    engine = new AcademicDecisionEngine();
  });

  test('returns the currently supported decision contract', async () => {
    const report = await engine.evaluate('أفكر في أثر الذكاء الاصطناعي على التحصيل الأكاديمي');

    expect(report).toEqual({
      status: 'approved',
      score: 95,
      notes: 'تم تقييم المحتوى الأكاديمي بنجاح',
    });
  });
});
