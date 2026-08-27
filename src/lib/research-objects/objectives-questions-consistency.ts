import type {
  ObjectiveObject,
  ObjectiveQuestionValidationResult,
  ObjectivesQuestionsConsistencyReport,
  QuestionObject,
  ResearchObjectRelationship,
  ResearchObjectView,
} from './types';

export const OBJECTIVE_QUESTION_FORMULA_VERSION = 'objective-question-consistency/v1';

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const STOP_WORDS = new Set([
  'في', 'من', 'الى', 'على', 'عن', 'مع', 'بين', 'لدى', 'ضمن', 'خلال', 'حول', 'نحو',
  'هذا', 'هذه', 'ذلك', 'تلك', 'التي', 'الذي', 'وهو', 'وهي', 'كما', 'قد', 'لم', 'لن',
  'ان', 'او', 'ثم', 'كل', 'اكثر', 'اقل', 'وجود', 'عدم', 'مدى', 'بشكل', 'بصوره',
  'هدف', 'اهداف', 'سوال', 'اسئله', 'اثر', 'علاقه', 'قياس', 'تحديد', 'تحليل', 'اختبار', 'تقييم', 'مقارنه',
  'استكشاف', 'رصد', 'تفسير', 'فحص', 'كشف', 'تقدير', 'تقويم', 'وصف', 'تعرف',
  'ما', 'ماذا', 'كيف', 'هل', 'اي', 'research', 'study', 'objective', 'question', 'aim',
  'measure', 'identify', 'analyze', 'analyse', 'test', 'evaluate', 'compare', 'explore',
  'the', 'and', 'for', 'with', 'from', 'into', 'within', 'among', 'this', 'that',
]);
const QUESTION_MARKERS = [
  'ما ', 'ماذا ', 'كيف ', 'هل ', 'لماذا ', 'إلى أي مدى', 'الى اي مدى', 'ما مدى',
  'ما أثر', 'ما اثر', 'ما العلاقة', 'ما الفرق', 'أيّ ', 'اي ', 'what ', 'how ', 'why ',
  'does ', 'do ', 'is ', 'are ', 'to what extent', 'which ',
];

type ConceptSet = {
  stems: Set<string>;
  surfaceByStem: Map<string, string>;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
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
  for (const surface of value.match(TOKEN_PATTERN) || []) {
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

function isQuestionForm(value: string) {
  const normalized = value.trim().toLocaleLowerCase('ar');
  return /[؟?]\s*$/u.test(normalized)
    || QUESTION_MARKERS.some((marker) => normalized.startsWith(marker));
}

function statusForScore(score: number): 'passed' | 'warning' | 'failed' {
  if (score >= 70) return 'passed';
  if (score >= 45) return 'warning';
  return 'failed';
}

function pairedRelationship(
  question: QuestionObject,
  objective: ObjectiveObject,
  relationships: ResearchObjectRelationship[],
) {
  return relationships.find((relationship) => (
    relationship.fromId === question.id
    && relationship.toId === objective.id
    && relationship.relationType === 'operationalizes'
  ));
}

function emptyReport(
  view: ResearchObjectView,
  checkedAt: string,
  objectives: ObjectiveObject[],
  questions: QuestionObject[],
  issues: string[],
): ObjectivesQuestionsConsistencyReport {
  return {
    checkType: 'objective_question_consistency',
    formulaVersion: OBJECTIVE_QUESTION_FORMULA_VERSION,
    knowledgeType: 'inference',
    projectId: view.projectId,
    objectiveIds: objectives.map((item) => item.id),
    questionIds: questions.map((item) => item.id),
    overallScore: 0,
    coverageScore: 0,
    status: 'failed',
    summary: 'تعذر إجراء فحص الاتساق لعدم اكتمال الأهداف أو أسئلة البحث.',
    unmatchedObjectiveIds: objectives
      .filter((objective) => !questions.some((question) => question.content.orderIndex === objective.content.orderIndex))
      .map((objective) => objective.id),
    duplicateQuestionPairs: [],
    results: [],
    issues,
    checkedAt,
  };
}

export function evaluateObjectivesQuestionsConsistency(
  view: ResearchObjectView,
  options: { checkedAt?: string } = {},
): ObjectivesQuestionsConsistencyReport {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const objectives = view.objects.filter((item): item is ObjectiveObject => item.type === 'objective');
  const questions = view.objects.filter((item): item is QuestionObject => item.type === 'question');
  const inputIssues: string[] = [];

  if (!objectives.length) inputIssues.push('لا توجد أهداف بحث صالحة لإجراء الفحص.');
  if (!questions.length) inputIssues.push('لا توجد أسئلة بحث صالحة لإجراء الفحص.');
  if (objectives.length !== questions.length) inputIssues.push('يجب أن يقابل كل هدف سؤال بحث واحد فقط.');
  if (inputIssues.length) return emptyReport(view, checkedAt, objectives, questions, inputIssues);

  const questionConcepts = questions.map((question) => concepts(question.content.statement));
  const duplicateQuestionPairs: Array<[string, string]> = [];
  const duplicateIds = new Set<string>();
  for (let firstIndex = 0; firstIndex < questions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < questions.length; secondIndex += 1) {
      if (jaccard(questionConcepts[firstIndex].stems, questionConcepts[secondIndex].stems) >= 0.8) {
        duplicateQuestionPairs.push([questions[firstIndex].id, questions[secondIndex].id]);
        duplicateIds.add(questions[firstIndex].id);
        duplicateIds.add(questions[secondIndex].id);
      }
    }
  }

  const results: ObjectiveQuestionValidationResult[] = objectives.map((objective) => {
    const question = questions.find((item) => item.content.orderIndex === objective.content.orderIndex);
    if (!question) {
      throw new Error('Objective-question pairing invariant was not satisfied.');
    }
    const objectiveConcepts = concepts(objective.content.statement);
    const questionValues = concepts(question.content.statement);
    const matched = intersection(objectiveConcepts.stems, questionValues.stems);
    const objectiveRecall = matched.size / Math.max(1, objectiveConcepts.stems.size);
    const questionPrecision = matched.size / Math.max(1, questionValues.stems.size);
    const alignment = rounded((objectiveRecall * 0.75 + questionPrecision * 0.25) * 100);
    const answerability = isQuestionForm(question.content.statement) ? 100 : 20;
    const specificity = questionValues.stems.size >= 5
      ? 100
      : questionValues.stems.size >= 3 ? 70 : 30;
    let score = rounded(alignment * 0.65 + answerability * 0.2 + specificity * 0.15);
    if (!matched.size) score = Math.min(score, 25);
    if (duplicateIds.has(question.id)) score = Math.min(score, 49);

    const missingObjectiveConcepts = [...objectiveConcepts.stems]
      .filter((concept) => !matched.has(concept))
      .map((concept) => objectiveConcepts.surfaceByStem.get(concept) || concept);
    const gapsFound: string[] = [];
    if (!matched.size) gapsFound.push('السؤال لا يعكس المفاهيم الأساسية في الهدف المقابل.');
    else if (alignment < 55) gapsFound.push('السؤال مرتبط بالهدف جزئيًا لكنه قد يقيس جانبًا مختلفًا عنه.');
    if (answerability < 100) gapsFound.push('الصياغة لا تظهر كسؤال بحث يمكن الإجابة عنه بوضوح.');
    if (specificity < 70) gapsFound.push('السؤال عام ولا يحدد الظاهرة أو المتغير أو المجتمع بما يكفي.');
    if (duplicateIds.has(question.id)) gapsFound.push('السؤال متشابه بدرجة مرتفعة مع سؤال آخر ولا يختبر هدفًا مستقلًا.');

    let suggestedAction = 'لا يلزم تعديل جوهري؛ راجع الصياغة النهائية بصوت الباحث.';
    if (!matched.size) {
      const anchors = [...objectiveConcepts.stems]
        .slice(0, 4)
        .map((concept) => objectiveConcepts.surfaceByStem.get(concept) || concept);
      suggestedAction = `أعد صياغة السؤال ليطلب إجابة مباشرة عن مفاهيم الهدف: ${anchors.join('، ')}.`;
    } else if (duplicateIds.has(question.id)) {
      suggestedAction = 'اجعل هذا السؤال يختبر الهدف المقابل وحده، أو ادمجه مع السؤال المكرر بعد مراجعة الأهداف.';
    } else if (answerability < 100) {
      suggestedAction = 'حوّل الصياغة إلى سؤال مباشر يبدأ بأداة استفهام وينتهي بعلامة استفهام.';
    } else if (alignment < 55) {
      suggestedAction = 'أضف المتغير أو المجتمع أو العلاقة المذكورة في الهدف إلى السؤال بصورة صريحة.';
    }

    const relationship = pairedRelationship(question, objective, view.relationships);
    return {
      id: `validation:${question.id}:objective-question:${OBJECTIVE_QUESTION_FORMULA_VERSION}`,
      relationshipId: relationship?.id || `${question.id}:operationalizes:${objective.id}`,
      checkType: 'objective_question_consistency',
      score,
      formulaVersion: OBJECTIVE_QUESTION_FORMULA_VERSION,
      knowledgeType: 'inference',
      rationale: `المواءمة ${alignment}/100، قابلية الإجابة ${answerability}/100، والتحديد ${specificity}/100.`,
      gapsFound,
      suggestedAction,
      evidenceUsed: [objective.id, question.id],
      status: statusForScore(score),
      checkedAt,
      objectiveId: objective.id,
      questionId: question.id,
      dimensions: { alignment, answerability, specificity },
      matchedConcepts: [...matched].map((concept) => objectiveConcepts.surfaceByStem.get(concept) || concept),
      missingObjectiveConcepts,
    };
  });

  const unmatchedObjectiveIds = objectives
    .filter((objective) => !questions.some((question) => question.content.orderIndex === objective.content.orderIndex))
    .map((objective) => objective.id);
  const coverageScore = rounded(
    results.filter((result) => result.dimensions.alignment >= 55).length / Math.max(1, objectives.length) * 100,
  );
  const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  const duplicatePenalty = Math.min(20, duplicateQuestionPairs.length * 10);
  const overallScore = rounded(averageScore * 0.8 + coverageScore * 0.2 - duplicatePenalty);

  let status: ObjectivesQuestionsConsistencyReport['status'] = 'passed';
  if (results.some((result) => result.status === 'failed') || coverageScore < 50) status = 'failed';
  else if (results.some((result) => result.status === 'warning') || coverageScore < 100 || duplicateQuestionPairs.length) status = 'warning';

  const issues: string[] = [];
  if (coverageScore < 100) issues.push('يوجد هدف واحد على الأقل لا يعكسه السؤال المقابل بوضوح كافٍ.');
  if (duplicateQuestionPairs.length) issues.push('توجد أسئلة متشابهة بدرجة مرتفعة وتحتاج تفريقًا منهجيًا.');
  const summary = status === 'passed'
    ? 'كل سؤال يعكس الهدف المقابل ويمكن توجيه المنهجية للإجابة عنه.'
    : status === 'warning'
      ? 'الأسئلة مرتبطة بالأهداف، لكن بعض الصياغات تحتاج تحسينًا قبل الاعتماد النهائي.'
      : 'يوجد خلل جوهري بين هدف واحد على الأقل والسؤال المقابل له.';

  return {
    checkType: 'objective_question_consistency',
    formulaVersion: OBJECTIVE_QUESTION_FORMULA_VERSION,
    knowledgeType: 'inference',
    projectId: view.projectId,
    objectiveIds: objectives.map((item) => item.id),
    questionIds: questions.map((item) => item.id),
    overallScore,
    coverageScore,
    status,
    summary,
    unmatchedObjectiveIds,
    duplicateQuestionPairs,
    results,
    issues,
    checkedAt,
  };
}
