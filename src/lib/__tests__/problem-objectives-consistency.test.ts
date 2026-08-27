import {
  createResearchObjectView,
  evaluateProblemObjectivesConsistency,
  type JourneyDocumentSnapshot,
} from '@/lib/research-objects';

const projectId = 'project-consistency';
const checkedAt = '2026-08-27T08:00:00.000Z';

function documents(problemStatement: string, objectives: string[]): JourneyDocumentSnapshot[] {
  return [
    {
      id: 'problem-v1',
      project_id: projectId,
      type: 'journey:problem',
      content: { problemStatement, researchGap: 'توجد حاجة إلى فحص ميداني في السياق المحلي.' },
      version: 1,
      created_at: checkedAt,
    },
    {
      id: 'objectives-v1',
      project_id: projectId,
      type: 'journey:objectives',
      content: { objectives },
      version: 1,
      created_at: checkedAt,
    },
  ];
}

function evaluate(problemStatement: string, objectives: string[]) {
  const view = createResearchObjectView(projectId, documents(problemStatement, objectives));
  return evaluateProblemObjectivesConsistency(view, { checkedAt });
}

describe('evaluateProblemObjectivesConsistency', () => {
  test('passes objectives that cover the problem with measurable, distinct actions', () => {
    const report = evaluate(
      'يتطلب أثر استخدام المنصات الذكية على جودة تعلم الباحثين ودافعيتهم في الجامعات المحلية فحصاً منهجياً.',
      [
        'قياس أثر استخدام المنصات الذكية على جودة تعلم الباحثين في الجامعات المحلية.',
        'تحليل أثر المنصات الذكية على دافعية الباحثين في الجامعات المحلية.',
      ],
    );

    expect(report.status).toBe('passed');
    expect(report.overallScore).toBeGreaterThanOrEqual(70);
    expect(report.coverageScore).toBeGreaterThanOrEqual(60);
    expect(report.results).toHaveLength(2);
    expect(report.results.every((result) => result.knowledgeType === 'inference')).toBe(true);
  });

  test('fails an objective that is outside the concepts of the problem', () => {
    const report = evaluate(
      'ينبغي فحص أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية.',
      ['تحليل أسعار الطاقة المتجددة في الأسواق الأوروبية خلال العقد الأخير.'],
    );

    expect(report.status).toBe('failed');
    expect(report.results[0].status).toBe('failed');
    expect(report.results[0].matchedConcepts).toEqual([]);
    expect(report.results[0].gapsFound).toContain('لا يظهر ارتباط مفاهيمي مباشر بين الهدف ومشكلة البحث.');
  });

  test('detects highly duplicated objectives and does not pass the report', () => {
    const report = evaluate(
      'يتطلب أثر استخدام الذكاء الاصطناعي على مهارات الكتابة الأكاديمية لدى طلبة الدراسات العليا فحصاً واضحاً.',
      [
        'قياس أثر استخدام الذكاء الاصطناعي على مهارات الكتابة الأكاديمية لدى طلبة الدراسات العليا.',
        'قياس أثر استخدام الذكاء الاصطناعي على مهارات الكتابة الأكاديمية لدى طلبة الدراسات العليا.',
      ],
    );

    expect(report.status).not.toBe('passed');
    expect(report.duplicateObjectivePairs).toHaveLength(1);
    expect(report.results.every((result) => result.score <= 49)).toBe(true);
  });

  test('warns when valid objectives leave important problem concepts uncovered', () => {
    const report = evaluate(
      'يحتاج أثر المنصات الرقمية على التحصيل والدافعية والاندماج الأكاديمي لدى الطلبة في الجامعات الريفية إلى فحص.',
      ['قياس أثر المنصات الرقمية على التحصيل لدى الطلبة.'],
    );

    expect(report.status).toBe('warning');
    expect(report.coverageScore).toBeLessThan(60);
    expect(report.uncoveredProblemConcepts.length).toBeGreaterThan(0);
    expect(report.issues[0]).toContain('لا تغطيها الأهداف');
  });

  test('fails safely when the view has no problem or no objectives', () => {
    const emptyView = createResearchObjectView(projectId, []);
    const emptyReport = evaluateProblemObjectivesConsistency(emptyView, { checkedAt });

    expect(emptyReport.status).toBe('failed');
    expect(emptyReport.results).toEqual([]);
    expect(emptyReport.issues).toEqual([
      'لا توجد مشكلة بحث صالحة لإجراء الفحص.',
      'لا توجد أهداف بحث صالحة لإجراء الفحص.',
    ]);

    const noObjectivesView = createResearchObjectView(projectId, documents('مشكلة بحث واضحة قابلة للفحص المنهجي.', []).slice(0, 1));
    const noObjectivesReport = evaluateProblemObjectivesConsistency(noObjectivesView, { checkedAt });
    expect(noObjectivesReport.status).toBe('failed');
    expect(noObjectivesReport.issues).toContain('لا توجد أهداف بحث صالحة لإجراء الفحص.');
  });

  test('returns deterministic results when the same formula version and timestamp are used', () => {
    const input = documents(
      'يحتاج أثر المنصات التعليمية على مشاركة طلبة الجامعة إلى تحليل منهجي.',
      ['تحليل أثر المنصات التعليمية على مشاركة طلبة الجامعة.'],
    );
    const view = createResearchObjectView(projectId, input);

    expect(evaluateProblemObjectivesConsistency(view, { checkedAt })).toEqual(
      evaluateProblemObjectivesConsistency(view, { checkedAt }),
    );
  });
});
