import {
  buildRecommendationsDraft,
  researchRecommendationsConsistencyIssue,
  researchRecommendationsStructureIssue,
} from '@/lib/research-recommendations';

const conclusions = {
  conclusions: [{
    questionIndex: 0,
    questionText: 'ما أثر استخدام المنصة على جودة تعلم طلبة الدراسات العليا؟',
    conclusionStatement: 'يمكن الاستنتاج أن استخدام المنصة ارتبط إيجابياً بجودة التعلم لدى أفراد العينة ضمن السياق الجامعي والتصميم المعتمدين.',
  }],
  overallConclusion: 'تخلص الدراسة إلى وجود ارتباط إيجابي في حدود العينة والسياق المحددين دون تفسير النتيجة كعلاقة سببية عامة.',
  scopeStatement: 'تقتصر الاستنتاجات على عينة الدراسة والسياق الجامعي والمنهج المستخدم في التحليل.',
};

function completeRecommendations() {
  const draft = buildRecommendationsDraft(conclusions)!;
  return {
    ...draft,
    recommendations: [{
      ...draft.recommendations[0],
      targetAudience: 'إدارات الجامعات ومراكز تطوير التعلم',
      recommendationText: 'ينبغي تطوير إرشادات مؤسسية لاستخدام المنصة في التعلم، مع متابعة ملاءمتها لسياق الطلبة وعدم افتراض فاعليتها خارج حدود الدراسة الحالية.',
    }],
    overallPriorities: 'تبدأ الأولوية بوضع إرشادات استخدام واضحة للطلبة وأعضاء هيئة التدريس، ثم مراجعة أثرها عملياً قبل توسيع التطبيق إلى سياقات جامعية أخرى.',
    feasibilityNote: 'تتوقف قابلية التنفيذ على موارد الجامعة واستعداد المستخدمين، كما يجب مراعاة حدود العينة والمنهج عند اتخاذ القرار.',
  };
}

describe('research recommendations stage', () => {
  test('builds a blank recommendation scaffold from approved conclusions', () => {
    const draft = buildRecommendationsDraft(conclusions);
    expect(draft?.recommendations).toHaveLength(1);
    expect(draft?.recommendations[0].conclusionStatement).toBe(conclusions.conclusions[0].conclusionStatement);
    expect(draft?.recommendations[0].recommendationText).toBe('');
  });

  test('accepts an actionable recommendation grounded in its conclusion', () => {
    const recommendations = completeRecommendations();
    expect(researchRecommendationsStructureIssue(recommendations)).toBeNull();
    expect(researchRecommendationsConsistencyIssue(recommendations, conclusions)).toBeNull();
  });

  test('rejects changing the approved conclusion', () => {
    const recommendations = completeRecommendations();
    recommendations.recommendations[0].conclusionStatement = 'استنتاج جديد لم يُعتمد في المرحلة السابقة.';
    expect(researchRecommendationsConsistencyIssue(recommendations, conclusions)).toContain('نص الاستنتاج');
  });

  test('rejects an unsupported numeric target in recommendation text', () => {
    const recommendations = completeRecommendations();
    recommendations.recommendations[0].recommendationText += ' على أن يشمل التطبيق 88% من الطلبة.';
    expect(researchRecommendationsConsistencyIssue(recommendations, conclusions)).toContain('88%');
  });

  test('requires a real target audience and actionable text', () => {
    const recommendations = completeRecommendations();
    recommendations.recommendations[0].targetAudience = '';
    expect(researchRecommendationsStructureIssue(recommendations)).toContain('الجهة المستهدفة');
  });
});
