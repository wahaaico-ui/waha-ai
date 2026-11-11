/**
 * One map of how the research parts hold together (DOC-26-01): the problem,
 * each objective, its questions, their hypotheses and the methodology, with
 * the existing consistency engines' signal on every link.
 *
 * Owner decision (2026-11-11): show each signal and its reasons as a prompt
 * for the researcher's review, never as a score. The engines compare wording,
 * so a signal is a place to look, not a verdict on the research.
 */
import { createResearchObjectView } from './adapter';
import { evaluateObjectivesQuestionsConsistency } from './objectives-questions-consistency';
import { evaluateProblemObjectivesConsistency } from './problem-objectives-consistency';
import { evaluateQuestionsHypothesesConsistency } from './questions-hypotheses-consistency';
import { evaluateQuestionsMethodologyConsistency } from './questions-methodology-consistency';
import type {
  HypothesisObject,
  JourneyDocumentSnapshot,
  MethodologyObject,
  ObjectiveObject,
  ObjectivesQuestionsConsistencyReport,
  ProblemObject,
  ProblemObjectivesConsistencyReport,
  QuestionObject,
  QuestionsHypothesesConsistencyReport,
  QuestionsMethodologyConsistencyReport,
  ResearchObjectView,
  ValidationResultBase,
} from './types';

export type MapSignal = 'sound' | 'review' | 'conflict' | 'not_checked';
export type MapNodeKind = 'problem' | 'objective' | 'question' | 'hypothesis' | 'methodology';
/** `approach` is set on the methodology node only: its stored approach code. */
export type MapNode = { id: string; kind: MapNodeKind; number: number | null; statement: string; approach?: string | null };
export type MapLink = { id: string; signal: MapSignal; reasons: string[]; action: string | null };
export type MapQuestionStep = {
  question: MapNode;
  objectiveLink: MapLink | null;
  hypothesis: MapNode | null;
  hypothesisLink: MapLink | null;
  methodologyLink: MapLink | null;
};
/** `objective` is null for questions that are not tied to any objective. */
export type MapChain = { objective: MapNode | null; problemLink: MapLink | null; questions: MapQuestionStep[] };

export type ConsistencyMap = {
  problem: MapNode | null;
  methodology: MapNode | null;
  /** Set when the researcher decided not to use hypotheses; shown once for all questions. */
  hypothesesDecision: { signal: MapSignal; summary: string; reasons: string[] } | null;
  chains: MapChain[];
  /** Nodes whose own link needs review or conflicts. */
  flagged: string[];
  /** For each node, the links that change with it: its own and everything built on it. */
  affected: Record<string, string[]>;
  /** Why parts of the map could not be checked. */
  notices: string[];
  checkedAt: string;
};

export type ConsistencyReports = {
  problemObjectives: ProblemObjectivesConsistencyReport;
  objectivesQuestions: ObjectivesQuestionsConsistencyReport;
  questionsHypotheses: QuestionsHypothesesConsistencyReport | null;
  questionsMethodology: QuestionsMethodologyConsistencyReport;
};

const SIGNALS: Record<ValidationResultBase<string>['status'], MapSignal> = { passed: 'sound', warning: 'review', failed: 'conflict' };

/** The thresholds the hypotheses engine uses for its own results. */
const scoreSignal = (score: number): MapSignal => (score >= 70 ? 'sound' : score >= 45 ? 'review' : 'conflict');

const toLink = (result: ValidationResultBase<string> | undefined): MapLink | null => result
  ? { id: result.id, signal: SIGNALS[result.status], reasons: result.gapsFound, action: result.gapsFound.length ? result.suggestedAction : null }
  : null;

const isProblem = (item: ResearchObjectView['objects'][number]): item is ProblemObject => item.type === 'problem';
const isObjective = (item: ResearchObjectView['objects'][number]): item is ObjectiveObject => item.type === 'objective';
const isQuestion = (item: ResearchObjectView['objects'][number]): item is QuestionObject => item.type === 'question';
const isHypothesis = (item: ResearchObjectView['objects'][number]): item is HypothesisObject => item.type === 'hypothesis';
const isMethodology = (item: ResearchObjectView['objects'][number]): item is MethodologyObject => item.type === 'methodology';

function methodologyStatement(methodology: MethodologyObject) {
  return [methodology.content.population, methodology.content.instrument].filter(Boolean).join(' — ');
}

export function buildConsistencyMap(view: ResearchObjectView, reports: ConsistencyReports, checkedAt: string): ConsistencyMap {
  const problemObject = view.objects.find(isProblem) ?? null;
  const objectiveObjects = view.objects.filter(isObjective).sort((a, b) => a.content.orderIndex - b.content.orderIndex);
  const questionObjects = view.objects.filter(isQuestion).sort((a, b) => a.content.orderIndex - b.content.orderIndex);
  const hypothesisObjects = view.objects.filter(isHypothesis);
  const methodologyObject = view.objects.find(isMethodology) ?? null;

  const problem: MapNode | null = problemObject ? { id: problemObject.id, kind: 'problem', number: null, statement: problemObject.content.statement } : null;
  const methodology: MapNode | null = methodologyObject
    ? { id: methodologyObject.id, kind: 'methodology', number: null, statement: methodologyStatement(methodologyObject), approach: methodologyObject.content.approach || null }
    : null;

  const hypothesesReport = reports.questionsHypotheses;
  const hypothesesDecision = hypothesesReport?.mode === 'not_applicable'
    ? { signal: scoreSignal(hypothesesReport.overallScore), summary: hypothesesReport.summary, reasons: hypothesesReport.issues }
    : null;

  const questionStep = (question: QuestionObject): MapQuestionStep => {
    const hypothesisResult = hypothesesReport?.results.find(result => result.questionId === question.id);
    const hypothesisObject = hypothesisResult?.hypothesisId ? hypothesisObjects.find(item => item.id === hypothesisResult.hypothesisId) ?? null : null;
    return {
      question: { id: question.id, kind: 'question', number: question.content.orderIndex + 1, statement: question.content.statement },
      objectiveLink: toLink(reports.objectivesQuestions.results.find(result => result.questionId === question.id)),
      hypothesis: hypothesisObject ? { id: hypothesisObject.id, kind: 'hypothesis', number: hypothesisObject.content.orderIndex + 1, statement: hypothesisObject.content.statement } : null,
      hypothesisLink: toLink(hypothesisResult),
      methodologyLink: toLink(reports.questionsMethodology.results.find(result => result.questionId === question.id)),
    };
  };

  // A question belongs to the objective it operationalizes, as the engines pair them.
  const objectiveOf = (question: QuestionObject) => view.relationships
    .find(relationship => relationship.fromId === question.id && relationship.relationType === 'operationalizes')?.toId ?? null;

  const chains: MapChain[] = objectiveObjects.map(objective => ({
    objective: { id: objective.id, kind: 'objective', number: objective.content.orderIndex + 1, statement: objective.content.statement },
    problemLink: toLink(reports.problemObjectives.results.find(result => result.objectiveId === objective.id)),
    questions: questionObjects.filter(question => objectiveOf(question) === objective.id).map(questionStep),
  }));
  const loose = questionObjects.filter(question => !objectiveObjects.some(objective => objective.id === objectiveOf(question)));
  if (loose.length) chains.push({ objective: null, problemLink: null, questions: loose.map(questionStep) });

  const stepLinks = (step: MapQuestionStep) => [step.objectiveLink, step.hypothesisLink, step.methodologyLink];
  const ids = (links: Array<MapLink | null>) => links.flatMap(link => (link ? [link.id] : []));
  const affected: Record<string, string[]> = {};
  const flagged: string[] = [];
  const needsReview = (link: MapLink | null) => link?.signal === 'review' || link?.signal === 'conflict';

  for (const chain of chains) {
    if (chain.objective) {
      affected[chain.objective.id] = ids([chain.problemLink, ...chain.questions.flatMap(stepLinks)]);
      if (needsReview(chain.problemLink)) flagged.push(chain.objective.id);
    }
    for (const step of chain.questions) {
      affected[step.question.id] = ids(stepLinks(step));
      if (needsReview(step.objectiveLink)) flagged.push(step.question.id);
      if (step.hypothesis) {
        affected[step.hypothesis.id] = ids([step.hypothesisLink]);
        if (needsReview(step.hypothesisLink)) flagged.push(step.hypothesis.id);
      }
    }
  }
  if (problem) affected[problem.id] = chains.flatMap(chain => ids([chain.problemLink, ...chain.questions.flatMap(stepLinks)]));
  if (methodology) {
    const methodologyLinks = chains.flatMap(chain => chain.questions.map(step => step.methodologyLink));
    affected[methodology.id] = ids(methodologyLinks);
    if (methodologyLinks.some(needsReview)) flagged.push(methodology.id);
  }

  const notices = [
    ...(reports.problemObjectives.results.length ? [] : reports.problemObjectives.issues),
    ...(reports.objectivesQuestions.results.length ? [] : reports.objectivesQuestions.issues),
    ...(hypothesesReport ? (hypothesesReport.results.length || hypothesesDecision ? [] : hypothesesReport.issues) : ['لم تُحفظ مرحلة الفرضيات بعد.']),
    ...(reports.questionsMethodology.results.length ? [] : reports.questionsMethodology.issues),
  ].filter((notice, index, all) => notice && all.indexOf(notice) === index);

  return { problem, methodology, hypothesesDecision, chains, flagged, affected, notices, checkedAt };
}

/** Builds the research object view from saved journey documents and runs the four checks on it. */
export function evaluateConsistencyMap(projectId: string, documents: JourneyDocumentSnapshot[], options: { checkedAt?: string } = {}): ConsistencyMap {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const view = createResearchObjectView(projectId, documents);
  const hypothesesDocument = documents
    .filter(document => document.project_id === projectId && document.type === 'journey:hypotheses')
    .sort((a, b) => (b.version || 0) - (a.version || 0) || String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  let settings: Record<string, unknown> = {};
  if (hypothesesDocument) {
    try {
      const content = typeof hypothesesDocument.content === 'string' ? JSON.parse(hypothesesDocument.content) : hypothesesDocument.content;
      settings = content && typeof content === 'object' && !Array.isArray(content) ? content as Record<string, unknown> : {};
    } catch { settings = {}; }
  }
  return buildConsistencyMap(view, {
    problemObjectives: evaluateProblemObjectivesConsistency(view, { checkedAt }),
    objectivesQuestions: evaluateObjectivesQuestionsConsistency(view, { checkedAt }),
    questionsHypotheses: hypothesesDocument ? evaluateQuestionsHypothesesConsistency(view, {
      checkedAt,
      mode: settings.mode === 'not_applicable' ? 'not_applicable' : 'required',
      rationale: typeof settings.rationale === 'string' ? settings.rationale : '',
    }) : null,
    questionsMethodology: evaluateQuestionsMethodologyConsistency(view, { checkedAt }),
  }, checkedAt);
}
