export const RESEARCH_OBJECT_TYPES = ['problem', 'gap', 'objective', 'question', 'hypothesis', 'methodology'] as const;

export type ResearchObjectType = (typeof RESEARCH_OBJECT_TYPES)[number];

export type KnowledgeType =
  | 'documented'
  | 'inference'
  | 'suggestion'
  | 'general_unverified';

export type ResearchObjectOrigin =
  | 'researcher'
  | 'ai_draft'
  | 'system_derived'
  | 'unknown';

export type ResearchObjectStatus = 'accepted' | 'superseded';
export type ConsistencyStatus = 'not_checked' | 'passed' | 'warning' | 'failed';

export type SourceDocumentReference = {
  documentId: string;
  documentType: string;
  version: number;
  createdAt: string | null;
  fieldPath: string;
};

export type ResearchObjectBase<TType extends ResearchObjectType, TContent> = {
  id: string;
  type: TType;
  projectId: string;
  content: TContent;
  knowledgeType: KnowledgeType;
  knowledgeRationale: string;
  origin: ResearchObjectOrigin;
  status: ResearchObjectStatus;
  consistencyStatus: ConsistencyStatus;
  source: SourceDocumentReference;
};

export type ProblemObject = ResearchObjectBase<'problem', {
  statement: string;
  derivedFromTitleId: null;
  researchable: null;
}>;

export type GapObject = ResearchObjectBase<'gap', {
  statement: string;
  parentProblemId: string;
  evidenceIds: string[];
}>;

export type ObjectiveObject = ResearchObjectBase<'objective', {
  statement: string;
  orderIndex: number;
  measurable: null;
}>;

export type QuestionObject = ResearchObjectBase<'question', {
  statement: string;
  orderIndex: number;
  objectiveId: string | null;
}>;

export type HypothesisObject = ResearchObjectBase<'hypothesis', {
  statement: string;
  orderIndex: number;
  questionId: string | null;
}>;

export type MethodologyObject = ResearchObjectBase<'methodology', {
  approach: string;
  population: string;
  sample: string;
  instrument: string;
}>;

export type ResearchObject = ProblemObject | GapObject | ObjectiveObject | QuestionObject | HypothesisObject | MethodologyObject;

export type ResearchObjectRelationship = {
  id: string;
  fromId: string;
  toId: string;
  relationType: 'addresses' | 'derived_from' | 'operationalizes' | 'tests' | 'designed_to_answer';
  status: 'unvalidated';
  derived: true;
  derivation: 'same_project_sequence' | 'nested_source_field';
  knowledgeType: 'inference';
  consistencyStatus: 'not_checked';
};

export type ValidationResultBase<TCheckType extends string> = {
  id: string;
  relationshipId: string;
  checkType: TCheckType;
  score: number;
  formulaVersion: string;
  knowledgeType: 'inference';
  rationale: string;
  gapsFound: string[];
  suggestedAction: string;
  evidenceUsed: string[];
  status: 'passed' | 'warning' | 'failed';
  checkedAt: string;
};

export type ProblemObjectiveValidationResult = ValidationResultBase<'problem_objective_consistency'> & {
  objectiveId: string;
  problemId: string;
  dimensions: {
    relevance: number;
    measurability: number;
    specificity: number;
  };
  matchedConcepts: string[];
  uncoveredConcepts: string[];
};

export type ObjectiveQuestionValidationResult = ValidationResultBase<'objective_question_consistency'> & {
  objectiveId: string;
  questionId: string;
  dimensions: {
    alignment: number;
    answerability: number;
    specificity: number;
  };
  matchedConcepts: string[];
  missingObjectiveConcepts: string[];
};

export type QuestionMethodologyValidationResult = ValidationResultBase<'question_methodology_consistency'> & {
  questionId: string;
  methodologyId: string;
  inferredQuestionMode: 'quantitative' | 'qualitative' | 'descriptive' | 'unknown';
  dimensions: {
    approachFit: number;
    populationAlignment: number;
    instrumentFit: number;
    sampleClarity: number;
  };
  matchedPopulationConcepts: string[];
};

export type QuestionHypothesisValidationResult = ValidationResultBase<'question_hypothesis_consistency'> & {
  questionId: string;
  hypothesisId: string | null;
  dimensions: { alignment: number; testability: number; statementForm: number };
  matchedConcepts: string[];
};

export type QuestionsHypothesesConsistencyReport = {
  checkType: 'question_hypothesis_consistency';
  formulaVersion: string;
  knowledgeType: 'inference';
  projectId: string;
  mode: 'required' | 'not_applicable' | 'missing';
  questionIds: string[];
  hypothesisIds: string[];
  overallScore: number;
  coverageScore: number;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  results: QuestionHypothesisValidationResult[];
  issues: string[];
  checkedAt: string;
};

export type ProblemObjectivesConsistencyReport = {
  checkType: 'problem_objective_consistency';
  formulaVersion: string;
  knowledgeType: 'inference';
  projectId: string;
  problemId: string | null;
  objectiveIds: string[];
  overallScore: number;
  coverageScore: number;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  uncoveredProblemConcepts: string[];
  duplicateObjectivePairs: Array<[string, string]>;
  results: ProblemObjectiveValidationResult[];
  issues: string[];
  checkedAt: string;
};

export type ObjectivesQuestionsConsistencyReport = {
  checkType: 'objective_question_consistency';
  formulaVersion: string;
  knowledgeType: 'inference';
  projectId: string;
  objectiveIds: string[];
  questionIds: string[];
  overallScore: number;
  coverageScore: number;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  unmatchedObjectiveIds: string[];
  duplicateQuestionPairs: Array<[string, string]>;
  results: ObjectiveQuestionValidationResult[];
  issues: string[];
  checkedAt: string;
};

export type QuestionsMethodologyConsistencyReport = {
  checkType: 'question_methodology_consistency';
  formulaVersion: string;
  knowledgeType: 'inference';
  projectId: string;
  questionIds: string[];
  methodologyId: string | null;
  overallScore: number;
  coverageScore: number;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  results: QuestionMethodologyValidationResult[];
  issues: string[];
  checkedAt: string;
};

export type ResearchConsistencyReport =
  | ProblemObjectivesConsistencyReport
  | ObjectivesQuestionsConsistencyReport
  | QuestionsHypothesesConsistencyReport
  | QuestionsMethodologyConsistencyReport;

export type ResearchObjectViewWarning = {
  code:
    | 'invalid_document_content'
    | 'missing_problem_statement'
    | 'gap_without_problem'
    | 'invalid_objectives'
    | 'objectives_without_problem'
    | 'invalid_questions'
    | 'questions_without_objectives'
    | 'question_objective_count_mismatch'
    | 'invalid_hypotheses'
    | 'hypotheses_without_questions'
    | 'hypothesis_question_count_mismatch'
    | 'invalid_methodology'
    | 'methodology_without_questions';
  documentId: string | null;
  message: string;
};

export type ResearchObjectView = {
  projectId: string;
  objects: ResearchObject[];
  relationships: ResearchObjectRelationship[];
  validationResults: Array<
    ValidationResultBase<
      'problem_objective_consistency'
      | 'objective_question_consistency'
      | 'question_hypothesis_consistency'
      | 'question_methodology_consistency'
    >
  >;
  warnings: ResearchObjectViewWarning[];
};

export type JourneyDocumentSnapshot = {
  id: string;
  project_id: string;
  type: string | null;
  content: string | Record<string, unknown> | null;
  version: number | null;
  created_at: string | null;
};
