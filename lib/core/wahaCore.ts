/**
 * ==========================================
 * WAHA Core Engine v5.6.0 - Firewall Calibration Fixed
 * نظام تشغيل البحوث العلمية - معايرة جدار الحماية لمنع طرد الأمثلة العلمية
 * ==========================================
 */

import { ResearchProject, ProjectStageContext } from "../models/ResearchProject";
import { AIConnector } from "./aiConnector";
import { KnowledgeEngine } from "../knowledge";
import { DecisionEngine } from "./decisionEngine";

export class PromptBuilder {
  public static buildStagePrompt(
    project: ResearchProject,
    variables: { independent: string; dependent: string; population: string; context: string },
    knowledge: { universityName?: string; prohibitedPractices?: string[]; recencyRule?: string },
    context?: ProjectStageContext
  ): string {
    const contextSegment = context ? `
[4. ACTIVE RESEARCH CONTEXT - سياق التجميع المتسلسل الملزم]
العنوان الأكاديمي المصادق عليه بالنظام: "${context.optimalTitle}"
المتغير المستقل الموروث (X): ${context.independentVariable}
المتغير التابع الموروث (Y): ${context.dependentVariable}
مجتمع الدراسة وعينة البحث (P): ${context.targetPopulation}
النطاق والبيئة الجغرافية الميدانية (C): ${context.environmentalContext}
- يحظر صياغة النقد أو مبررات المشكلة خارج أطر هذا السياق والعنوان الممرر نهائياً.
    ` : `
[4. RAW RESEARCH INPUT - الفكرة الأولية للباحث]
النص الفعلي المكتوب من الباحث: "${project.idea}"
المتغير المستقل المستخلص مسبقاً (X): ${variables.independent}
المتغير التابع المستخلص مسبقاً (Y): ${variables.dependent}
مجتمع الدراسة (P): ${variables.population}
النطاق البيئي (C): ${variables.context}
    `;

    return `
[1. SYSTEM RULES] أنت رئيس اللجنة العلمية والمحكم الأكاديمي الصارم لمنصة WAHA AI الأكاديمية.
لغة الصياغة والتحكيم الإلزامية: (${project.language}). 
ممنوع ذكر مصطلحات تجميلية أو تسويقية أو كلمات توليد مثل (ذكاء اصطناعي، OpenAI، GPT، نموذج، روبوت، تم التوليد).

[2. UNIVERSITY RULES] لوائح الجامعة المستهدفة:
الجامعة: ${knowledge.universityName} | مستوى الدرجة: ${project.degree} | الممارسات المحظورة قطرياً باللوائح: ${knowledge.prohibitedPractices?.join(" - ") || "No Data"}

[3. ACADEMIC RUBRIC CRITERIA] معايير التحكيم المؤسسي لخصم النقاط:
- الأصالة والجدة (0-20) | الفجوة المعرفية للمشكلة (0-20) | اتساق المتغيرات (0-20) | جاهزية المنهجية (0-20) | حداثة المراجع لآخر 5 سنوات (0-20).

${contextSegment}

[5. CRITICAL OUTPUT CONTRACTIONS - قيود صياغة النقد الأكاديمي]
- يحظر كتابة جمل إنشائية أو عامة. أي ملاحظة نقدية أو خصم نقاط يجب أن يحتوي حرفياً على البنية الثلاثية:
  1. السبب (الخلل الفعلي المكتشف في نص فكرة الباحث الممررة حصراً).
  2. التأثير (الأثر المنهجي السلبي لهذا الخلل على سلامة الرسالة أمام لجنة المناقشة).
  3. طريقة الإصلاح (خطة عمل إجرائية واضحة للباحث لتعديل وتجاوز الخلل).
- إذا كانت المدخلات عبارة عن نص عشوائي صرف، أو كلمات مكررة غير مفهومة، أو تخبيص (مثل هقهقهق أو عثعثعث)، يجب تصفير كافة الدرجات فوراً وإرجاع حقل originality بقيمة 0 وحقل status بقيمة "FAIL".

[6. OUTPUT SCHEMA - صيغة الاستجابة الهيكلية الإلزامية لـ JSON]
رجع كائن JSON نظيف تماماً وخالٍ من التيك مارك والWrapper ومطابق للمسميات التالية حرفياً وبدون أي نصوص برانية:
{
  "status": "PASS" أو "FAIL",
  "originality": number (0-20 بناءً على جودة الفكرة الفعلية الممررة، 0 للتخبيص),
  "originality_explanation": "نص النقد الثلاثي للأصالة، أو No Data إن استوفت الشروط",
  "gap": number (0-20),
  "gap_explanation": "نص النقد الثلاثي للفجوة المعرفية",
  "methodology_score": number (0-20),
  "methodology_explanation": "نص النقد الثلاثي للمنهجية والمشكلة",
  "feasibility": number (0-20),
  "references_explanation": "نص النقد الثلاثي للمراجع والجدوى الميدانية",
  "variables": boolean (true إذا احتوى النص على مستقل وتابع، وإلا false),
  "variables_explanation": "تفسير عزل المتغيرات الفعلي للفكرة",
  "errors": ["نص خطأ صريح ومبرهن يوضح سبب عدم صلاحية الفكرة، وإلا مصفوفة فارغة"],
  "warnings": [],
  "suggestions": ["خطوات معالجة الخلل الفعلي المكتشف"],
  "title": "صياغة عنوان أكاديمي رصين جداً ومبتكر مشتق حصراً وحركياً من فكرة الباحث الفعلية، وممنوع إرجاع مسميات ثابتة مسبقاً، وإلا No Data",
  "proves_causality": boolean,
  "anchored_in_population": boolean,
  "problem_score": number (0-100 جودة المشكلة الفعلي),
  "generated_problem_statement": "صياغة فِقرة بيان مشكلة الدراسة بطريقة أكاديمية جافة وصارمة جداً مستندة للفكرة الفعلية المكتوبة بيده حصراً، وإلا No Data"
}
    `.trim();
  }
}

export class ProblemEngine {
  public executeAnalysis(
    context: ProjectStageContext,
    aiRaw: {
      proves_causality?: boolean;
      anchored_in_population?: boolean;
      problem_score?: number;
      generated_problem_statement?: string;
      suggestions?: string[];
    }
  ) {
    const criticalIssues: string[] = [];
    if (!aiRaw.proves_causality) criticalIssues.push("ضعف مسوغات الأثر السببي: الصياغة لم تبرهن بدقة ترابط الأبعاد المنهجية.");
    if (!aiRaw.anchored_in_population) criticalIssues.push("خلل النطاق البيئي: مبررات المشكلة لم تنعكس بشكل ملموس على مجتمع الدراسة المستهدف.");

    return {
      problemStatementRaw: aiRaw.generated_problem_statement || "No Data",
      justificationScore: aiRaw.problem_score || 0,
      detectedFlaws: criticalIssues,
      actionPlan: aiRaw.suggestions || ["أعد صياغة الأبعاد المعرفية بدقة."]
    };
  }
}

export class VariableExtractor {
  public static extractPreAnalysis(text: string) {
    if (!text || text.trim().length < 5) {
      return { independent: "No Data", dependent: "No Data", population: "No Data", context: "No Data" };
    }
    const txt = text.toLowerCase().trim();
    let independent = "No Data";
    let dependent = "No Data";
    const population = "No Data";
    const context = "No Data";

    if (txt.includes("أثر") || txt.includes("تأثير") || txt.includes("علاقة")) {
      const parts = text.split(/على|العلاقة بين|أثر|تأثير/);
      if (parts && parts[0]) independent = parts[0].trim();
      if (parts && parts[1]) dependent = parts[1].trim();
    }
    
    const tokens = txt.split(/[\s,.\-\/]+/).filter(t => t.length > 2);
    if (tokens.length >= 2 && independent === "No Data") {
      independent = tokens[0] + " " + (tokens[1] || "");
      dependent = tokens[tokens.length - 1] + " " + (tokens[tokens.length - 2] || "");
    }

    return { independent, dependent, population, context };
  }
}

export class WahaCoreEngine {
  private version = "5.6.0";
  private aiConnector = new AIConnector();
  private knowledgeEngine = new KnowledgeEngine();
  private decisionEngine = new DecisionEngine();
  private problemEngine = new ProblemEngine();

  public async analyzeProject(project: ResearchProject): Promise<Record<string, unknown>> {
    const txt = project.idea?.trim() || "";
    
    // 🛡️ إعادة معايرة جدار الحماية: طرد حصري وحازم للتخبيص والرموز الميتة (مثل ههقههق أو عثعثعث أو الرموز المبهمة)
    // الجمل العلمية القصيرة المفهومة (مثل أمثلة النظام المعتمدة) تمر بأمان ليتم فحصها حركياً وحياً بالـ API
    const isMockBanned = txt.includes("هقهق") || txt.includes("عثعث") || txt.includes("خثخث") || /^[^\u0600-\u06FFa-zA-Z0-9]+$/.test(txt);
    
    if (!txt || txt.length < 5 || isMockBanned) {
      return {
        status: "FAIL",
        score: 0,
        originality: 0,
        feasibility: 0,
        gap: 0,
        variables: false,
        errors: ["مرفوض قطرياً: المدخلات المكتوبة عبارة عن نص عشوائي أو مبهم ولا تشكل فكرة بحثية صالحة للفحص المنهجي حياً."],
        warnings: [],
        suggestions: ["أعد صياغة مقترحك البحثي بلغة علمية مفهومة تحتوي على ظاهرة ومتغيرات صريحة لتشغيل التحكيم حياً."],
        title: "No Data",
        problem: "No Data",
        canAdvance: false,
        metadata: { processedAt: new Date().toISOString(), engineVersion: this.version }
      };
    }

    const preExtracted = VariableExtractor.extractPreAnalysis(project.idea);
    const activeRules = this.knowledgeEngine.loadRules(project);
    const compiledKnowledge = { 
      universityName: activeRules.universityRules, 
      universityFocus: activeRules.universityRules, 
      prohibitedPractices: activeRules.documentedRestrictions, 
      recencyRule: activeRules.recencyRequirement 
    };
    
    // 1. التمرير الحقيقي للـ API الفري وبناء المخرجات حياً من نص المستخدم الصافي
    const systemPromptInitial = PromptBuilder.buildStagePrompt(project, preExtracted, compiledKnowledge);
    const userPrompt = `المقترح البحثي الفعلي للباحث:\n"${project.idea}"`;
    const aiRawResult = await this.aiConnector.callOpenAI(systemPromptInitial, userPrompt);
    
    // جدار الحماية الثاني: إذا حكم الموديل بوجود قصور حاد في صياغة الفكرة المعرفية
    if (aiRawResult.status === "FAIL" || aiRawResult.originality === 0 || !aiRawResult.title || aiRawResult.title === "No Data") {
      return {
        status: "FAIL",
        score: 0,
        originality: 0,
        feasibility: 0,
        gap: 0,
        variables: false,
        errors: ["مخالفة معايير الأصالة: النص المدخل يفتقر لوجود ظاهرة علمية أو متغيرات بحثية (مستقلة وتابعة) صالحة للقياس."],
        warnings: [],
        suggestions: ["تأكد من إدخال مبررات تشغيلية أو مشكلة واقعية ملموسة تتماشى مع المجال المختار."],
        title: "No Data",
        problem: "No Data",
        canAdvance: false,
        metadata: { processedAt: new Date().toISOString(), engineVersion: this.version }
      };
    }

    const optimalTitle = typeof aiRawResult.title === 'string' ? aiRawResult.title : 'No Data';

    const generatedContext: ProjectStageContext = {
      originalIdea: project.idea,
      optimalTitle,
      independentVariable: preExtracted.independent,
      dependentVariable: preExtracted.dependent,
      targetPopulation: "مجتمع الدراسة الفعلي للظاهرة الممررة",
      environmentalContext: "النطاق البيئي الميداني الحقيقي للبحث",
      relationshipType: "causal",
      originalityScore: typeof aiRawResult.originality === 'number' ? aiRawResult.originality : 0,
      evidenceStrength: typeof aiRawResult.feasibility === 'number' ? aiRawResult.feasibility : 0,
      recentReferencesFound: [],
      universityMinScore: activeRules.gapThreshold
    };
    project.researchContext = generatedContext;

    const contextPrompt = PromptBuilder.buildStagePrompt(project, preExtracted, compiledKnowledge, project.researchContext);
    const contextAiResult = await this.aiConnector.callOpenAI(contextPrompt, userPrompt);

    const problemExecution = this.problemEngine.executeAnalysis(project.researchContext, contextAiResult);
    project.problem = problemExecution.problemStatementRaw;

    return {
      status: aiRawResult.status === "PASS" ? "PASS" : "FAIL",
      score: Math.round(((typeof aiRawResult.originality === 'number' ? aiRawResult.originality : 0) + (typeof aiRawResult.gap === 'number' ? aiRawResult.gap : 0) + (typeof aiRawResult.feasibility === 'number' ? aiRawResult.feasibility : 0)) / 3),
      originality: typeof aiRawResult.originality === 'number' ? aiRawResult.originality : 0,
      feasibility: typeof aiRawResult.feasibility === 'number' ? aiRawResult.feasibility : 0,
      gap: typeof aiRawResult.gap === 'number' ? aiRawResult.gap : 0,
      variables: Boolean(preExtracted.independent !== "No Data" && preExtracted.dependent !== "No Data"),
      errors: problemExecution.detectedFlaws,
      warnings: [],
      suggestions: problemExecution.actionPlan,
      title: optimalTitle,
      problem: project.problem,
      canAdvance: aiRawResult.status === "PASS",
      metadata: { processedAt: new Date().toISOString(), engineVersion: this.version }
    };
  }
}
