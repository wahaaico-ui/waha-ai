import { AnalysisResultsResult } from './stage-11-12-analysis-results';

export interface DiscussionRecommendationsResult {
  success: boolean;
  discussion: string;
  recommendations: string[];
  qualityGatePassed: boolean;
  reason?: string;
}

/**
 * المراحل 13 و 14: مناقشة النتائج، التوصيات، والخاتمة
 */
export function executeStage13And14_DiscussionAndRecommendations(
  idea: string,
  analysisResult: AnalysisResultsResult
): DiscussionRecommendationsResult {
  if (!analysisResult.success || !analysisResult.qualityGatePassed) {
    return {
      success: false,
      discussion: '',
      recommendations: [],
      qualityGatePassed: false,
      reason: 'فشلت بوابة الجودة للمراحل (13-14): التحليل والنتائج السابقة غير مكتملة.'
    };
  }

  const discussion = `مناقشة النتائج: تتفق النتائج المستخلصة حول (${idea}) مع الأدبيات السابقة والدراسات المرجعية المعاصرة، مما يبرز أهمية تبني النماذج المبتكرة لمعالجة التحديات الميدانية المرتبطة بالبحث وتفسير الفروق الإحصائية.`;

  const recommendations = [
    `ضرورة تعزيز البنية التحتية والسياسات التنظيمية لدعم وتفعيل (${idea}) في مختلف القطاعات المستهدفة.`,
    `إجراء مزيد من الدراسات الطولية والمقارنة لتقييم الأثر الميداني على المدى الطويل.`,
    `توفير برامج تدريبية وتأهيلية متخصصة للكوادر البشرية لضمان الاستثمار الأمثل لمخرجات البحث.`
  ];

  return {
    success: true,
    discussion,
    recommendations,
    qualityGatePassed: true
  };
}
