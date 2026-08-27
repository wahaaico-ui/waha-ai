import {
  createResearchObjectView,
  evaluateObjectivesQuestionsConsistency,
  type JourneyDocumentSnapshot,
} from '@/lib/research-objects';

const projectId = 'project-objective-question';
const checkedAt = '2026-08-27T12:00:00.000Z';

function evaluate(objectives: string[], questions: string[]) {
  const base = { project_id: projectId, version: 1, created_at: checkedAt };
  const documents: JourneyDocumentSnapshot[] = [
    { ...base, id: 'objectives-v1', type: 'journey:objectives', content: { objectives } },
    { ...base, id: 'questions-v1', type: 'journey:questions', content: { questions } },
  ];
  return evaluateObjectivesQuestionsConsistency(createResearchObjectView(projectId, documents), { checkedAt });
}

describe('evaluateObjectivesQuestionsConsistency', () => {
  test('passes distinct answerable questions that operationalize their objectives', () => {
    const report = evaluate(
      [
        'قياس أثر المنصات الذكية على التحصيل الأكاديمي لدى طلبة التمريض.',
        'تحليل العلاقة بين استخدام المنصات الذكية ودافعية طلبة التمريض.',
      ],
      [
        'ما أثر المنصات الذكية على التحصيل الأكاديمي لدى طلبة التمريض؟',
        'ما العلاقة بين استخدام المنصات الذكية ودافعية طلبة التمريض؟',
      ],
    );

    expect(report.status).toBe('passed');
    expect(report.coverageScore).toBe(100);
    expect(report.results.every((result) => result.status === 'passed')).toBe(true);
  });

  test('fails when a question investigates a different subject than its objective', () => {
    const report = evaluate(
      ['قياس أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية.'],
      ['ما أثر أسعار الطاقة المتجددة على الصادرات الزراعية في أوروبا؟'],
    );

    expect(report.status).toBe('failed');
    expect(report.results[0].dimensions.alignment).toBeLessThan(30);
    expect(report.results[0].status).toBe('failed');
  });

  test('warns about highly duplicated questions', () => {
    const report = evaluate(
      [
        'قياس أثر المنصات الذكية على تحصيل طلبة الجامعة.',
        'تحليل أثر المنصات الذكية على دافعية طلبة الجامعة.',
      ],
      [
        'ما أثر المنصات الذكية على تحصيل طلبة الجامعة؟',
        'ما أثر المنصات الذكية على تحصيل طلبة الجامعة؟',
      ],
    );

    expect(report.status).not.toBe('passed');
    expect(report.duplicateQuestionPairs).toHaveLength(1);
  });

  test('fails safely when objectives or questions are missing or counts differ', () => {
    expect(evaluate([], []).status).toBe('failed');
    const mismatch = evaluate(
      ['قياس أثر التعلم الرقمي على التحصيل الأكاديمي.', 'تحليل دافعية الطلبة في التعلم الرقمي.'],
      ['ما أثر التعلم الرقمي على التحصيل الأكاديمي؟'],
    );
    expect(mismatch.status).toBe('failed');
    expect(mismatch.issues).toContain('يجب أن يقابل كل هدف سؤال بحث واحد فقط.');
  });

  test('is deterministic for the same version and timestamp', () => {
    const objectives = ['قياس أثر التعلم الرقمي على التحصيل الأكاديمي لدى طلبة الجامعة.'];
    const questions = ['ما أثر التعلم الرقمي على التحصيل الأكاديمي لدى طلبة الجامعة؟'];
    expect(evaluate(objectives, questions)).toEqual(evaluate(objectives, questions));
  });
});
