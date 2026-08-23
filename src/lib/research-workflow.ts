export const WORKFLOW_STAGES = ['verify', 'title', 'problem', 'objectives', 'questions', 'methodology', 'literature', 'analysis'] as const;

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
const asList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length >= 5) : [];

export function isStage(value: unknown): value is WorkflowStage {
  return typeof value === 'string' && (WORKFLOW_STAGES as readonly string[]).includes(value);
}

export function stageComplete(stage: WorkflowStage, output: WorkflowOutput | undefined) {
  if (!output) return false;
  switch (stage) {
    case 'verify': return output.decision === 'proceed';
    case 'title': return asText(output.title).length >= 10;
    case 'problem': return asText(output.problemStatement).length >= 20 && asText(output.researchGap).length >= 20;
    case 'objectives': return asList(output.objectives).length >= 2;
    case 'questions': return asList(output.questions).length >= 2;
    case 'methodology': return ['approach', 'population', 'sample', 'instrument'].every((key) => asText(output[key]).length >= 3);
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
  if (stage === 'questions') {
    const objectives = asList(outputs.objectives?.objectives);
    const questions = asList(outputs.questions?.questions);
    if (objectives.length !== questions.length) return 'يجب أن يقابل كل هدف سؤال بحث واحد واضح على الأقل.';
  }
  if (stage === 'methodology') {
    const approach = asText(outputs.methodology?.approach).toLowerCase();
    const instrument = asText(outputs.methodology?.instrument);
    if (approach === 'qualitative' && /استبان|questionnaire|survey/i.test(instrument)) return 'هناك تعارض: اخترت منهجاً نوعياً لكن الأداة استبانة كمية. عدّل المنهج أو الأداة قبل المتابعة.';
    if (approach === 'quantitative' && /مقابل|interview/i.test(instrument)) return 'هناك تعارض محتمل: المقابلات تتطلب منهجاً نوعياً أو مختلطاً، أو أداة كمية مناسبة.';
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
  return ({ verify: 'استكشاف المسار', title: 'العنوان', problem: 'مشكلة البحث والفجوة', objectives: 'الأهداف', questions: 'الأسئلة', methodology: 'المنهجية', literature: 'الأدلة والأدبيات', analysis: 'التحليل' })[stage];
}

function requirementFor(stage: WorkflowStage) {
  return ({
    verify: 'لا تُفتح الرحلة إلا بعد قرار مدعوم بالأدلة حول المسار البحثي، لا بعد درجة رقمية وحدها.',
    title: 'اعتمد عنواناً واضحاً لا يقل عن 10 أحرف قبل الانتقال.',
    problem: 'اكتب مشكلة بحث وفجوة محتملة، لا تقل كل منهما عن 20 حرفاً.',
    objectives: 'أضف هدفين محددين على الأقل.',
    questions: 'أضف سؤالين بحثيين واضحين على الأقل.',
    methodology: 'حدد المنهج ومجتمع الدراسة والعينة والأداة.',
    literature: 'اختر ثلاث دراسات موثقة على الأقل.',
    analysis: 'أضف تأطيراً وخلاصة مبنيين على الدراسات المختارة.',
  })[stage];
}
