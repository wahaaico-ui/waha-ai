export interface UniversityRule {
  name: string;
  minScoreToPass: number;
  strictFocus: string;
  prohibitedPractices: string[];
}

export class UniversityRulesProcessor {
  public static getRule(universityName: string): UniversityRule {
    const nameLower = universityName.toLowerCase();

    if (nameLower.includes("الملك سعود") || nameLower.includes("ksu")) {
      return {
        name: "جامعة الملك سعود - عمادة الدراسات العليا",
        minScoreToPass: 75,
        strictFocus: "الالتزام الصارم بـ حوكمة الصياغة المنهجية، تحديد مجتمع وعينة الدراسة بدقة إحصائية، ووضوح مشكلة الدراسة في البيئة المحلية.",
        prohibitedPractices: ["العناوين الفضفاضة", "عدم تحديد النطاق الجغرافي والزمني", "الاعتماد على الظواهر المستهلكة بدون سياق مستحدث"]
      };
    }

    if (nameLower.includes("القاهرة")) {
      return {
        name: "جامعة القاهرة - قطاع البحوث",
        minScoreToPass: 70,
        strictFocus: "أصالة الإضافة المعرفية للأدبيات العربية، سلامة أدوات جمع البيانات، والتكامل بين الأسئلة البحثية والأهداف الميدانية.",
        prohibitedPractices: ["النقل الحرفي للمنهجيات الغربية دون تكييف بيئي", "صياغة أهداف غير قابلة للقياس الميداني"]
      };
    }

    if (nameLower.includes("harvard") || nameLower.includes("هارفارد")) {
      return {
        name: "Harvard University Graduate Guide",
        minScoreToPass: 85,
        strictFocus: "High critical rigor, explicit causal relationship identification, and disruptive intellectual contribution to the global global context.",
        prohibitedPractices: ["Descriptive-only frameworks", "Weak theoretical anchoring", "Ambiguous variable operationalization"]
      };
    }

    // افتراضي في حال عدم رصد الجامعة
    return {
      name: `معايير التحكيم القياسية لـ: ${universityName}`,
      minScoreToPass: 70,
      strictFocus: "التوافق مع الأطر العامة للبحث العلمي المقارن وسلامة الهيكل البنيوي.",
      prohibitedPractices: ["العشوائية اللفظية", "عدم اتساق العنوان مع المشكلة"]
    };
  }
}
