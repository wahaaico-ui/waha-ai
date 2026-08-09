/**
 * ==========================================
 * WAHA Problem Engine v1.0 - Context Driven
 * المحرك المسؤول عن حوكمة وصياغة مشكلة الدراسة
 * ==========================================
 */

import { ProjectStageContext } from "../models/ResearchProject";

export interface ProblemEngineOutput {
  problemStatementRaw: string;  // النص الخام المصاغ لمشكلة الدراسة البحثية
  justificationScore: number;   // درجة قوة مسوغات المشكلة (0-100)
  detectedFlaws: string[];     // القصور المنهجي المكتشف في مبررات المشكلة
  actionPlan: string[];        // خطوات العلاج الإجرائية المطلوبة للعبور
}

export class ProblemEngine {
  /**
   * دالة إدارة وتوليد مشكلة الدراسة بالاعتماد الحصري والمطلق على الـ ResearchContext
   * يُحظر تماماً قراءة الـ User Idea النصية المباشرة من هنا لضمان اتساق الأنابيب
   */
  public executeAnalysis(
    context: ProjectStageContext,
    aiRawResult: {
      proves_causality?: boolean;
      anchored_in_population?: boolean;
      problem_score?: number;
      generated_problem_statement?: string;
      suggestions?: string[];
    }
  ): ProblemEngineOutput {
    
    const detectedFlaws: string[] = [];
    const actionPlan: string[] = [];
    
    // 1. فحص ومطابقة آلية إثبات وتكامل المتغيرات داخل المشكلة برمجياً
    if (context.relationshipType === "causal" && !aiRawResult.proves_causality) {
      detectedFlaws.push(`ضعف مسوغات الأثر: الصياغة لم تبرهن بدقة كيف يؤثر المتغير المستقل (${context.independentVariable}) حقيقة على المتغير التابع (${context.dependentVariable}).`);
      actionPlan.push("قم بشحن مسودة المشكلة بأدلة إحصائية أو شواهد ميدانية تثبت وجود خلل حقيقي يتطلب هذه المعالجة.");
    }

    // 2. فحص مطابقة وتوطين المشكلة داخل مجتمع وعينة الدراسة المعتمدة في العنوان
    if (!aiRawResult.anchored_in_population) {
      detectedFlaws.push(`خرق النطاق البيئي: مبررات المشكلة لم تنعكس بشكل ملموس على مجتمع الدراسة المحدد وهو (${context.targetPopulation}).`);
      actionPlan.push(`أعد صياغة الفقر الميدانية لتربط القصور التشغيلي مباشرة بـ (${context.environmentalContext}).`);
    }

    // 3. تقييد وضبط الدرجة الرياضية لمسوغات المشكلة بناءً على القيود المكتشفة
    let justificationScore = aiRawResult.problem_score || 60;
    if (detectedFlaws.length > 0) {
      justificationScore -= detectedFlaws.length * 15;
    }
    justificationScore = Math.min(Math.max(justificationScore, 0), 100);

    return {
      problemStatementRaw: aiRawResult.generated_problem_statement || "لم يتم صياغة مبررات المشكلة لعدم استيفاء الشروط البنيوية لسياق البحث.",
      justificationScore,
      detectedFlaws,
      actionPlan: detectedFlaws.length === 0 ? ["البنية المنهجية لمشكلة الدراسة متسقة تماماً مع المتغيرات والمجتمع، يمكنك العبور."] : actionPlan
    };
  }
}
