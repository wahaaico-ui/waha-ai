import {
  buildConclusionsDraft,
  researchConclusionsConsistencyIssue,
  researchConclusionsStructureIssue,
} from '@/lib/research-conclusions';

const discussion = {
  discussions: [{
    questionIndex: 0,
    questionText: 'ما أثر استخدام المنصة على جودة تعلم طلبة الدراسات العليا؟',
    resultStatement: 'ظهر أثر إيجابي لاستخدام المنصة، وبلغ معامل الانحدار 0.42 ضمن العينة الحالية.',
    interpretation: 'تعني النتيجة أن استخدام المنصة ارتبط بتحسن جودة التعلم ضمن العينة والسياق اللذين شملهما التحليل، دون إثبات سببية خارج التصميم المعتمد.',
    literatureComparison: 'يتفق اتجاه النتيجة بحذر مع الأدلة السابقة المختارة، مع بقاء اختلاف المجتمع والتصميم قيد الاعتبار.',
    supportingPaperIds: ['paper-1'],
  }],
  limitationsInterpretation: 'يجب حصر تفسير النتائج في عينة الدراسة الحالية وسياق الجامعة والمنهج المستخدم في التحليل.',
};

function completeConclusions() {
  const draft = buildConclusionsDraft(discussion)!;
  return {
    ...draft,
    conclusions: [{
      ...draft.conclusions[0],
      conclusionStatement: 'يمكن الاستنتاج أن استخدام المنصة ارتبط إيجابياً بجودة التعلم لدى أفراد العينة ضمن السياق الجامعي والتصميم المنهجي المعتمدين في الدراسة.',
    }],
    overallConclusion: 'تخلص الدراسة إلى وجود ارتباط إيجابي بين استخدام المنصة وجودة التعلم في حدود العينة والسياق المحددين، مع ضرورة تجنب تفسير النتيجة كعلاقة سببية عامة.',
  };
}

describe('research conclusions stage', () => {
  test('builds a blank conclusion scaffold from the approved discussion', () => {
    const draft = buildConclusionsDraft(discussion);
    expect(draft?.conclusions).toHaveLength(1);
    expect(draft?.conclusions[0].discussionInterpretation).toBe(discussion.discussions[0].interpretation);
    expect(draft?.conclusions[0].conclusionStatement).toBe('');
  });

  test('accepts conclusions grounded in the approved discussion', () => {
    const conclusions = completeConclusions();
    expect(researchConclusionsStructureIssue(conclusions)).toBeNull();
    expect(researchConclusionsConsistencyIssue(conclusions, discussion)).toBeNull();
  });

  test('rejects changing the locked discussion interpretation', () => {
    const conclusions = completeConclusions();
    conclusions.conclusions[0].discussionInterpretation = 'تفسير آخر لم يُعتمد في مرحلة المناقشة السابقة.';
    expect(researchConclusionsConsistencyIssue(conclusions, discussion)).toContain('تفسير المناقشة');
  });

  test('rejects a numeric value not present in the approved result or discussion', () => {
    const conclusions = completeConclusions();
    conclusions.conclusions[0].conclusionStatement += ' وبلغت القيمة الإضافية 7.77 في الدراسة.';
    expect(researchConclusionsConsistencyIssue(conclusions, discussion)).toContain('7.77');
  });

  test('rejects an unsupported number in the overall conclusion', () => {
    const conclusions = completeConclusions();
    conclusions.overallConclusion += ' وبلغ الاستنتاج الكلي 93% وفق القراءة النهائية.';
    expect(researchConclusionsConsistencyIssue(conclusions, discussion)).toContain('93%');
  });

  test('rejects unsupported numbers in the overall conclusion', () => {
    const conclusions = completeConclusions();
    conclusions.overallConclusion += ' وتبلغ قابلية التعميم 91% وفق الخلاصة.';
    expect(researchConclusionsConsistencyIssue(conclusions, discussion)).toContain('91%');
  });

  test('keeps recommendations out of conclusions', () => {
    const conclusions = completeConclusions();
    conclusions.conclusions[0].conclusionStatement += ' ونوصي بتطبيق المنصة في جميع الجامعات.';
    expect(researchConclusionsStructureIssue(conclusions)).toContain('توصية');
  });
});
