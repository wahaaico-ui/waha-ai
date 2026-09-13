import { assessAcademicText } from '@/lib/academic-content-quality';
import { firstUnsupportedResearchNumber } from '@/lib/research-numeric-integrity';

export type RecommendationType = 'practice' | 'policy' | 'future_research';
export type RecommendationHorizon = 'immediate' | 'short_term' | 'long_term';

export type ResearchRecommendationItem = {
  questionIndex: number;
  questionText: string;
  conclusionStatement: string;
  recommendationType: RecommendationType;
  targetAudience: string;
  implementationHorizon: RecommendationHorizon;
  recommendationText: string;
};

export type ResearchRecommendationsOutput = {
  recommendations: ResearchRecommendationItem[];
  overallPriorities: string;
  feasibilityNote: string;
  conclusionGroundingConfirmed: true;
  noNewFindingsConfirmed: true;
};

type RecordValue = Record<string, unknown>;

const TYPES: readonly RecommendationType[] = ['practice', 'policy', 'future_research'];
const HORIZONS: readonly RecommendationHorizon[] = ['immediate', 'short_term', 'long_term'];
const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalize = (value: unknown) => asText(value).normalize('NFKC').replace(/\s+/g, ' ');
const records = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  : [];

export function isRecommendationType(value: unknown): value is RecommendationType {
  return typeof value === 'string' && (TYPES as readonly string[]).includes(value);
}

export function isRecommendationHorizon(value: unknown): value is RecommendationHorizon {
  return typeof value === 'string' && (HORIZONS as readonly string[]).includes(value);
}

export function researchRecommendationsStructureIssue(output: RecordValue | undefined): string | null {
  if (!output) return 'راجع التوصيات واعتمدها قبل المتابعة.';
  if (output.conclusionGroundingConfirmed !== true) return 'أكد أن كل توصية مشتقة من استنتاج معتمد.';
  if (output.noNewFindingsConfirmed !== true) return 'أكد أن التوصيات لا تقدّم نتائج جديدة على أنها حقائق.';
  const recommendations = records(output.recommendations);
  if (!recommendations.length) return 'يجب أن توجد توصية واحدة على الأقل مرتبطة باستنتاج الدراسة.';

  for (const [index, recommendation] of recommendations.entries()) {
    if (!Number.isInteger(recommendation.questionIndex) || Number(recommendation.questionIndex) < 0) return `التوصية ${index + 1}: ارتباط السؤال غير صالح.`;
    if (!isRecommendationType(recommendation.recommendationType)) return `التوصية ${index + 1}: حدد نوع التوصية.`;
    if (!isRecommendationHorizon(recommendation.implementationHorizon)) return `التوصية ${index + 1}: حدد أفق التنفيذ.`;
    const audienceIssue = assessAcademicText(recommendation.targetAudience, { minChars: 8, minWords: 2, label: `الجهة المستهدفة في التوصية ${index + 1}` });
    if (!audienceIssue.valid) return audienceIssue.reason;
    const recommendationIssue = assessAcademicText(recommendation.recommendationText, { minChars: 55, minWords: 9, label: `صياغة التوصية ${index + 1}` });
    if (!recommendationIssue.valid) return recommendationIssue.reason;
  }

  const prioritiesIssue = assessAcademicText(output.overallPriorities, { minChars: 60, minWords: 10, label: 'ترتيب أولويات التوصيات' });
  if (!prioritiesIssue.valid) return prioritiesIssue.reason;
  const feasibilityIssue = assessAcademicText(output.feasibilityNote, { minChars: 40, minWords: 7, label: 'ملاحظة قابلية التنفيذ' });
  return feasibilityIssue.valid ? null : feasibilityIssue.reason;
}

export function researchRecommendationsConsistencyIssue(
  output: RecordValue | undefined,
  conclusionsOutput: RecordValue | undefined,
): string | null {
  const structureIssue = researchRecommendationsStructureIssue(output);
  if (structureIssue || !output) return structureIssue;
  const conclusions = records(conclusionsOutput?.conclusions);
  const recommendations = records(output.recommendations);
  if (!conclusions.length) return 'لا توجد استنتاجات معتمدة يمكن اشتقاق التوصيات منها.';
  if (recommendations.length !== conclusions.length) return 'يجب صياغة توصية واحدة على الأقل لكل استنتاج معتمد.';

  for (const [index, conclusion] of conclusions.entries()) {
    const recommendation = recommendations.find((item) => Number(item.questionIndex) === Number(conclusion.questionIndex));
    if (!recommendation) return `لم تُكتب توصية مرتبطة باستنتاج السؤال ${index + 1}.`;
    if (normalize(recommendation.questionText) !== normalize(conclusion.questionText)) return `التوصية ${index + 1}: سؤال البحث لا يطابق الاستنتاج المعتمد.`;
    if (normalize(recommendation.conclusionStatement) !== normalize(conclusion.conclusionStatement)) return `التوصية ${index + 1}: نص الاستنتاج تغيّر ولا يمكن تعديله من هذه المرحلة.`;

    const unsupportedNumber = firstUnsupportedResearchNumber(
      `${asText(recommendation.targetAudience)} ${asText(recommendation.recommendationText)}`,
      `${asText(conclusion.conclusionStatement)} ${asText(conclusionsOutput?.overallConclusion)} ${asText(conclusionsOutput?.scopeStatement)}`,
    );
    if (unsupportedNumber) return `التوصية ${index + 1}: القيمة «${unsupportedNumber}» ليست مستندة إلى الاستنتاجات المعتمدة. استخدم حقل أفق التنفيذ بدلاً من اختراع رقم.`;
  }
  const conclusionText = `${conclusions.map((conclusion) => asText(conclusion.conclusionStatement)).join(' ')} ${asText(conclusionsOutput?.overallConclusion)} ${asText(conclusionsOutput?.scopeStatement)}`;
  const overallNumber = firstUnsupportedResearchNumber(`${asText(output.overallPriorities)} ${asText(output.feasibilityNote)}`, conclusionText);
  if (overallNumber) return `أولويات التوصيات تتضمن القيمة «${overallNumber}» وهي غير موجودة في الاستنتاجات المعتمدة.`;
  return null;
}

export function buildRecommendationsDraft(conclusionsOutput: RecordValue | undefined): ResearchRecommendationsOutput | null {
  const conclusions = records(conclusionsOutput?.conclusions);
  if (!conclusions.length) return null;
  return {
    recommendations: conclusions.map((conclusion) => ({
      questionIndex: Number(conclusion.questionIndex),
      questionText: asText(conclusion.questionText),
      conclusionStatement: asText(conclusion.conclusionStatement),
      recommendationType: 'practice',
      targetAudience: '',
      implementationHorizon: 'short_term',
      recommendationText: '',
    })),
    overallPriorities: '',
    feasibilityNote: asText(conclusionsOutput?.scopeStatement),
    conclusionGroundingConfirmed: true,
    noNewFindingsConfirmed: true,
  };
}
