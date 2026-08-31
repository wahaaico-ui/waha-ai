import { assessAcademicText, assessProblemDraft, firstAcademicTextIssue } from '@/lib/academic-content-quality';

export const WORKFLOW_STAGES = ['verify', 'title', 'problem', 'objectives', 'questions', 'hypotheses', 'methodology', 'design', 'literature', 'analysis'] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export type WorkflowOutput = Record<string, unknown>;
export type GateStatus = 'open' | 'needs_improvement' | 'locked';

export type QualityGate = {
  status: GateStatus;
  stage: WorkflowStage;
  reason: string;
  nextStage: WorkflowStage | null;
};

const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const asList = (value: unknown, minimumLength = 5) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length >= minimumLength) : [];

export function isStage(value: unknown): value is WorkflowStage {
  return typeof value === 'string' && (WORKFLOW_STAGES as readonly string[]).includes(value);
}

export function stageComplete(stage: WorkflowStage, output: WorkflowOutput | undefined) {
  if (!output) return false;
  switch (stage) {
    case 'verify': {
      const coverage = output.searchCoverage;
      const uniqueStudies = coverage && typeof coverage === 'object'
        ? Number((coverage as Record<string, unknown>).uniqueStudies || 0)
        : 0;
      const paths = Array.isArray(output.researchPaths) ? output.researchPaths : [];
      const selectedPath = output.selectedResearchPath;
      const selectedPathId = selectedPath && typeof selectedPath === 'object'
        ? asText((selectedPath as Record<string, unknown>).id)
        : '';
      const selectedPathExists = paths.some((path) => path && typeof path === 'object' && asText((path as Record<string, unknown>).id) === selectedPathId);
      return output.decision === 'proceed' && uniqueStudies >= 3 && paths.length >= 3 && selectedPathExists;
    }
    case 'title': return assessAcademicText(output.title, { minChars: 15, minWords: 4, label: 'العنوان' }).valid;
    case 'problem': return assessProblemDraft({
      title: '',
      problemStatement: output.problemStatement,
      researchGap: output.researchGap,
      researcherNote: output.researcherNote,
    }).valid;
    case 'objectives': return !firstAcademicTextIssue(output.objectives, { minChars: 25, minWords: 5, label: 'الهدف' }, 2);
    case 'questions': return !firstAcademicTextIssue(output.questions, { minChars: 20, minWords: 5, label: 'السؤال', requireQuestion: true }, 2);
    case 'hypotheses': {
      if (output.mode === 'not_applicable') return assessAcademicText(output.rationale, { minChars: 30, minWords: 5, label: 'مبرر عدم استخدام الفرضيات' }).valid;
      return output.mode === 'required' && !firstAcademicTextIssue(output.hypotheses, { minChars: 20, minWords: 5, label: 'الفرضية' }, 1);
    }
    case 'methodology': {
      const fields = { population: 'مجتمع الدراسة', sample: 'العينة', instrument: 'أداة جمع البيانات' } as const;
      return Boolean(asText(output.approach)) && Object.entries(fields).every(([key, label]) => assessAcademicText(output[key], { minChars: 20, minWords: 4, label }).valid);
    }
    case 'design': {
      const variables = Array.isArray(output.variables) ? output.variables : [];
      const population = output.population && typeof output.population === 'object' ? output.population as Record<string, unknown> : {};
      const sample = output.sample && typeof output.sample === 'object' ? output.sample as Record<string, unknown> : {};
      return variables.length >= 1
        && variables.every((item) => item && typeof item === 'object'
          && assessAcademicText((item as Record<string, unknown>).name, { minChars: 3, minWords: 1, label: 'المتغير أو المفهوم' }).valid
          && assessAcademicText((item as Record<string, unknown>).operationalDefinition, { minChars: 20, minWords: 4, label: 'التعريف الإجرائي' }).valid)
        && assessAcademicText(population.description, { minChars: 20, minWords: 4, label: 'مجتمع الدراسة' }).valid
        && assessAcademicText(sample.strategy, { minChars: 15, minWords: 3, label: 'استراتيجية العينة' }).valid
        && assessAcademicText(sample.inclusionCriteria, { minChars: 20, minWords: 4, label: 'معايير الاشتمال' }).valid
        && assessAcademicText(sample.sizeRationale, { minChars: 20, minWords: 4, label: 'مبرر حجم العينة' }).valid;
    }
    case 'literature': return Array.isArray(output.papers) && output.papers.length >= 3;
    case 'analysis': return asText(output.introduction).length >= 20 && asText(output.conclusion).length >= 20;
  }
}

export function evaluateGate(stage: WorkflowStage, outputs: Partial<Record<WorkflowStage, WorkflowOutput>>): QualityGate {
  const currentIndex = WORKFLOW_STAGES.indexOf(stage);
  const previous = WORKFLOW_STAGES.slice(0, currentIndex).find((previousStage) => !stageComplete(previousStage, outputs[previousStage]));
  if (previous) {
    return { status: 'locked', stage, reason: `أكمل مرحلة «${stageLabel(previous)}» واحفظها أولاً.`, nextStage: previous };
  }

  if (!stageComplete(stage, outputs[stage])) {
    return { status: 'needs_improvement', stage, reason: requirementFor(stage), nextStage: stage };
  }

  const consistencyIssue = consistencyIssueFor(stage, outputs);
  if (consistencyIssue) return { status: 'needs_improvement', stage, reason: consistencyIssue, nextStage: stage };

  const nextStage = WORKFLOW_STAGES[currentIndex + 1] ?? null;
  return { status: 'open', stage, reason: nextStage ? `تمت مراجعة المتطلبات الأساسية. يمكنك الانتقال إلى «${stageLabel(nextStage)}».` : 'اكتملت مخرجات هذه الرحلة الأساسية.', nextStage };
}

function consistencyIssueFor(stage: WorkflowStage, outputs: Partial<Record<WorkflowStage, WorkflowOutput>>) {
  if (stage === 'title') {
    return assessAcademicText(outputs.title?.title, { minChars: 15, minWords: 4, label: 'العنوان' }).reason;
  }
  if (stage === 'problem') {
    return assessProblemDraft({
      title: outputs.title?.title,
      problemStatement: outputs.problem?.problemStatement,
      researchGap: outputs.problem?.researchGap,
      researcherNote: outputs.problem?.researcherNote,
    }).reason;
  }
  if (stage === 'objectives') return firstAcademicTextIssue(outputs.objectives?.objectives, { minChars: 25, minWords: 5, label: 'الهدف' }, 2);
  if (stage === 'questions') {
    const qualityIssue = firstAcademicTextIssue(outputs.questions?.questions, { minChars: 20, minWords: 5, label: 'السؤال', requireQuestion: true }, 2);
    if (qualityIssue) return qualityIssue;
    const objectives = asList(outputs.objectives?.objectives, 20);
    const questions = asList(outputs.questions?.questions, 15);
    if (objectives.length !== questions.length) return 'يجب أن يقابل كل هدف سؤال بحث واحد واضح على الأقل.';
  }
  if (stage === 'hypotheses') {
    const questions = asList(outputs.questions?.questions, 15);
    if (outputs.hypotheses?.mode === 'required') {
      const hypotheses = asList(outputs.hypotheses?.hypotheses, 15);
      if (hypotheses.length !== questions.length) return 'يجب أن تقابل كل سؤال فرضية واحدة، أو توثّق لماذا لا تتطلب طبيعة الدراسة فرضيات.';
      if (hypotheses.some((item) => /[؟?]\s*$/u.test(item))) return 'الفرضية عبارة تقريرية قابلة للاختبار وليست سؤالاً.';
    }
  }
  if (stage === 'methodology') {
    const approach = asText(outputs.methodology?.approach).toLowerCase();
    const instrument = asText(outputs.methodology?.instrument);
    if (approach === 'qualitative' && /استبان|questionnaire|survey/i.test(instrument)) return 'هناك تعارض: اخترت منهجاً نوعياً لكن الأداة استبانة كمية. عدّل المنهج أو الأداة قبل المتابعة.';
    if (approach === 'quantitative' && /مقابل|interview/i.test(instrument)) return 'هناك تعارض محتمل: المقابلات تتطلب منهجاً نوعياً أو مختلطاً، أو أداة كمية مناسبة.';
  }
  if (stage === 'design') {
    const approach = asText(outputs.methodology?.approach).toLowerCase();
    const variables = Array.isArray(outputs.design?.variables)
      ? outputs.design.variables.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : [];
    const roles = variables.map((item) => asText(item.role));
    if ((approach === 'quantitative' || approach === 'mixed') && variables.length < 2) return 'التصميم الكمي أو المختلط يحتاج متغيرين منظمين على الأقل.';
    if ((approach === 'quantitative' || approach === 'mixed') && !roles.some((role) => role === 'independent' || role === 'predictor')) return 'حدّد متغيراً مستقلاً أو متنبئاً واحداً على الأقل.';
    if ((approach === 'quantitative' || approach === 'mixed') && !roles.some((role) => role === 'dependent' || role === 'outcome')) return 'حدّد متغيراً تابعاً أو ناتجاً واحداً على الأقل.';
  }
  if (stage === 'literature') {
    const papers = outputs.literature?.papers;
    if (!Array.isArray(papers) || papers.some((paper) => !paper || typeof paper !== 'object' || !asText((paper as Record<string, unknown>).title))) return 'لا يمكن اعتماد الأدلة من دون عنوان واضح لكل دراسة مختارة.';
  }
  return null;
}

export function nextAllowedStage(outputs: Partial<Record<WorkflowStage, WorkflowOutput>>) {
  return WORKFLOW_STAGES.find((stage) => !stageComplete(stage, outputs[stage])) ?? null;
}

export function stageLabel(stage: WorkflowStage) {
  return ({ verify: 'استكشاف المسار', title: 'العنوان', problem: 'مشكلة البحث والفجوة', objectives: 'الأهداف', questions: 'الأسئلة', hypotheses: 'الفرضيات', methodology: 'المنهجية', design: 'تصميم الدراسة', literature: 'الأدلة والأدبيات', analysis: 'التحليل' })[stage];
}

function requirementFor(stage: WorkflowStage) {
  return ({
    verify: 'لا تُفتح الرحلة إلا بعد قرار قابل للمتابعة، وثلاث دراسات فريدة على الأقل، وثلاثة مسارات مرتبطة بالأدلة، ثم اختيار الباحث لمسار واحد واعتماده؛ الدرجة وحدها لا تكفي.',
    title: 'اعتمد عنواناً أكاديمياً واضحاً يحدد الموضوع والسياق، ولا يكتفي بكلمات عامة.',
    problem: 'راجع مسودة المشكلة والفجوة وسبب اهتمامك. لا تُقبل الأحرف المتكررة أو الجمل غير المفهومة.',
    objectives: 'اعتمد هدفين محددين ومفهومين على الأقل، يوضح كل منهما ما الذي سيفحصه البحث.',
    questions: 'اعتمد سؤالاً بحثياً واضحاً ومفهوماً مقابل كل هدف.',
    hypotheses: 'حدّد إن كانت الدراسة تحتاج فرضيات. إن كانت مطلوبة، اعتمد فرضية قابلة للاختبار مقابل كل سؤال؛ وإن لم تكن، وثّق السبب المنهجي.',
    methodology: 'حدد المنهج ومجتمع الدراسة والعينة والأداة.',
    design: 'نظّم المتغيرات أو المفاهيم، وحدد مجتمع الدراسة واستراتيجية العينة ومعاييرها ومبرر حجمها.',
    literature: 'اختر ثلاث دراسات موثقة على الأقل.',
    analysis: 'أضف تأطيراً وخلاصة مبنيين على الدراسات المختارة.',
  })[stage];
}
