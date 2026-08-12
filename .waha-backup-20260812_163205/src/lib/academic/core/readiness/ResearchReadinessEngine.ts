import { IntentAnalysisResult } from '../../types/IntentAnalysisResult';
import { ReadinessAssessment } from '../../types/ReadinessAssessment';

export class ResearchReadinessEngine {
  public assess(intentResult: IntentAnalysisResult): ReadinessAssessment {
    const missingElements: string[] = [];
    const ambiguities: string[] = [];
    const caveats: string[] = [];

    // 1. Non-research intent is never ready
    if (intentResult.intent === 'NON_RESEARCH') {
      return {
        isReady: false,
        missingElements: ['النص المرسل ليس له علاقة بالبحث العلمي'],
        ambiguities: [],
        proceedWithCaveats: false,
        caveats: []
      };
    }

    // 2. If user has no idea, they need guidance, but system is ready to suggest topics
    if (intentResult.intent === 'NO_IDEA') {
      return {
        isReady: true,
        missingElements: [],
        ambiguities: ['لم يحدد المستخدم أي مجال بحثي مفضل'],
        proceedWithCaveats: true,
        caveats: ['سيتم اقتراح مواضيع عامة بناءً على الاتجاهات الشائعة']
      };
    }

    // 3. Check for variables if it's a title or initial idea
    if (!intentResult.independentVariable) {
      missingElements.push('المتغير المستقل غير محدد بوضوح');
    }
    if (!intentResult.dependentVariable) {
      missingElements.push('المتغير التابع غير محدد بوضوح');
    }

    // 4. Check confidence level
    if (intentResult.confidence < 70) {
      ambiguities.push('صياغة الفكرة غامضة وتحتاج إلى توضيح إضافي');
    }

    const isReady = missingElements.length === 0;
    const proceedWithCaveats = !isReady && missingElements.length <= 1;

    if (proceedWithCaveats) {
      caveats.push('تم المضي قدماً مع افتراض بعض المعايير الافتراضية للنقص الموجود');
    }

    return {
      isReady,
      missingElements,
      ambiguities,
      proceedWithCaveats,
      caveats
    };
  }
}

