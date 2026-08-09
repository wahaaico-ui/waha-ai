import { ProblemGapResult } from './stage-2-problem-gap';

export interface ObjectivesQuestionsResult {
  success: boolean;
  objectives: string[];
  questions: string[];
  qualityGatePassed: boolean;
  reason?: string;
}

/**
 * المراحل 4 و 5: صياغة الأهداف والأسئلة البحثية بناءً على الفجوة والمشكلة
 */
export function executeStage4And5_ObjectivesAndQuestions(
  idea: string,
  problemGap: ProblemGapResult
): ObjectivesQuestionsResult {
  // بوابة الجودة: لا يمكن اشتقاق الأهداف والأسئلة إذا لم تكن المشكلة والفجوة محققتين
  if (!problemGap.success || !problemGap.qualityGatePassed) {
    return {
      success: false,
      objectives: [],
      questions: [],
      qualityGatePassed: false,
      reason: 'فشلت بوابة الجودة للمراحل 4 و 5: المشكلة والفجوة البحثية غير مكتملة أو مرفوضة.'
    };
  }

  // الاشتقاق المنهجي للأهداف
  const objectives = [
    سّد الفجوة المعرفية المتعلقة بـ (${idea}) وتحليل أبعادها المختلفة.,
    تقييم الأثر المباشر وغير المباشر للمتغيرات الأساسية ضمن الإطار البحثي المحدد.,
    تقديم إطار مقترح أو توصيات علمية مبنية على الأدلة المستخلصة.
  ];

  // الاشتقاق المنهجي لأسئلة البحث
  const questions = [
    إلى أي مدى تؤثر المعطيات الحالية على تطوير إطار العمل الخاص بـ (${idea})؟,
    ما هي التحديات الرئيسية التي تعرقل معالجة هذه الفجوة المعرفية؟,
    كيف يمكن بناء نموذج علمي محكم يسهم في سد هذه الفجوة بكفاءة عالية؟
  ];

  return {
    success: true,
    objectives,
    questions,
    qualityGatePassed: true
  };
}
