/**
 * ==========================================
 * WAHA Project Model v2.0 - Context Enabled
 * النموذج الحاكم والموحد لكافة بيانات ومراحل المشروع البحثي
 * ==========================================
 */

export interface DecisionLog {
  stageEvaluated: number;
  status: "PASS" | "FAIL";
  scoreCalculated: number;
  timestamp: string;
  errorsFound: string[];
  warningsFound: string[];
}

/**
 * الكيان المعماري الحاسم المقيد لخط الإنتاج المتسلسل
 * يمنع المحركات اللاحقة من التخمين أو إعادة التحليل من الصفر
 */
export interface ProjectStageContext {
  originalIdea: string;               // الفكرة الأصلية المكتوبة من المستخدم
  optimalTitle: string;               // العنوان الفائز والمصادق عليه من Title Engine
  independentVariable: string;        // المتغير المستقل المعزول إحصائياً (X)
  dependentVariable: string;          // المتغير التابع المقاس (Y)
  targetPopulation: string;           // مجتمع الدراسة وعينة البحث (P)
  environmentalContext: string;       // النطاق البيئي والجغرافي (C)
  relationshipType: "causal" | "correlation" | "developmental" | "descriptive"; // نوع العلاقة المنهجية المكتشفة
  originalityScore: number;           // درجة الأصالة المثبتة
  evidenceStrength: number;           // قوة الأدلة المستقاة من Crossref/OpenAlex
  recentReferencesFound: Array<{
    title?: string;
    doi?: string;
    publicationYear?: number | null;
    authors?: string;
    source?: string;
  }>;       // مصفوفة المراجع الحية الحقيقية المكتشفة بالـ API
  universityMinScore: number;         // شرط الحد الأدنى للجامعة المستهدفة
}

export interface ResearchProject {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  
  // إعدادات البيئة الأكاديمية المستهدفة
  language: "العربية" | "الإنجليزية";
  country: string;
  university: string;
  college: string;
  department: string;
  degree: "ماجستير" | "دكتوراه" | "بحث ترقية";
  
  researchType: string;
  citationStyle: "APA" | "IEEE" | "MLA" | "Chicago";
  supervisor: string;
  
  // التحكم في خط الإنتاج عبر المراحل الـ 12
  currentStage: number;
  completedStages: number[];
  score: number;
  
  // المدخلات الفكرية الأولية للباحث
  idea: string;
  
  // كائن السياق المعرفي المركزي (المصدر الموحد والوحيد للمحركات بعد الآن)
  researchContext?: ProjectStageContext;
  
  // سجل البيانات التفصيلي للمراحل الـ 12 (للشحن التاريخي لاحقاً)
  title: string;
  problem: string;
  gap: string;
  objectives: string;
  questions: string;
  hypotheses: string;
  variables: string;
  methodology: string;
  references: string;
  writing: string;
  
  // الرقابة التاريخية وخطط العمل
  decisionHistory: DecisionLog[];
  warnings: string[];
  errors: string[];
  recommendations: string[];
}
