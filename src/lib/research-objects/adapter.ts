import type {
  GapObject,
  JourneyDocumentSnapshot,
  MethodologyObject,
  ObjectiveObject,
  ProblemObject,
  QuestionObject,
  ResearchObjectRelationship,
  ResearchObjectView,
  ResearchObjectViewWarning,
  SourceDocumentReference,
} from './types';

const PROBLEM_DOCUMENT_TYPE = 'journey:problem';
const OBJECTIVES_DOCUMENT_TYPE = 'journey:objectives';
const QUESTIONS_DOCUMENT_TYPE = 'journey:questions';
const METHODOLOGY_DOCUMENT_TYPE = 'journey:methodology';
const MAX_OBJECTIVES = 50;
const MAX_QUESTIONS = 50;

function objectId(projectId: string, type: 'problem' | 'gap' | 'objective' | 'question' | 'methodology', index?: number) {
  return index === undefined
    ? `project:${projectId}:${type}`
    : `project:${projectId}:${type}:${index + 1}`;
}

function parseContent(document: JourneyDocumentSnapshot): Record<string, unknown> | null {
  if (document.content && typeof document.content === 'object' && !Array.isArray(document.content)) {
    return document.content;
  }
  if (typeof document.content !== 'string' || !document.content.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(document.content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function versionOf(document: JourneyDocumentSnapshot) {
  return Number.isFinite(document.version) && Number(document.version) > 0
    ? Number(document.version)
    : 0;
}

function createdAtTimestamp(document: JourneyDocumentSnapshot) {
  const timestamp = Date.parse(document.created_at || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestDocument(documents: JourneyDocumentSnapshot[], type: string) {
  return documents
    .filter((document) => document.type === type)
    .sort((first, second) => {
      const versionDifference = versionOf(second) - versionOf(first);
      return versionDifference || createdAtTimestamp(second) - createdAtTimestamp(first);
    })[0] ?? null;
}

function sourceReference(document: JourneyDocumentSnapshot, fieldPath: string): SourceDocumentReference {
  return {
    documentId: document.id,
    documentType: document.type || '',
    version: versionOf(document),
    createdAt: document.created_at,
    fieldPath,
  };
}

function relationshipId(fromId: string, relationType: string, toId: string) {
  return `${fromId}:${relationType}:${toId}`;
}

function warning(
  code: ResearchObjectViewWarning['code'],
  documentId: string | null,
  message: string,
): ResearchObjectViewWarning {
  return { code, documentId, message };
}

export function createResearchObjectView(
  projectId: string,
  snapshots: JourneyDocumentSnapshot[],
): ResearchObjectView {
  const documents = snapshots.filter((document) => document.project_id === projectId);
  const objects: ResearchObjectView['objects'] = [];
  const relationships: ResearchObjectRelationship[] = [];
  const warnings: ResearchObjectViewWarning[] = [];

  const problemDocument = latestDocument(documents, PROBLEM_DOCUMENT_TYPE);
  let problem: ProblemObject | null = null;

  if (problemDocument) {
    const content = parseContent(problemDocument);
    if (!content) {
      warnings.push(warning(
        'invalid_document_content',
        problemDocument.id,
        'تعذر قراءة محتوى وثيقة المشكلة المحفوظة.',
      ));
    } else {
      const statement = text(content.problemStatement);
      const gapStatement = text(content.researchGap);

      if (!statement) {
        warnings.push(warning(
          'missing_problem_statement',
          problemDocument.id,
          'وثيقة المشكلة لا تحتوي صياغة مشكلة قابلة للقراءة.',
        ));
      } else {
        problem = {
          id: objectId(projectId, 'problem'),
          type: 'problem',
          projectId,
          content: {
            statement,
            derivedFromTitleId: null,
            researchable: null,
          },
          knowledgeType: 'general_unverified',
          knowledgeRationale: 'صياغة معتمدة في المشروع ولم تُفحص دلاليًا أو بأدلة خارجية في هذه الطبقة.',
          origin: 'unknown',
          status: 'accepted',
          consistencyStatus: 'not_checked',
          source: sourceReference(problemDocument, 'problemStatement'),
        };
        objects.push(problem);
      }

      if (gapStatement && problem) {
        const gap: GapObject = {
          id: objectId(projectId, 'gap'),
          type: 'gap',
          projectId,
          content: {
            statement: gapStatement,
            parentProblemId: problem.id,
            evidenceIds: [],
          },
          knowledgeType: 'inference',
          knowledgeRationale: 'الفجوة صياغة استدلالية محفوظة داخل وثيقة المشكلة ولم تُربط بأدلة مستقلة بعد.',
          origin: 'unknown',
          status: 'accepted',
          consistencyStatus: 'not_checked',
          source: sourceReference(problemDocument, 'researchGap'),
        };
        objects.push(gap);
        relationships.push({
          id: relationshipId(gap.id, 'derived_from', problem.id),
          fromId: gap.id,
          toId: problem.id,
          relationType: 'derived_from',
          status: 'unvalidated',
          derived: true,
          derivation: 'nested_source_field',
          knowledgeType: 'inference',
          consistencyStatus: 'not_checked',
        });
      } else if (gapStatement) {
        warnings.push(warning(
          'gap_without_problem',
          problemDocument.id,
          'لم تُنشأ الفجوة كعنصر مستقل لأن المشكلة الأصلية مفقودة.',
        ));
      }
    }
  }

  const objectivesDocument = latestDocument(documents, OBJECTIVES_DOCUMENT_TYPE);
  const objectiveObjects: ObjectiveObject[] = [];
  if (objectivesDocument) {
    const content = parseContent(objectivesDocument);
    if (!content) {
      warnings.push(warning(
        'invalid_document_content',
        objectivesDocument.id,
        'تعذر قراءة محتوى وثيقة الأهداف المحفوظة.',
      ));
    } else {
      const objectives = Array.isArray(content.objectives)
        ? content.objectives
          .slice(0, MAX_OBJECTIVES)
          .map((value, sourceIndex) => ({ statement: text(value), sourceIndex }))
          .filter((objective) => Boolean(objective.statement))
        : [];

      if (!objectives.length) {
        warnings.push(warning(
          'invalid_objectives',
          objectivesDocument.id,
          'وثيقة الأهداف لا تحتوي أهدافًا نصية قابلة للقراءة.',
        ));
      }

      for (const objectiveValue of objectives) {
        const { sourceIndex, statement } = objectiveValue;
        const objective: ObjectiveObject = {
          id: objectId(projectId, 'objective', sourceIndex),
          type: 'objective',
          projectId,
          content: {
            statement,
            orderIndex: sourceIndex,
            measurable: null,
          },
          knowledgeType: 'general_unverified',
          knowledgeRationale: 'هدف معتمد في المشروع ولم يُفحص اتساقه الدلالي مع المشكلة بعد.',
          origin: 'unknown',
          status: 'accepted',
          consistencyStatus: 'not_checked',
          source: sourceReference(objectivesDocument, `objectives[${sourceIndex}]`),
        };
        objects.push(objective);
        objectiveObjects.push(objective);

        if (problem) {
          relationships.push({
            id: relationshipId(objective.id, 'addresses', problem.id),
            fromId: objective.id,
            toId: problem.id,
            relationType: 'addresses',
            status: 'unvalidated',
            derived: true,
            derivation: 'same_project_sequence',
            knowledgeType: 'inference',
            consistencyStatus: 'not_checked',
          });
        }
      }

      if (objectives.length && !problem) {
        warnings.push(warning(
          'objectives_without_problem',
          objectivesDocument.id,
          'تمت قراءة الأهداف، لكن لم تُنشأ علاقات اتساق لعدم وجود مشكلة صالحة.',
        ));
      }
    }
  }

  const questionsDocument = latestDocument(documents, QUESTIONS_DOCUMENT_TYPE);
  const questionObjects: QuestionObject[] = [];
  if (questionsDocument) {
    const content = parseContent(questionsDocument);
    if (!content) {
      warnings.push(warning(
        'invalid_document_content',
        questionsDocument.id,
        'تعذر قراءة محتوى وثيقة أسئلة البحث المحفوظة.',
      ));
    } else {
      const questions = Array.isArray(content.questions)
        ? content.questions
          .slice(0, MAX_QUESTIONS)
          .map((value, sourceIndex) => ({ statement: text(value), sourceIndex }))
          .filter((question) => Boolean(question.statement))
        : [];

      if (!questions.length) {
        warnings.push(warning(
          'invalid_questions',
          questionsDocument.id,
          'وثيقة الأسئلة لا تحتوي أسئلة نصية قابلة للقراءة.',
        ));
      }

      for (const questionValue of questions) {
        const { sourceIndex, statement } = questionValue;
        const objective = objectiveObjects.find((item) => item.content.orderIndex === sourceIndex) ?? null;
        const question: QuestionObject = {
          id: objectId(projectId, 'question', sourceIndex),
          type: 'question',
          projectId,
          content: {
            statement,
            orderIndex: sourceIndex,
            objectiveId: objective?.id ?? null,
          },
          knowledgeType: 'general_unverified',
          knowledgeRationale: 'سؤال معتمد في المشروع ولم يُفحص اتساقه الدلالي مع الهدف المقابل بعد.',
          origin: 'unknown',
          status: 'accepted',
          consistencyStatus: 'not_checked',
          source: sourceReference(questionsDocument, `questions[${sourceIndex}]`),
        };
        objects.push(question);
        questionObjects.push(question);

        if (objective) {
          relationships.push({
            id: relationshipId(question.id, 'operationalizes', objective.id),
            fromId: question.id,
            toId: objective.id,
            relationType: 'operationalizes',
            status: 'unvalidated',
            derived: true,
            derivation: 'same_project_sequence',
            knowledgeType: 'inference',
            consistencyStatus: 'not_checked',
          });
        }
      }

      if (questions.length && !objectiveObjects.length) {
        warnings.push(warning(
          'questions_without_objectives',
          questionsDocument.id,
          'تمت قراءة الأسئلة، لكن لم تُنشأ علاقات اتساق لعدم وجود أهداف صالحة.',
        ));
      } else if (questions.length !== objectiveObjects.length) {
        warnings.push(warning(
          'question_objective_count_mismatch',
          questionsDocument.id,
          'عدد الأسئلة المحفوظة لا يطابق عدد الأهداف المعتمدة.',
        ));
      }
    }
  }

  const methodologyDocument = latestDocument(documents, METHODOLOGY_DOCUMENT_TYPE);
  if (methodologyDocument) {
    const content = parseContent(methodologyDocument);
    if (!content) {
      warnings.push(warning(
        'invalid_document_content',
        methodologyDocument.id,
        'تعذر قراءة محتوى وثيقة المنهجية المحفوظة.',
      ));
    } else {
      const approach = text(content.approach);
      const population = text(content.population);
      const sample = text(content.sample);
      const instrument = text(content.instrument);
      if (!approach || !population || !sample || !instrument) {
        warnings.push(warning(
          'invalid_methodology',
          methodologyDocument.id,
          'وثيقة المنهجية لا تحتوي المنهج والمجتمع والعينة والأداة بصورة مكتملة.',
        ));
      } else {
        const methodology: MethodologyObject = {
          id: objectId(projectId, 'methodology'),
          type: 'methodology',
          projectId,
          content: { approach, population, sample, instrument },
          knowledgeType: 'general_unverified',
          knowledgeRationale: 'منهجية معتمدة في المشروع ولم تُفحص ملاءمتها الدلالية لكل سؤال بعد.',
          origin: 'unknown',
          status: 'accepted',
          consistencyStatus: 'not_checked',
          source: sourceReference(methodologyDocument, '$'),
        };
        objects.push(methodology);
        for (const question of questionObjects) {
          relationships.push({
            id: relationshipId(methodology.id, 'designed_to_answer', question.id),
            fromId: methodology.id,
            toId: question.id,
            relationType: 'designed_to_answer',
            status: 'unvalidated',
            derived: true,
            derivation: 'same_project_sequence',
            knowledgeType: 'inference',
            consistencyStatus: 'not_checked',
          });
        }
        if (!questionObjects.length) {
          warnings.push(warning(
            'methodology_without_questions',
            methodologyDocument.id,
            'تمت قراءة المنهجية، لكن لم تُنشأ علاقات اتساق لعدم وجود أسئلة صالحة.',
          ));
        }
      }
    }
  }

  return {
    projectId,
    objects,
    relationships,
    validationResults: [],
    warnings,
  };
}
