import {
  createResearchObjectView,
  evaluateQuestionsMethodologyConsistency,
  type JourneyDocumentSnapshot,
} from '@/lib/research-objects';

const projectId = 'project-question-methodology';
const checkedAt = '2026-08-27T12:00:00.000Z';

function evaluate(
  questions: string[],
  methodology?: { approach: string; population: string; sample: string; instrument: string },
) {
  const base = { project_id: projectId, version: 1, created_at: checkedAt };
  const documents: JourneyDocumentSnapshot[] = [
    { ...base, id: 'questions-v1', type: 'journey:questions', content: { questions } },
    ...(methodology ? [{ ...base, id: 'methodology-v1', type: 'journey:methodology', content: methodology }] : []),
  ];
  return evaluateQuestionsMethodologyConsistency(createResearchObjectView(projectId, documents), { checkedAt });
}

describe('evaluateQuestionsMethodologyConsistency', () => {
  test('passes a quantitative design that can answer quantitative questions', () => {
    const report = evaluate(
      [
        'ما أثر التعلم الإلكتروني على التحصيل الأكاديمي لدى طلبة التمريض؟',
        'ما العلاقة بين استخدام المنصات الرقمية ودافعية طلبة التمريض؟',
      ],
      {
        approach: 'quantitative',
        population: 'طلبة التمريض في الجامعات المحلية المستخدمون لمنصات التعلم الإلكتروني.',
        sample: 'عينة طبقية عشوائية من طلبة التمريض، ويحدد حجمها بتحليل القدرة الإحصائية.',
        instrument: 'استبانة محكمة ومقياس للتحصيل الأكاديمي ودافعية التعلم.',
      },
    );

    expect(report.status).toBe('passed');
    expect(report.coverageScore).toBe(100);
    expect(report.results.every((result) => result.inferredQuestionMode === 'quantitative')).toBe(true);
  });

  test('fails when a qualitative approach and interviews cannot test a quantitative effect question', () => {
    const report = evaluate(
      ['ما أثر المنصة الرقمية على درجات التحصيل الأكاديمي لدى طلبة التمريض؟'],
      {
        approach: 'qualitative',
        population: 'طلبة التمريض في الجامعات المحلية ممن يستخدمون المنصة الرقمية.',
        sample: 'عينة قصدية من طلبة التمريض ذوي الخبرة في استخدام المنصة.',
        instrument: 'مقابلات شبه منظمة وتحليل موضوعي لتجارب المشاركين.',
      },
    );

    expect(report.status).toBe('failed');
    expect(report.results[0].dimensions.approachFit).toBeLessThanOrEqual(25);
    expect(report.results[0].status).toBe('failed');
  });

  test('warns when sample selection and population alignment need clarification', () => {
    const report = evaluate(
      ['ما مستوى استخدام المنصات الرقمية لدى المعلمين في المدارس الريفية؟'],
      {
        approach: 'descriptive',
        population: 'العاملون في مؤسسات التعليم العام.',
        sample: 'مجموعة من المشاركين المتاحين للدراسة.',
        instrument: 'استبانة محكمة لقياس مستوى الاستخدام.',
      },
    );

    expect(report.status).toBe('warning');
    expect(report.results[0].dimensions.populationAlignment).toBeLessThan(70);
  });

  test('fails safely when questions or methodology are missing', () => {
    expect(evaluate([], undefined).status).toBe('failed');
    expect(evaluate(['ما أثر التعلم الرقمي على التحصيل؟'], undefined).methodologyId).toBeNull();
  });

  test('is deterministic for the same documents and timestamp', () => {
    const questions = ['ما أثر التعلم الرقمي على تحصيل طلبة الجامعة؟'];
    const methodology = {
      approach: 'quantitative',
      population: 'طلبة الجامعة المستخدمون لمنصات التعلم الرقمي.',
      sample: 'عينة عشوائية طبقية من طلبة الجامعة وفق الكليات.',
      instrument: 'استبانة محكمة ومقياس للتحصيل الدراسي.',
    };
    expect(evaluate(questions, methodology)).toEqual(evaluate(questions, methodology));
  });
});
