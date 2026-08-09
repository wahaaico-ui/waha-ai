/**
 * ==========================================
 * WAHA Decision & Scoring Engine v2.0 - Stable
 * ==========================================
 */


export interface DecisionResult {
  canAdvance: boolean;
  status: "PASS" | "FAIL";
  evaluatedScore: number;
  blockingReasons: string[];
  actionPlan: string[];
}

/**
 * [المشكلة الرابعة]: ScoringEngine
 * محرك احتساب النقاط بناءً على وزن الـ Rubric الرياضي الصارم (الحد الأقصى: 100)
 */
export class ScoringEngine {
  public static calculateFromRubric(aiScores: {
    originalityExplanation: string;
    gapExplanation: string;
    variablesExplanation: string;
    methodologyExplanation: string;
    referencesExplanation: string;
    originalityWeight: number;      // Max 20
    gapWeight: number;              // Max 20
    variablesWeight: number;        // Max 20
    methodologyWeight: number;      // Max 20
    referencesWeight: number;       // Max 20
  }): { finalScore: number; breakdownReport: string[] } {
    
    const o = Math.min(Math.max(aiScores.originalityWeight || 10, 0), 20);
    const g = Math.min(Math.max(aiScores.gapWeight || 10, 0), 20);
    const v = Math.min(Math.max(aiScores.variablesWeight || 10, 0), 20);
    const m = Math.min(Math.max(aiScores.methodologyWeight || 10, 0), 20);
    const r = Math.min(Math.max(aiScores.referencesWeight || 10, 0), 20);

    const finalScore = o + g + v + m + r;

    const breakdownReport = [
      `الأصالة العلمية (Originality): ${o}/20 - التفسير: ${aiScores.originalityExplanation}`,
      `الفجوة البحثية (Research Gap): ${g}/20 - التفسير: ${aiScores.gapExplanation}`,
      `سلامة المتغيرات (Variables): ${v}/20 - التفسير: ${aiScores.variablesExplanation}`,
      `جاهزية المنهجية (Methodology Readiness): ${m}/20 - التفسير: ${aiScores.methodologyExplanation}`,
      `جاهزية المراجع (References Readiness): ${r}/20 - التفسير: ${aiScores.referencesExplanation}`
    ];

    return { finalScore, breakdownReport };
  }
}

interface EvaluationKnowledge {
  minScore?: number;
}

interface EvaluationOutput {
  variables?: boolean | string;
  suggestions?: string[];
}

export class DecisionEngine {
  public evaluate(aiOutput: EvaluationOutput, knowledge: EvaluationKnowledge, rubricScore: number, finalErrors: string[]): DecisionResult {
    const minRequiredScore = knowledge.minScore || 70;
    const blockingReasons: string[] = [...finalErrors];
    const actionPlan: string[] = [];

    if (rubricScore < minRequiredScore) {
      blockingReasons.push(
        `إخفاق إجمالي: مجموع درجات التقييم المبني على الـ Rubric هو ${rubricScore}%, وهو أقل من حد الجامعة المطلوب وهو ${minRequiredScore}%.`
      );
    }

    if (aiOutput.variables === false || aiOutput.variables === "false") {
      actionPlan.push("قم بإعادة ضبط صياغة المتغيرات المستخلصة لضمان تكامل القياس الإحصائي.");
    }

    if (aiOutput.suggestions && aiOutput.suggestions.length > 0) {
      aiOutput.suggestions.forEach((s: string) => actionPlan.push(s));
    }

    const canAdvance = blockingReasons.length === 0;

    return {
      canAdvance,
      status: canAdvance ? "PASS" : "FAIL",
      evaluatedScore: rubricScore,
      blockingReasons,
      actionPlan: canAdvance ? ["تم استيفاء معايير الـ Rubric ولوائح الجامعة، يمكنك الانتقال للمرحلة التالية."] : actionPlan
    };
  }
}
