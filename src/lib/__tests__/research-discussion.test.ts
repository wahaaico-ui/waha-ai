import {
  buildDiscussionDraft,
  researchDiscussionConsistencyIssue,
  researchDiscussionStructureIssue,
} from '@/lib/research-discussion';

const results = {
  results: [{
    questionIndex: 0,
    questionText: 'ما أثر استخدام المنصة على جودة تعلم طلبة الدراسات العليا؟',
    resultStatement: 'ظهر أثر إيجابي لاستخدام المنصة، وبلغ معامل الانحدار 0.42 عند مستوى دلالة 0.01 ضمن العينة الحالية.',
  }],
  limitations: 'تقتصر النتائج على عينة الدراسة الحالية وسياق الجامعة التي جُمعت منها البيانات.',
};

const analysis = {
  themes: [{
    title: 'فاعلية المنصات في التعلم',
    synthesis: 'تشير الدراسة المرجعية إلى اتجاه إيجابي مماثل ضمن سياقات جامعية، بمتوسط مقداره 0.42 في العينة المنشورة.',
    supportingPaperIds: ['paper-1'],
  }],
};

function completeDiscussion() {
  const draft = buildDiscussionDraft(results)!;
  return {
    ...draft,
    discussions: [{
      ...draft.discussions[0],
      interpretation: 'تعني النتيجة أن استخدام المنصة ارتبط بتحسن جودة التعلم ضمن العينة والسياق اللذين شملهما التحليل، دون إثبات سببية خارج التصميم المعتمد.',
      literatureComparison: 'يتفق اتجاه النتيجة بحذر مع الدراسة المرجعية التي تناولت سياقاً جامعياً مشابهاً، مع بقاء اختلاف المجتمع والتصميم قيد الاعتبار.',
      supportingPaperIds: ['paper-1'],
    }],
    overallSynthesis: 'توضح المناقشة أن النتيجة تجيب عن سؤال الدراسة ضمن حدود العينة الحالية، وأن اتجاهها ينسجم بحذر مع الدليل السابق المحدد دون تعميم يتجاوز التصميم.',
  };
}

describe('research discussion stage', () => {
  test('builds an empty interpretation scaffold while locking approved results', () => {
    const draft = buildDiscussionDraft(results);
    expect(draft?.discussions).toHaveLength(1);
    expect(draft?.discussions[0].resultStatement).toBe(results.results[0].resultStatement);
    expect(draft?.discussions[0].interpretation).toBe('');
  });

  test('accepts a discussion grounded in an approved result and literature evidence', () => {
    const discussion = completeDiscussion();
    expect(researchDiscussionStructureIssue(discussion)).toBeNull();
    expect(researchDiscussionConsistencyIssue(discussion, results, analysis)).toBeNull();
  });

  test('rejects changing the approved result', () => {
    const discussion = completeDiscussion();
    discussion.discussions[0].resultStatement = 'نتيجة بديلة لم يعتمدها الباحث في المرحلة السابقة.';
    expect(researchDiscussionConsistencyIssue(discussion, results, analysis)).toContain('نص النتيجة');
  });

  test('rejects evidence that is not present in the approved literature synthesis', () => {
    const discussion = completeDiscussion();
    discussion.discussions[0].supportingPaperIds = ['paper-unknown'];
    expect(researchDiscussionConsistencyIssue(discussion, results, analysis)).toContain('غير موجود');
  });

  test('rejects numeric claims absent from both the result and selected evidence', () => {
    const discussion = completeDiscussion();
    discussion.discussions[0].interpretation += ' وبلغت القيمة الجديدة 9.99 وفق التفسير المقترح.';
    expect(researchDiscussionConsistencyIssue(discussion, results, analysis)).toContain('9.99');
  });

  test('rejects unsupported numbers in the overall discussion summary', () => {
    const discussion = completeDiscussion();
    discussion.overallSynthesis += ' وبلغ تفسير الأثر العام 81% ضمن السياق المدروس.';
    expect(researchDiscussionConsistencyIssue(discussion, results, analysis)).toContain('81%');
  });

  test('keeps recommendations out of the discussion stage', () => {
    const discussion = completeDiscussion();
    discussion.discussions[0].literatureComparison += ' ونوصي بتطبيق المنصة في جميع الجامعات.';
    expect(researchDiscussionStructureIssue(discussion)).toContain('توصية');
  });
});
