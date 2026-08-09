/**
 * ==========================================
 * WAHA Idea Engine v1 - Core Intelligence
 * المحرك المسؤول عن تفكيك الظواهر وعزل المتغيرات
 * ==========================================
 */

import { ResearchProject } from "../models/ResearchProject";

export interface DecomposedIdea {
  independentVariable: string; // المتغير المستقل
  dependentVariable: string;   // المتغير التابع
  environmentalContext: string; // النطاق البيئي / مجتمع الدراسة
  methodologicalTrend: "وصفي تحليلي" | "تجريبي" | "كيفي" | "مختلط";
}

export class IdeaEngine {
  /**
   * تشغيل التفكيك الميكانيكي للنص واستخلاص العناصر البنيوية للظاهرة البحثية
   */
  public decompose(project: ResearchProject): DecomposedIdea {
    const ideaLower = project.idea.toLowerCase();
    
    // 1. استخلاص النطاق البيئي ومجتمع الدراسة من السياق
    let environmentalContext = "المؤسسات والمنظمات ذات الأفرع المتعددة";
    if (ideaLower.includes("مستودع") || ideaLower.includes("مخزن")) {
      environmentalContext = "إدارة سلاسل الإمداد ومستودعات الشركات الكبرى ذات الفروع المتعددة";
    } else if (ideaLower.includes("تعليم") || ideaLower.includes("مدرسة")) {
      environmentalContext = "المؤسسات التعليمية والأكاديمية";
    }

    // 2. محاولة عزل المتغيرات بشكل بنيوي أولي بناءً على الكلمات المفتاحية
    let independentVariable = "إستراتيجيات الإدارة والتحول الرقمي";
    let dependentVariable = "كفاءة الأداء التشغيلي والإنتاجية";
    const methodologicalTrend: "وصفي تحليلي" | "تجريبي" | "كيفي" | "مختلط" = "وصفي تحليلي";

    if (ideaLower.includes("مخزون") || ideaLower.includes("المخازن")) {
      independentVariable = "نظم وأدوات إدارة المخزون الرقمية الذكية";
      dependentVariable = "كفاءة الإمداد والحد من الهدر المالي والتشغيلي في الفروع";
    }

    return {
      independentVariable,
      dependentVariable,
      environmentalContext,
      methodologicalTrend
    };
  }
}
