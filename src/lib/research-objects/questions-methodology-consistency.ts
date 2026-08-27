import type {
  MethodologyObject,
  QuestionMethodologyValidationResult,
  QuestionObject,
  QuestionsMethodologyConsistencyReport,
  ResearchObjectRelationship,
  ResearchObjectView,
} from './types';

export const QUESTION_METHODOLOGY_FORMULA_VERSION = 'question-methodology-consistency/v1';

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const STOP_WORDS = new Set([
  'في', 'من', 'الى', 'على', 'عن', 'مع', 'بين', 'لدى', 'ضمن', 'خلال', 'حول', 'هذه', 'هذا',
  'التي', 'الذي', 'ذلك', 'تلك', 'ما', 'ماذا', 'كيف', 'هل', 'لماذا', 'مدى', 'اثر', 'علاقه',
  'فروق', 'مستوي', 'واقع', 'دور', 'the', 'and', 'for', 'with', 'from', 'among', 'what', 'how',
  'why', 'does', 'is', 'are', 'effect', 'relationship', 'level', 'study', 'research', 'question',
]);

const MODE_MARKERS = {
  quantitative: [
    /(?:اثر|تاثير|علاقه|ارتباط|فروق|قياس|اختبار|متغير|مدى|مستوي)/u,
    /(?:effect|impact|relationship|correlation|difference|measure|variable|extent|level)/i,
  ],
  qualitative: [
    /(?:كيف|لماذا|خبرات|تجارب|تصورات|اتجاهات|معاني|فهم|تفسير)/u,
    /(?:how|why|experience|perception|meaning|understand|interpret)/i,
  ],
  descriptive: [
    /(?:ما واقع|ما مستوى|ما مستوي|ما خصائص|وصف|انتشار|نسبه)/u,
    /(?:what is the level|what are the characteristics|prevalence|profile|describe)/i,
  ],
} as const;

const QUANTITATIVE_INSTRUMENTS = /(?:استبان|استبيان|مقياس|اختبار|سجل|questionnaire|survey|scale|test|records?)/iu;
const QUALITATIVE_INSTRUMENTS = /(?:مقابل|ملاحظه|ملاحظة|مجموعه بوريه|مجموعة بؤرية|تحليل وثائق|interview|observation|focus group|document analysis)/iu;
const SAMPLE_DESIGN_MARKERS = /(?:عشوائي|طبقي|عنقودي|قصدي|هادف|متاح|ملائم|شامل|حصر|حجم|اختيار|random|stratified|cluster|purposive|convenience|census|sample size|selection)/iu;

type QuestionMode = QuestionMethodologyValidationResult['inferredQuestionMode'];

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

function concepts(value: string) {
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

function inferMode(statement: string): QuestionMode {
  const normalizedStatement = (statement.match(TOKEN_PATTERN) || [])
    .map(normalizeToken)
    .join(' ');
  const scores: Record<Exclude<QuestionMode, 'unknown'>, number> = {
    quantitative: MODE_MARKERS.quantitative.filter((marker) => marker.test(normalizedStatement)).length,
    qualitative: MODE_MARKERS.qualitative.filter((marker) => marker.test(normalizedStatement)).length,
    descriptive: MODE_MARKERS.descriptive.filter((marker) => marker.test(normalizedStatement)).length,
  };
  const entries = Object.entries(scores) as Array<[Exclude<QuestionMode, 'unknown'>, number]>;
  entries.sort((first, second) => second[1] - first[1]);
  return entries[0][1] > 0 ? entries[0][0] : 'unknown';
}

function approachFit(mode: QuestionMode, approach: string) {
  const matrix: Record<QuestionMode, Record<string, number>> = {
    quantitative: { quantitative: 100, mixed: 90, descriptive: 70, qualitative: 20 },
    qualitative: { qualitative: 100, mixed: 90, descriptive: 55, quantitative: 20 },
    descriptive: { descriptive: 100, quantitative: 85, mixed: 80, qualitative: 45 },
    unknown: { quantitative: 55, qualitative: 55, mixed: 65, descriptive: 60 },
  };
  return matrix[mode][approach] ?? 20;
}

function instrumentFit(mode: QuestionMode, approach: string, instrument: string) {
  const hasQuantitative = QUANTITATIVE_INSTRUMENTS.test(instrument);
  const hasQualitative = QUALITATIVE_INSTRUMENTS.test(instrument);
  if (approach === 'mixed') return hasQuantitative && hasQualitative ? 100 : hasQuantitative || hasQualitative ? 50 : 25;
  if (mode === 'qualitative' || approach === 'qualitative') return hasQualitative ? 100 : hasQuantitative ? 20 : 45;
  if (mode === 'quantitative' || approach === 'quantitative') return hasQuantitative ? 100 : hasQualitative ? 20 : 45;
  if (mode === 'descriptive' || approach === 'descriptive') return hasQuantitative || hasQualitative ? 85 : 45;
  return hasQuantitative || hasQualitative ? 70 : 40;
}

function linkedRelationship(
  methodology: MethodologyObject,
  question: QuestionObject,
  relationships: ResearchObjectRelationship[],
) {
  return relationships.find((relationship) => (
    relationship.fromId === methodology.id
    && relationship.toId === question.id
    && relationship.relationType === 'designed_to_answer'
  ));
}

function statusForScore(score: number): 'passed' | 'warning' | 'failed' {
  if (score >= 70) return 'passed';
  if (score >= 45) return 'warning';
  return 'failed';
}

function emptyReport(
  view: ResearchObjectView,
  checkedAt: string,
  questions: QuestionObject[],
  methodology: MethodologyObject | null,
  issues: string[],
): QuestionsMethodologyConsistencyReport {
  return {
    checkType: 'question_methodology_consistency',
    formulaVersion: QUESTION_METHODOLOGY_FORMULA_VERSION,
    knowledgeType: 'inference',
    projectId: view.projectId,
    questionIds: questions.map((question) => question.id),
    methodologyId: methodology?.id ?? null,
    overallScore: 0,
    coverageScore: 0,
    status: 'failed',
    summary: 'تعذر فحص المنهجية لأن الأسئلة أو عناصر التصميم المنهجي غير مكتملة.',
    results: [],
    issues,
    checkedAt,
  };
}

export function evaluateQuestionsMethodologyConsistency(
  view: ResearchObjectView,
  options: { checkedAt?: string } = {},
): QuestionsMethodologyConsistencyReport {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const questions = view.objects.filter((item): item is QuestionObject => item.type === 'question');
  const methodology = view.objects.find((item): item is MethodologyObject => item.type === 'methodology') ?? null;
  const inputIssues: string[] = [];
  if (!questions.length) inputIssues.push('لا توجد أسئلة بحث صالحة لإجراء الفحص.');
  if (!methodology) inputIssues.push('لا توجد منهجية مكتملة لإجراء الفحص.');
  if (inputIssues.length || !methodology) return emptyReport(view, checkedAt, questions, methodology, inputIssues);

  const populationConcepts = concepts(methodology.content.population);
  const sampleClarity = SAMPLE_DESIGN_MARKERS.test(methodology.content.sample)
    ? 100
    : concepts(methodology.content.sample).stems.size >= 5 ? 65 : 30;

  const results: QuestionMethodologyValidationResult[] = questions.map((question) => {
    const mode = inferMode(question.content.statement);
    const fitApproach = approachFit(mode, methodology.content.approach);
    const fitInstrument = instrumentFit(mode, methodology.content.approach, methodology.content.instrument);
    const questionConcepts = concepts(question.content.statement);
    const matchedStems = [...questionConcepts.stems].filter((concept) => populationConcepts.stems.has(concept));
    const populationAlignment = matchedStems.length >= 2 ? 100 : matchedStems.length === 1 ? 70 : 35;
    let score = rounded(
      fitApproach * 0.35
      + populationAlignment * 0.25
      + fitInstrument * 0.25
      + sampleClarity * 0.15,
    );
    if (fitApproach <= 25 || fitInstrument <= 25) score = Math.min(score, 39);
    else if (populationAlignment < 70 || sampleClarity < 70 || mode === 'unknown') score = Math.min(score, 69);
    const gapsFound: string[] = [];
    if (fitApproach <= 25) gapsFound.push('المنهج المختار لا يلائم نمط السؤال كما يظهر من صياغته.');
    else if (fitApproach < 70) gapsFound.push('ملاءمة المنهج للسؤال غير حاسمة وتحتاج تبريرًا منهجيًا.');
    if (fitInstrument <= 25) gapsFound.push('أداة جمع البيانات لا تنتج عادةً بيانات مناسبة للإجابة عن هذا السؤال.');
    else if (fitInstrument < 70) gapsFound.push('الأداة تحتاج توضيحًا أو أداة مساندة لتغطية السؤال.');
    if (populationAlignment < 70) gapsFound.push('مجتمع الدراسة لا يعكس بوضوح الفئة أو السياق المذكور في السؤال.');
    if (sampleClarity < 70) gapsFound.push('وصف العينة لا يوضح طريقة الاختيار أو حجمها ومبررها بما يكفي.');
    if (mode === 'unknown') gapsFound.push('تعذر استنتاج طبيعة السؤال بثقة من صياغته الحالية.');

    let suggestedAction = 'لا يلزم تعديل جوهري؛ وثّق مبررات الاختيار في خطة البحث.';
    if (fitApproach <= 25) suggestedAction = 'راجع نوع السؤال ثم اختر منهجًا كميًا أو نوعيًا أو مختلطًا يجيب عنه مباشرة.';
    else if (fitInstrument <= 25) suggestedAction = 'استبدل الأداة أو أضف أداة تجمع نوع البيانات المطلوب للإجابة عن السؤال.';
    else if (populationAlignment < 70) suggestedAction = 'حدّد مجتمع الدراسة بحيث يطابق الفئة والمكان والسياق الوارد في السؤال.';
    else if (sampleClarity < 70) suggestedAction = 'أضف طريقة اختيار العينة وحجمها أو معيار تقديره ومبرر الاختيار.';
    else if (mode === 'unknown') suggestedAction = 'أعد صياغة السؤال ليظهر هل يصف ظاهرة، يقيس علاقة، أم يستكشف خبرة.';

    const relationship = linkedRelationship(methodology, question, view.relationships);
    return {
      id: `validation:${question.id}:question-methodology:${QUESTION_METHODOLOGY_FORMULA_VERSION}`,
      relationshipId: relationship?.id || `${methodology.id}:designed_to_answer:${question.id}`,
      checkType: 'question_methodology_consistency',
      score,
      formulaVersion: QUESTION_METHODOLOGY_FORMULA_VERSION,
      knowledgeType: 'inference',
      rationale: `ملاءمة المنهج ${fitApproach}/100، المجتمع ${populationAlignment}/100، الأداة ${fitInstrument}/100، ووضوح العينة ${sampleClarity}/100.`,
      gapsFound,
      suggestedAction,
      evidenceUsed: [question.id, methodology.id],
      status: statusForScore(score),
      checkedAt,
      questionId: question.id,
      methodologyId: methodology.id,
      inferredQuestionMode: mode,
      dimensions: {
        approachFit: fitApproach,
        populationAlignment,
        instrumentFit: fitInstrument,
        sampleClarity,
      },
      matchedPopulationConcepts: matchedStems.map((concept) => populationConcepts.surfaceByStem.get(concept) || concept),
    };
  });

  const coverageScore = rounded(results.filter((result) => result.status !== 'failed').length / questions.length * 100);
  const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  const overallScore = rounded(averageScore * 0.8 + coverageScore * 0.2);
  let status: QuestionsMethodologyConsistencyReport['status'] = 'passed';
  if (results.some((result) => result.status === 'failed') || coverageScore < 100) status = 'failed';
  else if (results.some((result) => result.status === 'warning')) status = 'warning';

  const issues: string[] = [];
  if (results.some((result) => result.dimensions.approachFit < 70)) issues.push('المنهج المختار لا يجيب بوضوح عن سؤال واحد على الأقل.');
  if (results.some((result) => result.dimensions.instrumentFit < 70)) issues.push('أداة جمع البيانات لا تغطي نوع البيانات المطلوب لكل الأسئلة.');
  if (results.some((result) => result.dimensions.populationAlignment < 70)) issues.push('ارتباط مجتمع الدراسة بصياغة بعض الأسئلة غير واضح.');
  if (sampleClarity < 70) issues.push('خطة العينة تحتاج تفاصيل قابلة للتنفيذ والتحقق.');
  const summary = status === 'passed'
    ? 'المنهج والمجتمع والعينة والأداة قادرة مبدئيًا على الإجابة عن الأسئلة المحفوظة.'
    : status === 'warning'
      ? 'التصميم المنهجي مرتبط بالأسئلة، لكنه يحتاج تبريرًا أو تحسينًا قبل الاعتماد النهائي.'
      : 'يوجد سؤال واحد على الأقل لا يستطيع التصميم المنهجي الحالي الإجابة عنه بصورة سليمة.';

  return {
    checkType: 'question_methodology_consistency',
    formulaVersion: QUESTION_METHODOLOGY_FORMULA_VERSION,
    knowledgeType: 'inference',
    projectId: view.projectId,
    questionIds: questions.map((question) => question.id),
    methodologyId: methodology.id,
    overallScore,
    coverageScore,
    status,
    summary,
    results,
    issues,
    checkedAt,
  };
}
