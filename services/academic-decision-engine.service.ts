import { AcademicThinkingService, type AcademicThinkingResult } from '@/services/academic-thinking.service';

export type AcademicDecisionRoute = 'idea-analysis' | 'title-evaluation' | 'weak-title' | 'non-research';

export type AcademicDecisionClassification = 'research-idea' | 'research-title' | 'weak-title' | 'non-research';

export interface AcademicTitleSuggestion {
  title: string;
  rank: number;
  score: number;
  reason: string;
}

export interface AcademicDecisionReport {
  qualityScore: number;
  titleSuitability: {
    suitable: boolean;
    verdict: string;
    reason: string;
  };
  strengths: string[];
  weaknesses: string[];
  needsNarrowing: {
    needs: boolean;
    reason: string;
  };
  suggestedTitles: AcademicTitleSuggestion[];
  recommendedTitle: AcademicTitleSuggestion | null;
  nextStep: string;
  rewrittenTitle: string;
  literatureAvailability: {
    global: string;
    local: string;
    readyForWriting: boolean;
  };
  countrySuitability: string;
  originalityAssessment: string;
  seminarOutline: Array<{ section: string; content: string }>;
}

export interface AcademicDecision {
  route: AcademicDecisionRoute;
  classification: AcademicDecisionClassification;
  confidence: number;
  reason: string;
  nextAction: string;
  summary: string;
  report: AcademicDecisionReport;
}

export interface AcademicDecisionResult {
  decision: AcademicDecision;
  academicThinking: AcademicThinkingResult;
}

export class AcademicDecisionEngine {
  static analyze(input: unknown): AcademicDecisionResult {
    const academicThinking = AcademicThinkingService.analyze(input);
    return {
      decision: this.classify(academicThinking),
      academicThinking,
    };
  }

  private static classify(academicThinking: AcademicThinkingResult): AcademicDecision {
    const report = this.buildReport(academicThinking);

    if (!academicThinking.valid) {
      return {
        route: 'non-research',
        classification: 'non-research',
        confidence: Math.max(0, academicThinking.ideaConfidence),
        reason: academicThinking.reason ?? 'هذا النص لا يمثل فكرة بحثية واضحة.',
        nextAction: 'اطلب من المستخدم إدخال فكرة بحثية أو عنوان بحثي واضح.',
        summary: 'تم التعرف على أن المدخلات لا تمثل فكرة بحثية جاهزة للمرحلة التالية.',
        report,
      };
    }

    if (academicThinking.category === 'Research Problem' || academicThinking.category === 'Research Idea') {
      return {
        route: 'idea-analysis',
        classification: 'research-idea',
        confidence: academicThinking.ideaConfidence,
        reason: 'تم التعرف على فكرة بحثية قابلة للتحليل.',
        nextAction: 'تحليل الفكرة وتوليد عناوين مقترحة ثم انتظار اختيار عنوان الباحث.',
        summary: 'تم بناء تقرير أكاديمي حقيقي يشمل تقييم الفكرة والعناوين المقترحة.',
        report,
      };
    }

    if (academicThinking.category === 'Research Title' && this.isWeakTitle(academicThinking)) {
      return {
        route: 'weak-title',
        classification: 'weak-title',
        confidence: Math.max(20, academicThinking.ideaConfidence - 15),
        reason: 'تم التعرف على عنوان بحثي لكنه ضعيف أو غير كافٍ من حيث الوضوح والاتساق.',
        nextAction: 'شرح سبب الضعف ثم اقتراح عناوين أفضل.',
        summary: 'العنوان موجود، لكنه يحتاج إلى تحسين قبل أن يُعتبر عنواناً بحثياً مناسباً.',
        report,
      };
    }

    if (academicThinking.category === 'Research Title') {
      return {
        route: 'title-evaluation',
        classification: 'research-title',
        confidence: academicThinking.ideaConfidence,
        reason: 'تم التعرف على عنوان بحثي واضح نسبياً.',
        nextAction: 'تقييم العنوان بناءً على معايير الرسائل والوضوح والمتغيرات والجدوى.',
        summary: 'سيتم تقييم العنوان وفق معايير الأكاديمية والملاءمة للدولة والتخصص والدرجة.',
        report,
      };
    }

    return {
      route: 'idea-analysis',
      classification: 'research-idea',
      confidence: academicThinking.ideaConfidence,
      reason: 'تم التعرف على مدخلات بحثية غير مصنفة بدقة، لذلك سيتم التعامل معها كفكرة بحثية أولية.',
      nextAction: 'تحليل المدخلات وتوجيهها إلى مسار الفكرة.',
      summary: 'تمت معالجة الإدخال كفكرة بحثية أولية وسيتم توجيهه إلى مرحلة التحليل.',
      report,
    };
  }

  private static buildReport(academicThinking: AcademicThinkingResult): AcademicDecisionReport {
    const hasVariables = Boolean(
      academicThinking.structure.independentVariable && academicThinking.structure.dependentVariable
    );
    const hasPopulation = Boolean(academicThinking.structure.population);
    const hasLocation = Boolean(academicThinking.structure.location);
    const hasTime = Boolean(academicThinking.structure.time);
    const hasTopic = Boolean(academicThinking.structure.researchTopic);
    const tokens = academicThinking.normalizedInput.split(/\s+/).filter(Boolean);
    const qualityScore = this.scoreIdea(academicThinking, { hasVariables, hasPopulation, hasLocation, hasTime, hasTopic, tokenCount: tokens.length });

    const strengths = [] as string[];
    if (hasVariables) strengths.push('يحتوي المدخل على متغيرات بحثية واضحة.');
    if (hasPopulation) strengths.push('ذكر المدخل مجتمعاً أو عينة بحثية.');
    if (hasLocation) strengths.push('حدد المدخل نطاقاً جغرافياً أو بيئياً.');
    if (hasTime) strengths.push('أشار المدخل إلى إطار زمني.');
    if (hasTopic) strengths.push('المدخل يركز على موضوع بحثي محدد.');

    const weaknesses = [] as string[];
    if (!hasVariables) weaknesses.push('المدخل لا يوضح المتغير المستقل والمتغير التابع بوضوح.');
    if (!hasPopulation) weaknesses.push('لم يذكر المدخل مجتمع الدراسة أو العينة بوضوح.');
    if (!hasLocation) weaknesses.push('لم يحدد المدخل البيئة الجغرافية أو السياق العملي.');
    if (!hasTime) weaknesses.push('لا يوجد إطار زمني واضح يضبط الدراسة.');
    if (tokens.length <= 8) weaknesses.push('الفكرة قصيرة جداً وتحتاج إلى مزيد من التحديد.');

    const needsNarrowing = qualityScore < 75 || (!hasPopulation && !hasLocation) || tokens.length > 20;

    const suggestedTitles = this.generateTitles(academicThinking).sort((a, b) => b.score - a.score);
    const recommendedTitle = suggestedTitles[0] ?? null;
    const rewrittenTitle = this.rewriteTitle(academicThinking, recommendedTitle, suggestedTitles);
    const originalityAssessment = this.assessOriginality(academicThinking, qualityScore);
    const literatureAvailability = this.assessLiteratureAvailability(academicThinking, qualityScore);
    const countrySuitability = this.determineCountrySuitability(academicThinking);
    const seminarOutline = this.buildSeminarOutline(academicThinking, rewrittenTitle);

    const titleSuitability = {
      suitable: qualityScore >= 70 && hasVariables,
      verdict: qualityScore >= 70 && hasVariables
        ? 'الفكرة قابلة للتحول إلى عنوان بحثي قوي بعد تحسين الصياغة والتركيز.'
        : 'العنوان الحالي يحتاج إلى إعادة صياغة لتحسين وضوح المتغيرات والسياق.',
      reason: qualityScore >= 70 && hasVariables
        ? 'المدخل يوفر هيكل بحثي جيد مع متغيرات وسياق، ولكن يحتاج إلى ضبط لغوي ودقة أكاديمية.'
        : 'المدخل يفتقر إلى عناصر مهمة في العنوان الأكاديمي مثل العلاقة الواضحة بين المتغيرات أو السياق المحلي.',
    };

    return {
      qualityScore,
      titleSuitability,
      strengths: strengths.length > 0 ? strengths : ['الفكرة ذات طابع بحثي واضح لكن تحتاج إلى صياغة أكثر دقة.'],
      weaknesses: weaknesses.length > 0 ? weaknesses : ['لا توجد ملاحظات جوهرية، لكن التحديد لا يزال بحاجة إلى تحسين.'],
      needsNarrowing: {
        needs: needsNarrowing,
        reason: needsNarrowing
          ? 'الفكرة تحتاج إلى تضييق عبر تحديد المجتمع، المكان، أو المتغيرات لتصبح عنواناً أكاديمياً قوياً.'
          : 'الفكرة مناسبة من حيث التحديد الحالي ويمكن الانتقال إلى صياغة عنوان أكثر قوة.',
      },
      suggestedTitles,
      recommendedTitle,
      rewrittenTitle,
      literatureAvailability,
      countrySuitability,
      originalityAssessment,
      seminarOutline,
      nextStep: 'استخدم هذا التقرير لتثبيت عنوان قوي، ثم انطلق إلى البحث المرجعي وكتابة مخطط الرسالة.',
    };
  }

  private static scoreIdea(
    academicThinking: AcademicThinkingResult,
    info: { hasVariables: boolean; hasPopulation: boolean; hasLocation: boolean; hasTime: boolean; hasTopic: boolean; tokenCount: number }
  ): number {
    let score = 35;
    if (info.hasVariables) score += 20;
    if (info.hasPopulation) score += 12;
    if (info.hasLocation) score += 10;
    if (info.hasTime) score += 8;
    if (info.hasTopic) score += 10;
    if (academicThinking.structure.studyType !== 'Unspecified') score += 5;
    if (academicThinking.category === 'Research Problem') score += 5;
    if (info.tokenCount > 8) score += 5;
    return Math.min(100, Math.max(0, score));
  }

  private static generateTitles(academicThinking: AcademicThinkingResult): AcademicTitleSuggestion[] {
    const independent = academicThinking.structure.independentVariable || 'المتغير المستقل';
    const dependent = academicThinking.structure.dependentVariable || 'المتغير التابع';
    const population = academicThinking.structure.population || 'المجتمع المستهدف';
    const location = academicThinking.structure.location || 'السياق المحلي';
    const time = academicThinking.structure.time || 'في السياق الحالي';

    const templates = [
      {
        title: `أثر ${independent} على ${dependent} لدى ${population} في ${location}`,
        reason: 'يحدد العلاقة السببية بين المتغيرات ويضيف المجتمع والسياق.',
      },
      {
        title: `العلاقة بين ${independent} و${dependent} لدى ${population} في ${location}`,
        reason: 'يبرز العلاقة الارتباطية بشكل واضح ومناسب للبحوث الوصفية والارتباطية.',
      },
      {
        title: `دور ${independent} في تحسين ${dependent} لدى ${population} في ${location}`,
        reason: 'يمنح العنوان طابعاً تطبيقياً وملائماً لبحوث الجودة أو الأداء.',
      },
      {
        title: `تأثير ${independent} على ${dependent} ${time} في ${location}`,
        reason: 'يدعم العنوان بعداً زمنياً ويعطيه دقة أكبر في السياق العملي.',
      },
    ];

    return templates.map((template, index) => {
      let score = 70;
      if (academicThinking.structure.independentVariable) score += 8;
      if (academicThinking.structure.dependentVariable) score += 8;
      if (academicThinking.structure.population) score += 6;
      if (academicThinking.structure.location) score += 6;
      if (academicThinking.structure.time) score += 4;
      if (index === 0) score += 4;

      return {
        title: template.title,
        rank: index + 1,
        score: Math.min(100, score),
        reason: template.reason,
      };
    });
  }

  private static rewriteTitle(
    academicThinking: AcademicThinkingResult,
    recommendedTitle: AcademicTitleSuggestion | null,
    suggestedTitles: AcademicTitleSuggestion[]
  ): string {
    const independent = academicThinking.structure.independentVariable || 'المتغير المستقل';
    const dependent = academicThinking.structure.dependentVariable || 'المتغير التابع';
    const population = academicThinking.structure.population || 'المجتمع المستهدف';
    const location = academicThinking.structure.location || 'السياق المحلي';

    if (academicThinking.category === 'Research Title') {
      if (academicThinking.structure.independentVariable && academicThinking.structure.dependentVariable) {
        return `أثر ${independent} على ${dependent} لدى ${population} في ${location}`;
      }
      return recommendedTitle?.title ?? suggestedTitles[0]?.title ?? academicThinking.normalizedInput;
    }

    if (academicThinking.category === 'Research Problem') {
      return recommendedTitle?.title ?? suggestedTitles[0]?.title ?? `دراسة حول ${academicThinking.structure.researchTopic ?? 'الموضوع البحثي'}`;
    }

    return recommendedTitle?.title ?? suggestedTitles[0]?.title ?? academicThinking.normalizedInput;
  }

  private static assessOriginality(
    academicThinking: AcademicThinkingResult,
    qualityScore: number
  ): string {
    const hasLocalContext = Boolean(academicThinking.structure.location);
    const specificTopic = Boolean(academicThinking.structure.researchTopic);
    if (qualityScore >= 85 && hasLocalContext && specificTopic) {
      return 'عالي - الموضوع محدد وواضح مع تركيز محلي أو تطبيقي يمكن أن ينتج بحثاً جديداً.';
    }
    if (qualityScore >= 70) {
      return 'متوسط - الفكرة لها أساس جيد، لكن تحتاج إلى تحديد أكثر دقة للسياق والمنهجية لتصبح مبتكرة.';
    }
    return 'منخفض - الفكرة عامة أو عنوانها يحتاج إعادة صياغة لتحسين أصالته البحثية.';
  }

  private static assessLiteratureAvailability(
    academicThinking: AcademicThinkingResult,
    qualityScore: number
  ): AcademicDecisionReport['literatureAvailability'] {
    const hasLocation = Boolean(academicThinking.structure.location);
    const hasTopic = Boolean(academicThinking.structure.researchTopic);
    const global = qualityScore >= 70
      ? 'الأدبيات العالمية تدعم الفكرة بشكل جيد، مع محتوى بحثي متاح في مجالات مشابهة.'
      : 'الأدبيات العالمية متاحة جزئياً؛ يتطلب الأمر بحثاً أعمق في مراجع متخصصة.';
    const local = hasLocation
      ? `هناك إمكانية جيدة للبحث المحلي في ${academicThinking.structure.location}، خاصة عند ضبط المتغيرات والسياق.`
      : 'القابلية المحلية تحتاج إلى تحديد بلد أو سياق عملي لتصبح أكثر قابلية للتطبيق.';
    const readyForWriting = qualityScore >= 70 && Boolean(academicThinking.structure.independentVariable && academicThinking.structure.dependentVariable);
    return { global, local, readyForWriting };
  }

  private static determineCountrySuitability(academicThinking: AcademicThinkingResult): string {
    if (!academicThinking.structure.location) {
      return 'الموضوع عام، ويمكن تطبيقه في أي دولة، لكن يفضل إضافة سياق محلي ليصبح أكثر قوة.';
    }
    const location = academicThinking.structure.location;
    if (location.includes('السعوديه') || location.includes('saudi')) {
      return 'المرشح مناسب للسياق السعودي، خاصة إذا كان مرتبطاً بالتعليم أو الأداء المؤسسي.';
    }
    if (location.includes('فلسطين') || location.includes('palestine')) {
      return 'المرشح مناسب للسياق الفلسطيني مع احتمالية تركيز على التحديات المحلية والموارد المتاحة.';
    }
    return `يمكن تطبيق البحث في ${location}، ويحتاج إلى ضبط بسيط للسياق المحلي والبيانات الميدانية.`;
  }

  private static buildSeminarOutline(
    academicThinking: AcademicThinkingResult,
    rewrittenTitle: string
  ): Array<{ section: string; content: string }> {
    const independent = academicThinking.structure.independentVariable || 'المتغير المستقل';
    const dependent = academicThinking.structure.dependentVariable || 'المتغير التابع';
    const population = academicThinking.structure.population || 'المجتمع المستهدف';
    const location = academicThinking.structure.location || 'السياق المحلي';
    const topic = academicThinking.structure.researchTopic ?? 'الموضوع البحثي';

    return [
      {
        section: 'عنوان البحث المقترح',
        content: rewrittenTitle,
      },
      {
        section: 'مقدمة مختصرة',
        content: `تركز هذه الدراسة على ${topic}، وتستعرض كيفية تأثير ${independent} على ${dependent} لدى ${population} في ${location}.`,
      },
      {
        section: 'مشكلة البحث',
        content: `تتمثل المشكلة في ضعف الوضوح أو الكفاءة في ${independent} وتأثيرها على ${dependent} ضمن ${location}، مما يفتح مجالاً لدراسة العلاقة والتحسين.`,      },
      {
        section: 'هدف البحث',
        content: `تحديد أثر ${independent} على ${dependent} في ${location} وتحليل قابلية تطبيق التدخلات لتحسين النتائج لدى ${population}.`,      },
      {
        section: 'منهجية مقترحة',
        content: `استخدام منهجية مختلطة تجمع بين التحليل الوصفي والميداني وقياس العلاقة بين المتغيرين باستخدام استبيانات أو بيانات أداء.`,      },
      {
        section: 'المراجع المتوقعة',
        content: `الاستناد إلى أدبيات الذكاء الاصطناعي أو التحصيل الأكاديمي أو حوكمة الأداء بحسب طبيعة الموضوع، مع التركيز على الأعمال الحديثة ذات الصلة بالسياق المحلي.`,      },
    ];
  }

  private static isWeakTitle(academicThinking: AcademicThinkingResult): boolean {
    const normalized = academicThinking.normalizedInput;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const hasVariables = Boolean(
      academicThinking.structure.independentVariable && academicThinking.structure.dependentVariable
    );
    const hasContext = Boolean(
      academicThinking.structure.population || academicThinking.structure.location || academicThinking.structure.time
    );
    const genericMarker = /\b(study|research|analysis|investigation|problem|effect|impact|role|relationship)\b/.test(normalized);

    const tooShort = tokens.length <= 5;
    const weakStructure = !hasVariables && genericMarker;
    const limitedContext = !hasContext && tokens.length <= 8;

    return tooShort || weakStructure || limitedContext;
  }
}
