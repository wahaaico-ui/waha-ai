import type {
  ObjectiveObject,
  ProblemObjectiveValidationResult,
  ProblemObjectivesConsistencyReport,
  ProblemObject,
  ResearchObjectRelationship,
  ResearchObjectView,
} from './types';

export const PROBLEM_OBJECTIVE_FORMULA_VERSION = 'problem-objective-consistency/v1';

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

const STOP_WORDS = new Set([
  'في', 'من', 'الى', 'على', 'عن', 'مع', 'بين', 'لدى', 'ضمن', 'خلال', 'حول', 'نحو',
  'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'وهو', 'وهي', 'كما', 'قد', 'لم', 'لن',
  'ان', 'او', 'ثم', 'كل', 'اكثر', 'اقل', 'وجود', 'عدم', 'مدى', 'بشكل', 'بصوره',
  'مشكله', 'دراسه', 'بحث', 'باحث', 'هدف', 'اهداف', 'تتمثل', 'تتحدد', 'تسعى', 'يهدف',
  'research', 'study', 'problem', 'objective', 'aim', 'aims', 'the', 'and', 'for', 'with',
  'from', 'into', 'within', 'among', 'this', 'that', 'are', 'was', 'were', 'not',
]);

const MEASURABLE_VERBS = [
  'قياس', 'تحديد', 'تحليل', 'اختبار', 'تقييم', 'مقارنه', 'استكشاف', 'رصد', 'تفسير',
  'فحص', 'كشف', 'تقدير', 'تقويم', 'وصف', 'تعرف', 'measure', 'identify', 'analyze',
  'analyse', 'test', 'evaluate', 'compare', 'explore', 'estimate', 'assess', 'determine',
];

type ConceptSet = {
  stems: Set<string>;
  surfaceByStem: Map<string, string>;
};

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number) {
  return Math.round(clamp(value));
}

function normalizeToken(value: string) {
  let token = value
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/ـ/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .toLocaleLowerCase('ar');

  if (/^[\u0600-\u06FF]+$/u.test(token)) {
    if (token.length > 5) token = token.replace(/^(وال|بال|كال|فال|لل|ال)/u, '');
    if (token.length > 5) token = token.replace(/(يات|ات|ون|ين)$/u, '');
  }
  return token;
}

function concepts(value: string): ConceptSet {
  const stems = new Set<string>();
  const surfaceByStem = new Map<string, string>();
  const tokens = value.match(TOKEN_PATTERN) || [];

  for (const surface of tokens) {
    const stem = normalizeToken(surface);
    if (stem.length < 3 || STOP_WORDS.has(stem)) continue;
    stems.add(stem);
    if (!surfaceByStem.has(stem)) surfaceByStem.set(stem, surface);
  }

  return { stems, surfaceByStem };
}

function intersection(first: Set<string>, second: Set<string>) {
  return new Set([...first].filter((value) => second.has(value)));
}

function jaccard(first: Set<string>, second: Set<string>) {
  const union = new Set([...first, ...second]);
  return union.size ? intersection(first, second).size / union.size : 0;
}

function includesMeasurableVerb(value: string) {
  const normalized = [...concepts(value).stems];
  return MEASURABLE_VERBS.some((verb) => normalized.some((token) => token === verb || token.startsWith(verb)));
}

function statusForScore(score: number): 'passed' | 'warning' | 'failed' {
  if (score >= 70) return 'passed';
  if (score >= 45) return 'warning';
  return 'failed';
}

function objectiveRelationship(
  objective: ObjectiveObject,
  problem: ProblemObject,
  relationships: ResearchObjectRelationship[],
) {
  return relationships.find((relationship) => (
    relationship.fromId === objective.id
    && relationship.toId === problem.id
    && relationship.relationType === 'addresses'
  ));
}

function emptyReport(
  view: ResearchObjectView,
  checkedAt: string,
  problem: ProblemObject | null,
  objectives: ObjectiveObject[],
  issues: string[],
): ProblemObjectivesConsistencyReport {
  return {
    checkType: 'problem_objective_consistency',
    formulaVersion: PROBLEM_OBJECTIVE_FORMULA_VERSION,
    knowledgeType: 'inference',
    projectId: view.projectId,
    problemId: problem?.id ?? null,
    objectiveIds: objectives.map((objective) => objective.id),
    overallScore: 0,
    coverageScore: 0,
    status: 'failed',
    summary: 'تعذر إجراء فحص الاتساق لعدم اكتمال المشكلة أو الأهداف.',
    uncoveredProblemConcepts: [],
    duplicateObjectivePairs: [],
    results: [],
    issues,
    checkedAt,
  };
}

export function evaluateProblemObjectivesConsistency(
  view: ResearchObjectView,
  options: { checkedAt?: string } = {},
): ProblemObjectivesConsistencyReport {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const problem = view.objects.find((item): item is ProblemObject => item.type === 'problem') ?? null;
  const objectives = view.objects.filter((item): item is ObjectiveObject => item.type === 'objective');
  const inputIssues: string[] = [];

  if (!problem) inputIssues.push('لا توجد مشكلة بحث صالحة لإجراء الفحص.');
  if (!objectives.length) inputIssues.push('لا توجد أهداف بحث صالحة لإجراء الفحص.');
  if (inputIssues.length || !problem) return emptyReport(view, checkedAt, problem, objectives, inputIssues);

  const problemConcepts = concepts(problem.content.statement);
  if (!problemConcepts.stems.size) {
    return emptyReport(
      view,
      checkedAt,
      problem,
      objectives,
      ['لم نستطع استخراج مفاهيم بحثية واضحة من صياغة المشكلة.'],
    );
  }

  const objectiveConcepts = objectives.map((objective) => concepts(objective.content.statement));
  const duplicateObjectivePairs: Array<[string, string]> = [];
  const duplicateIds = new Set<string>();

  for (let firstIndex = 0; firstIndex < objectives.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < objectives.length; secondIndex += 1) {
      if (jaccard(objectiveConcepts[firstIndex].stems, objectiveConcepts[secondIndex].stems) >= 0.72) {
        duplicateObjectivePairs.push([objectives[firstIndex].id, objectives[secondIndex].id]);
        duplicateIds.add(objectives[firstIndex].id);
        duplicateIds.add(objectives[secondIndex].id);
      }
    }
  }

  const coveredProblemConcepts = new Set<string>();
  const results: ProblemObjectiveValidationResult[] = objectives.map((objective, index) => {
    const objectiveValues = objectiveConcepts[index];
    const matched = intersection(objectiveValues.stems, problemConcepts.stems);
    matched.forEach((concept) => coveredProblemConcepts.add(concept));

    const precision = matched.size / Math.max(1, objectiveValues.stems.size);
    const focusedRecall = matched.size / Math.max(1, Math.min(4, problemConcepts.stems.size));
    const relevance = rounded((precision * 0.65 + Math.min(1, focusedRecall) * 0.35) * 100);
    const measurable = includesMeasurableVerb(objective.content.statement);
    const measurability = measurable ? 100 : 20;
    const specificity = objectiveValues.stems.size >= 5
      ? 100
      : objectiveValues.stems.size >= 3 ? 65 : 25;
    let score = rounded(relevance * 0.6 + measurability * 0.25 + specificity * 0.15);

    if (!matched.size) score = Math.min(score, 30);
    if (duplicateIds.has(objective.id)) score = Math.min(score, 49);

    const gapsFound: string[] = [];
    if (!matched.size) gapsFound.push('لا يظهر ارتباط مفاهيمي مباشر بين الهدف ومشكلة البحث.');
    else if (relevance < 55) gapsFound.push('صلة الهدف بالمشكلة موجودة لكنها ضعيفة أو غير محددة بما يكفي.');
    if (!measurable) gapsFound.push('الهدف لا يبدأ بفعل بحثي قابل للفحص أو القياس.');
    if (specificity < 65) gapsFound.push('الهدف عام جدًا ولا يحدد ما الذي سيفحصه البحث.');
    if (duplicateIds.has(objective.id)) gapsFound.push('الهدف متشابه بدرجة مرتفعة مع هدف آخر ولا يضيف تغطية مستقلة.');

    const uncovered = [...problemConcepts.stems]
      .filter((concept) => !matched.has(concept))
      .map((concept) => problemConcepts.surfaceByStem.get(concept) || concept);

    let suggestedAction = 'لا يلزم تعديل جوهري؛ راجع الصياغة النهائية بصوت الباحث.';
    if (!matched.size) {
      const anchors = [...problemConcepts.stems]
        .slice(0, 3)
        .map((concept) => problemConcepts.surfaceByStem.get(concept) || concept);
      suggestedAction = `حدّد أي جزء من المشكلة يعالجه هذا الهدف واربطه صراحةً بأحد مفاهيمها: ${anchors.join('، ')}.`;
    } else if (duplicateIds.has(objective.id)) {
      suggestedAction = 'ادمج الهدفين المتشابهين أو اجعل لكل واحد منهما بُعدًا مستقلًا يمكن فحصه.';
    } else if (!measurable) {
      suggestedAction = 'حدّد الفعل البحثي الذي ستنفذه، مثل القياس أو التحليل أو المقارنة، دون تغيير مضمون الهدف.';
    } else if (relevance < 55) {
      suggestedAction = 'وضّح المتغير أو الفئة أو السياق المشترك بين هذا الهدف ومشكلة البحث.';
    }

    const relationship = objectiveRelationship(objective, problem, view.relationships);
    return {
      id: `validation:${objective.id}:problem-objective:${PROBLEM_OBJECTIVE_FORMULA_VERSION}`,
      relationshipId: relationship?.id || `${objective.id}:addresses:${problem.id}`,
      checkType: 'problem_objective_consistency',
      score,
      formulaVersion: PROBLEM_OBJECTIVE_FORMULA_VERSION,
      knowledgeType: 'inference',
      rationale: `الصلة ${relevance}/100، القابلية للفحص ${measurability}/100، والتحديد ${specificity}/100.`,
      gapsFound,
      suggestedAction,
      evidenceUsed: [problem.id, objective.id],
      status: statusForScore(score),
      checkedAt,
      objectiveId: objective.id,
      problemId: problem.id,
      dimensions: { relevance, measurability, specificity },
      matchedConcepts: [...matched].map((concept) => problemConcepts.surfaceByStem.get(concept) || concept),
      uncoveredConcepts: uncovered,
    };
  });

  const uncoveredProblemConcepts = [...problemConcepts.stems]
    .filter((concept) => !coveredProblemConcepts.has(concept))
    .map((concept) => problemConcepts.surfaceByStem.get(concept) || concept);
  const coverageScore = rounded(
    coveredProblemConcepts.size / Math.max(1, problemConcepts.stems.size) * 100,
  );
  const averageRelationshipScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  const duplicatePenalty = Math.min(20, duplicateObjectivePairs.length * 10);
  const overallScore = rounded(averageRelationshipScore * 0.7 + coverageScore * 0.3 - duplicatePenalty);

  let status: ProblemObjectivesConsistencyReport['status'] = 'passed';
  if (results.some((result) => result.status === 'failed') || coverageScore < 30) status = 'failed';
  else if (
    results.some((result) => result.status === 'warning')
    || coverageScore < 60
    || duplicateObjectivePairs.length
  ) status = 'warning';

  const issues: string[] = [];
  if (uncoveredProblemConcepts.length) {
    issues.push(`مفاهيم في المشكلة لا تغطيها الأهداف بوضوح: ${uncoveredProblemConcepts.join('، ')}.`);
  }
  if (duplicateObjectivePairs.length) {
    issues.push('توجد أهداف متشابهة بدرجة مرتفعة وتحتاج دمجًا أو تفريقًا منهجيًا.');
  }

  const summary = status === 'passed'
    ? 'الأهداف مرتبطة بالمشكلة وتغطي مفاهيمها الأساسية دون تكرار مرتفع.'
    : status === 'warning'
      ? 'العلاقة بين المشكلة والأهداف قابلة للمتابعة، لكنها تحتاج تحسينًا قبل الاعتماد النهائي.'
      : 'يوجد خلل جوهري في صلة هدف واحد على الأقل بالمشكلة أو في تغطية المشكلة.';

  return {
    checkType: 'problem_objective_consistency',
    formulaVersion: PROBLEM_OBJECTIVE_FORMULA_VERSION,
    knowledgeType: 'inference',
    projectId: view.projectId,
    problemId: problem.id,
    objectiveIds: objectives.map((objective) => objective.id),
    overallScore,
    coverageScore,
    status,
    summary,
    uncoveredProblemConcepts,
    duplicateObjectivePairs,
    results,
    issues,
    checkedAt,
  };
}
