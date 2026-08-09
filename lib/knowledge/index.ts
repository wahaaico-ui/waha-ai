/**
 * ==========================================
 * WAHA Knowledge Engine - Central Core Index
 * ==========================================
 */
import { ResearchProject } from "../models/ResearchProject";
import { EvidenceAggregator } from "../evidence/EvidenceAggregator";

export interface CompiledKnowledgeContext {
  universityName: string;
  universityFocus: string;
  prohibitedPractices: string[];
  minScore: number;
  citationStyle: string;
  citationFormat: string;
  recencyRule: string;
  variablesFramework: string;
  gapFramework: string;
  methodologyFramework: string;
  generalFramework: string;
}

export class KnowledgeEngine {
  public loadRules(project: ResearchProject) {
    const university = project.university || "جامعة الملك سعود";
    let universityRules = "المعايير المنهجية العامة لاعتماد الأطروحات العلمية.";
    let documentedRestrictions: string[] = [];

    if (university.includes("الملك سعود") || university.includes("KSU")) {
      universityRules = "دليل كتابة الرسائل لجامعة الملك سعود: الالتزام بوضوح مشكلة الدراسة وتكامل الهيكل الإحصائي.";
      documentedRestrictions = ["العناوين الفضفاضة", "عدم تحديد النطاق الجغرافي والزمني", "غياب عزل المتغيرات"];
    } else if (university.includes("القاهرة")) {
      universityRules = "قواعد قطاع الدراسات العليا لجامعة القاهرة: التركيز على أصالة الإضافة المعرفية وملاءمة أدوات الدراسة.";
      documentedRestrictions = ["النقل الحرفي للمنهجيات الغربية دون تكييف بيئي", "أهداف غير قابلة للقياس"];
    }

    return {
      universityRules,
      styleGuideRules: "دليل التوثيق المعتمد",
      recencyRequirement: "قوانين الحداثة: مراجع الإطار النظري لآخر 5 سنوات.",
      gapThreshold: project.degree === "دكتوراه" ? 85 : 70,
      documentedRestrictions
    };
  }

  public compileKnowledge(project: ResearchProject): CompiledKnowledgeContext {
    const activeRules = this.loadRules(project);
    return {
      universityName: activeRules.universityRules,
      universityFocus: activeRules.universityRules,
      prohibitedPractices: activeRules.documentedRestrictions,
      minScore: activeRules.gapThreshold,
      citationStyle: activeRules.styleGuideRules,
      citationFormat: activeRules.styleGuideRules,
      recencyRule: activeRules.recencyRequirement,
      variablesFramework: "إطار فحص المتغيرات القياسي للمنصة",
      gapFramework: "إطار فحص الفجوة والمشكلة الحقيقية",
      methodologyFramework: "الالتزام التام بقواعد فحص الصلاحية",
      generalFramework: "التدقيق المنهجي الخالص المعزول"
    };
  }
}

export class AcademicValidator {
  public static validateAndFilter(errors: string[], warnings: string[], allowedRules: string[]) {
    const triggerKeywords = ["ممنوع", "غير مسموح", "مخالف للجامعة", "لا تقبله الجامعة"];
    const filteredErrors: string[] = [];
    const logs: string[] = [];

    errors.forEach((err) => {
      const containsTrigger = triggerKeywords.some(keyword => err.includes(keyword));
      if (containsTrigger) {
        const isSupportedByDb = allowedRules.some(rule => err.toLowerCase().includes(rule.toLowerCase()));
        if (isSupportedByDb) {
          filteredErrors.push(err);
        } else {
          filteredErrors.push("لا توجد قاعدة جامعية موثقة تمنع ذلك، ولكن يوصى بمزيد من التحديد الأكاديمي.");
          logs.push(`AcademicValidator Guard: Blocked rule -> "${err}"`);
        }
      } else {
        filteredErrors.push(err);
      }
    });
    return { filteredErrors, logs };
  }
}

export class ReferenceDatabaseVerificator {
  public static async verifyConsumptionClaim(errors: string[], ideaText: string): Promise<string[]> {
    const consumptionKeywords = ["الموضوع مستهلك", "سبق بحثه", "مكرر"];
    const containsClaim = errors.some(err => consumptionKeywords.some(keyword => err.includes(keyword)));
    if (!containsClaim) return errors;

    try {
      const aggregator = new EvidenceAggregator();
      const evidenceReport = await aggregator.aggregateEvidence(ideaText);
      return errors.map(err => {
        const matchesKeyword = consumptionKeywords.some(keyword => err.includes(keyword));
        if (matchesKeyword) {
          if (evidenceReport.similarity < 30 || evidenceReport.papersFound === 0) {
            return "لا يمكن الجزم بدرجة تكرار الموضوع قبل التحقق من قواعد البيانات العلمية.";
          }
          const topPaper = evidenceReport.recentReferences[0];
          return `مخالفة الأصالة: المقترح البحثي يحمل تكراراً معرفياً مع الأدبيات المنشورة. دراسة مشابهة مكتشفة حقيقياً: "${topPaper.title}" (معرف رقمي: ${topPaper.doi}).`;
        }
        return err;
      });
    } catch (e) {
      return errors.map(err => consumptionKeywords.some(k => err.includes(k)) ? "لا يمكن الجزم بدرجة تكرار الموضوع قبل التحقق من قواعد البيانات العلمية." : err);
    }
  }
}
