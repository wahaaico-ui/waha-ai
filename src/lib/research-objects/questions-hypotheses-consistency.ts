import type {
  HypothesisObject,
  QuestionHypothesisValidationResult,
  QuestionObject,
  QuestionsHypothesesConsistencyReport,
  ResearchObjectView,
} from './types';

export const QUESTION_HYPOTHESIS_FORMULA_VERSION = 'question-hypothesis-consistency/v1';
const TOKENS = /[\p{L}\p{N}]+/gu;
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const STOP = new Set(['في', 'من', 'على', 'عن', 'الى', 'لدى', 'بين', 'ما', 'هل', 'كيف', 'لماذا', 'اثر', 'علاقه', 'فرق', 'وجود', 'عدم', 'the', 'and', 'what', 'how', 'does']);
const QUALITATIVE = /^(?:كيف|لماذا|ما تجارب|ما خبرات)|(?:يصف|تجارب|خبرات|تصورات|معاني)/iu;
const TESTABLE = /(?:اثر|تاثير|علاقه|ارتباط|فرق|فروق|يزداد|ينخفض|يتنبأ|يودي|يؤدي|effect|relationship|difference|predict)/iu;

function normalize(value: string) {
  return value.normalize('NFKC').replace(DIACRITICS, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه').toLocaleLowerCase('ar');
}

function concepts(value: string) {
  return new Set((normalize(value).match(TOKENS) || []).filter((token) => token.length >= 3 && !STOP.has(token)));
}

function overlap(first: Set<string>, second: Set<string>) {
  return [...first].filter((value) => second.has(value));
}

function scoreStatus(score: number): 'passed' | 'warning' | 'failed' {
  return score >= 70 ? 'passed' : score >= 45 ? 'warning' : 'failed';
}

export function evaluateQuestionsHypothesesConsistency(
  view: ResearchObjectView,
  options: { checkedAt?: string; mode?: 'required' | 'not_applicable'; rationale?: string } = {},
): QuestionsHypothesesConsistencyReport {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const questions = view.objects.filter((item): item is QuestionObject => item.type === 'question');
  const hypotheses = view.objects.filter((item): item is HypothesisObject => item.type === 'hypothesis');
  const mode = options.mode || (hypotheses.length ? 'required' : 'missing');
  const quantitativeQuestions = questions.filter((question) => !QUALITATIVE.test(normalize(question.content.statement)));

  if (!questions.length) return report('missing', 0, 0, 'لا توجد أسئلة صالحة لفحص قرار الفرضيات.', ['احفظ أسئلة البحث أولاً.'], []);
  if (mode === 'not_applicable') {
    const rationaleValid = (options.rationale || '').trim().length >= 30;
    const score = quantitativeQuestions.length ? 25 : rationaleValid ? 100 : 45;
    const issues = quantitativeQuestions.length
      ? ['توجد أسئلة كمية أو ارتباطية؛ استبعاد الفرضيات يحتاج مراجعة منهجية.']
      : rationaleValid ? [] : ['سبب عدم استخدام الفرضيات قصير ولا يوضح القرار المنهجي.'];
    return report('not_applicable', score, score, score >= 70 ? 'قرار عدم استخدام الفرضيات متسق مع طبيعة الأسئلة النوعية أو الاستكشافية.' : 'قرار عدم استخدام الفرضيات يحتاج مراجعة.', issues, []);
  }
  if (!hypotheses.length || hypotheses.length !== questions.length) {
    return report('required', 0, Math.round(hypotheses.length / Math.max(1, questions.length) * 100), 'يجب أن تقابل كل سؤال كمي فرضية قابلة للاختبار.', ['عدد الفرضيات لا يطابق عدد الأسئلة.'], []);
  }

  const results: QuestionHypothesisValidationResult[] = questions.map((question) => {
    const hypothesis = hypotheses.find((item) => item.content.orderIndex === question.content.orderIndex) || null;
    const matched = hypothesis ? overlap(concepts(question.content.statement), concepts(hypothesis.content.statement)) : [];
    const alignment = hypothesis ? Math.min(100, Math.round(matched.length / Math.max(1, concepts(question.content.statement).size) * 130)) : 0;
    const testability = hypothesis && TESTABLE.test(normalize(hypothesis.content.statement)) ? 100 : 35;
    const statementForm = hypothesis && !/[؟?]\s*$/u.test(hypothesis.content.statement) ? 100 : 20;
    let score = Math.round(alignment * 0.6 + testability * 0.25 + statementForm * 0.15);
    if (!matched.length) score = Math.min(score, 35);
    const gapsFound: string[] = [];
    if (alignment < 55) gapsFound.push('الفرضية لا تعكس المفاهيم الأساسية في السؤال المقابل.');
    if (testability < 70) gapsFound.push('الفرضية لا تصرح بعلاقة أو أثر أو فرق قابل للاختبار.');
    if (statementForm < 70) gapsFound.push('الفرضية مكتوبة كسؤال، وليست عبارة تقريرية قابلة للاختبار.');
    return {
      id: `validation:${hypothesis?.id || question.id}:question-hypothesis:${QUESTION_HYPOTHESIS_FORMULA_VERSION}`,
      relationshipId: hypothesis ? `${hypothesis.id}:tests:${question.id}` : `${question.id}:missing-hypothesis`,
      checkType: 'question_hypothesis_consistency', score, formulaVersion: QUESTION_HYPOTHESIS_FORMULA_VERSION,
      knowledgeType: 'inference', rationale: `المواءمة ${alignment}/100، قابلية الاختبار ${testability}/100، وصيغة العبارة ${statementForm}/100.`,
      gapsFound, suggestedAction: gapsFound.length ? 'أعد صياغة الفرضية لتقرر بوضوح العلاقة أو الأثر الوارد في السؤال نفسه.' : 'لا يلزم تعديل جوهري؛ راجع اتجاه الفرضية مع المشرف.',
      evidenceUsed: [question.id, ...(hypothesis ? [hypothesis.id] : [])], status: scoreStatus(score), checkedAt,
      questionId: question.id, hypothesisId: hypothesis?.id || null, dimensions: { alignment, testability, statementForm }, matchedConcepts: matched,
    };
  });
  const coverage = Math.round(results.filter((item) => item.dimensions.alignment >= 55).length / questions.length * 100);
  const overall = Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length * 0.8 + coverage * 0.2);
  const status = results.some((item) => item.status === 'failed') || coverage < 50 ? 'failed' : results.some((item) => item.status === 'warning') || coverage < 100 ? 'warning' : 'passed';
  const issues = results.flatMap((item) => item.gapsFound).filter((value, index, values) => values.indexOf(value) === index);
  return report('required', overall, coverage, status === 'passed' ? 'الفرضيات تعكس الأسئلة وقابلة للاختبار.' : status === 'warning' ? 'الفرضيات مرتبطة بالأسئلة، لكن بعض الصياغات تحتاج تحسيناً.' : 'يوجد خلل بين سؤال واحد على الأقل والفرضية المقابلة.', issues, results);

  function report(reportMode: QuestionsHypothesesConsistencyReport['mode'], overallScore: number, coverageScore: number, summary: string, issues: string[], results: QuestionHypothesisValidationResult[]): QuestionsHypothesesConsistencyReport {
    return { checkType: 'question_hypothesis_consistency', formulaVersion: QUESTION_HYPOTHESIS_FORMULA_VERSION, knowledgeType: 'inference', projectId: view.projectId, mode: reportMode, questionIds: questions.map((item) => item.id), hypothesisIds: hypotheses.map((item) => item.id), overallScore, coverageScore, status: scoreStatus(overallScore), summary, results, issues, checkedAt };
  }
}
