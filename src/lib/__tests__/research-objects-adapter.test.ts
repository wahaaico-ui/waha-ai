import { createResearchObjectView } from '@/lib/research-objects';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects';

const projectId = 'project-1';

function snapshot(
  overrides: Partial<JourneyDocumentSnapshot> & Pick<JourneyDocumentSnapshot, 'id' | 'type' | 'content'>,
): JourneyDocumentSnapshot {
  return {
    project_id: projectId,
    version: 1,
    created_at: '2026-08-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('createResearchObjectView', () => {
  test('maps a saved problem, gap and objectives without claiming semantic validation', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'problem-v1',
        type: 'journey:problem',
        content: JSON.stringify({
          problemStatement: 'تتمثل مشكلة الدراسة في عدم وضوح أثر المنصات الذكية على جودة تعلم الباحثين في السياق المحلي.',
          researchGap: 'توجد ندرة في الدراسات التي تربط الاستخدام الفعلي للمنصات الذكية بنتائج تعلم قابلة للقياس.',
        }),
      }),
      snapshot({
        id: 'objectives-v1',
        type: 'journey:objectives',
        content: {
          objectives: [
            'قياس أثر استخدام المنصات الذكية على جودة تعلم الباحثين.',
            'تحديد العوامل المرتبطة بتبني المنصات الذكية في البيئة المحلية.',
          ],
        },
      }),
    ]);

    expect(result.objects).toHaveLength(4);
    expect(result.objects.map((item) => item.type)).toEqual([
      'problem',
      'gap',
      'objective',
      'objective',
    ]);
    expect(result.relationships).toHaveLength(3);
    expect(result.relationships.every((item) => item.status === 'unvalidated')).toBe(true);
    expect(result.validationResults).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test('uses the highest document version regardless of input order', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'problem-v2',
        type: 'journey:problem',
        version: 2,
        content: { problemStatement: 'المشكلة الأحدث والمعتمدة في المشروع.', researchGap: '' },
      }),
      snapshot({
        id: 'problem-v1',
        type: 'journey:problem',
        version: 1,
        content: { problemStatement: 'المشكلة القديمة.', researchGap: '' },
      }),
    ]);

    const problem = result.objects.find((item) => item.type === 'problem');
    expect(problem?.content.statement).toBe('المشكلة الأحدث والمعتمدة في المشروع.');
    expect(problem?.source.documentId).toBe('problem-v2');
    expect(problem?.source.version).toBe(2);
  });

  test('does not create a gap object without a readable parent problem', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'problem-v1',
        type: 'journey:problem',
        content: { problemStatement: '', researchGap: 'فجوة محفوظة بلا مشكلة صالحة.' },
      }),
    ]);

    expect(result.objects).toEqual([]);
    expect(result.relationships).toEqual([]);
    expect(result.warnings.map((item) => item.code)).toEqual([
      'missing_problem_statement',
      'gap_without_problem',
    ]);
  });

  test('keeps readable objectives but creates no false relationship when problem is missing', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'objectives-v1',
        type: 'journey:objectives',
        content: { objectives: ['قياس أثر المتغير الأول على المتغير الثاني في المجتمع المحدد.'] },
      }),
    ]);

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].type).toBe('objective');
    expect(result.relationships).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'objectives_without_problem' }),
    ]);
  });

  test('preserves the original objective position when an older record contains empty entries', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'objectives-v1',
        type: 'journey:objectives',
        content: {
          objectives: ['', 'الهدف الثاني الصالح بعد عنصر قديم فارغ.'],
        },
      }),
    ]);

    const objective = result.objects.find((item) => item.type === 'objective');
    expect(objective?.id).toBe(`project:${projectId}:objective:2`);
    expect(objective?.content.orderIndex).toBe(1);
    expect(objective?.source.fieldPath).toBe('objectives[1]');
  });

  test('maps questions to the corresponding objectives without claiming validation', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'objectives-v1',
        type: 'journey:objectives',
        content: {
          objectives: [
            'قياس أثر المنصات الذكية على التحصيل الأكاديمي.',
            'تحليل دافعية الطلبة عند استخدام المنصات الذكية.',
          ],
        },
      }),
      snapshot({
        id: 'questions-v1',
        type: 'journey:questions',
        content: {
          questions: [
            'ما أثر المنصات الذكية على التحصيل الأكاديمي؟',
            'كيف تتغير دافعية الطلبة عند استخدام المنصات الذكية؟',
          ],
        },
      }),
    ]);

    const questions = result.objects.filter((item) => item.type === 'question');
    expect(questions).toHaveLength(2);
    expect(questions[0].content.objectiveId).toBe(`project:${projectId}:objective:1`);
    expect(result.relationships.filter((item) => item.relationType === 'operationalizes')).toHaveLength(2);
    expect(result.validationResults).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'objectives_without_problem' })]);
  });

  test('maps methodology and links it to every saved question without claiming validation', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'questions-v1',
        type: 'journey:questions',
        content: { questions: ['ما أثر المنصة الرقمية على تحصيل طلبة التمريض؟'] },
      }),
      snapshot({
        id: 'methodology-v1',
        type: 'journey:methodology',
        content: {
          approach: 'quantitative',
          population: 'طلبة التمريض في الجامعات المحلية.',
          sample: 'عينة عشوائية طبقية من طلبة التمريض.',
          instrument: 'استبانة محكمة ومقياس للتحصيل الأكاديمي.',
        },
      }),
    ]);

    const methodology = result.objects.find((item) => item.type === 'methodology');
    expect(methodology?.content.approach).toBe('quantitative');
    expect(result.relationships).toContainEqual(expect.objectContaining({
      fromId: methodology?.id,
      relationType: 'designed_to_answer',
      status: 'unvalidated',
    }));
    expect(result.validationResults).toEqual([]);
  });

  test('maps hypotheses and links each one to its corresponding question', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'questions-v1',
        type: 'journey:questions',
        content: { questions: ['ما أثر المنصة الرقمية على تحصيل طلبة التمريض؟'] },
      }),
      snapshot({
        id: 'hypotheses-v1',
        type: 'journey:hypotheses',
        content: {
          mode: 'required',
          hypotheses: ['يوجد أثر للمنصة الرقمية على تحصيل طلبة التمريض.'],
          rationale: '',
        },
      }),
    ]);

    const hypothesis = result.objects.find((item) => item.type === 'hypothesis');
    const question = result.objects.find((item) => item.type === 'question');
    expect(hypothesis?.content.questionId).toBe(question?.id);
    expect(result.relationships).toContainEqual(expect.objectContaining({
      fromId: hypothesis?.id,
      toId: question?.id,
      relationType: 'tests',
    }));
  });

  test('ignores records owned by another project and reports malformed selected records', () => {
    const result = createResearchObjectView(projectId, [
      snapshot({
        id: 'foreign-problem',
        project_id: 'project-2',
        type: 'journey:problem',
        content: { problemStatement: 'يجب ألا تظهر.', researchGap: 'يجب ألا تظهر.' },
      }),
      snapshot({
        id: 'objectives-v1',
        type: 'journey:objectives',
        content: '{not-json',
      }),
    ]);

    expect(result.objects).toEqual([]);
    expect(result.relationships).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'invalid_document_content',
        documentId: 'objectives-v1',
      }),
    ]);
  });
});
