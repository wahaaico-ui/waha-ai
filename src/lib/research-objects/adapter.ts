import type {
  GapObject,
  HypothesisObject,
  JourneyDocumentSnapshot,
  MethodologyObject,
  ObjectiveObject,
  ProblemObject,
  QuestionObject,
  PopulationObject,
  SampleObject,
  VariableObject,
  ResearchObjectRelationship,
  ResearchObjectView,
  ResearchObjectViewWarning,
  SourceDocumentReference,
} from './types';

const PROBLEM_DOCUMENT_TYPE = 'journey:problem';
const OBJECTIVES_DOCUMENT_TYPE = 'journey:objectives';
const QUESTIONS_DOCUMENT_TYPE = 'journey:questions';
const HYPOTHESES_DOCUMENT_TYPE = 'journey:hypotheses';
const METHODOLOGY_DOCUMENT_TYPE = 'journey:methodology';
const STUDY_DESIGN_DOCUMENT_TYPE = 'journey:design';
const MAX_OBJECTIVES = 50;
const MAX_QUESTIONS = 50;

function objectId(projectId: string, type: 'problem' | 'gap' | 'objective' | 'question' | 'hypothesis' | 'methodology' | 'variable' | 'population' | 'sample', index?: number) {
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

  const hypothesesDocument = latestDocument(documents, HYPOTHESES_DOCUMENT_TYPE);
  if (hypothesesDocument) {
    const content = parseContent(hypothesesDocument);
    if (!content) {
      warnings.push(warning('invalid_document_content', hypothesesDocument.id, 'تعذر قراءة محتوى وثيقة الفرضيات المحفوظة.'));
    } else {
      const mode = content.mode === 'not_applicable' ? 'not_applicable' : 'required';
      const hypotheses = mode === 'required' && Array.isArray(content.hypotheses)
        ? content.hypotheses.slice(0, MAX_QUESTIONS).map((value, sourceIndex) => ({ statement: text(value), sourceIndex })).filter((item) => item.statement)
        : [];
      if (mode === 'required' && !hypotheses.length) {
        warnings.push(warning('invalid_hypotheses', hypothesesDocument.id, 'تم اختيار بناء فرضيات، لكن الوثيقة لا تحتوي فرضيات قابلة للقراءة.'));
      }
      for (const value of hypotheses) {
        const question = questionObjects.find((item) => item.content.orderIndex === value.sourceIndex) ?? null;
        const hypothesis: HypothesisObject = {
          id: objectId(projectId, 'hypothesis', value.sourceIndex),
          type: 'hypothesis',
          projectId,
          content: { statement: value.statement, orderIndex: value.sourceIndex, questionId: question?.id ?? null },
          knowledgeType: 'general_unverified',
          knowledgeRationale: 'فرضية معتمدة في المشروع ولم يُفحص اتساقها مع السؤال المقابل خارج هذه الطبقة.',
          origin: 'unknown',
          status: 'accepted',
          consistencyStatus: 'not_checked',
          source: sourceReference(hypothesesDocument, `hypotheses[${value.sourceIndex}]`),
        };
        objects.push(hypothesis);
        if (question) relationships.push({
          id: relationshipId(hypothesis.id, 'tests', question.id),
          fromId: hypothesis.id,
          toId: question.id,
          relationType: 'tests',
          status: 'unvalidated',
          derived: true,
          derivation: 'same_project_sequence',
          knowledgeType: 'inference',
          consistencyStatus: 'not_checked',
        });
      }
      if (mode === 'required' && hypotheses.length && !questionObjects.length) {
        warnings.push(warning('hypotheses_without_questions', hypothesesDocument.id, 'تمت قراءة الفرضيات، لكن لا توجد أسئلة صالحة لربطها بها.'));
      } else if (mode === 'required' && hypotheses.length !== questionObjects.length) {
        warnings.push(warning('hypothesis_question_count_mismatch', hypothesesDocument.id, 'عدد الفرضيات لا يطابق عدد الأسئلة المعتمدة.'));
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

  const designDocument = latestDocument(documents, STUDY_DESIGN_DOCUMENT_TYPE);
  if (designDocument) {
    const content = parseContent(designDocument);
    if (!content) {
      warnings.push(warning('invalid_document_content', designDocument.id, 'تعذر قراءة محتوى تصميم الدراسة المحفوظ.'));
    } else {
      const variables = Array.isArray(content.variables)
        ? content.variables.slice(0, 30).flatMap((item, index) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
          const value = item as Record<string, unknown>;
          const name = text(value.name);
          const operationalDefinition = text(value.operationalDefinition);
          if (!name || !operationalDefinition) return [];
          return [{ name, role: text(value.role), operationalDefinition, index }];
        }) : [];
      const populationValue = content.population && typeof content.population === 'object' && !Array.isArray(content.population) ? content.population as Record<string, unknown> : {};
      const sampleValue = content.sample && typeof content.sample === 'object' && !Array.isArray(content.sample) ? content.sample as Record<string, unknown> : {};
      const populationDescription = text(populationValue.description);
      const sampleStrategy = text(sampleValue.strategy);
      if (!variables.length || !populationDescription || !sampleStrategy) {
        warnings.push(warning('invalid_study_design', designDocument.id, 'تصميم الدراسة لا يحتوي متغيرات ومجتمعاً وعينة بصورة مكتملة.'));
      } else {
        for (const value of variables) {
          const variable: VariableObject = {
            id: objectId(projectId, 'variable', value.index), type: 'variable', projectId,
            content: { name: value.name, role: value.role, operationalDefinition: value.operationalDefinition },
            knowledgeType: 'general_unverified', knowledgeRationale: 'متغير أو مفهوم اعتمده الباحث ضمن تصميم الدراسة.',
            origin: 'unknown', status: 'accepted', consistencyStatus: 'not_checked',
            source: sourceReference(designDocument, `variables[${value.index}]`),
          };
          objects.push(variable);
          for (const hypothesis of objects.filter((item): item is HypothesisObject => item.type === 'hypothesis')) relationships.push({
            id: relationshipId(variable.id, 'operationalizes', hypothesis.id), fromId: variable.id, toId: hypothesis.id,
            relationType: 'operationalizes', status: 'unvalidated', derived: true, derivation: 'same_project_sequence', knowledgeType: 'inference', consistencyStatus: 'not_checked',
          });
        }
        const population: PopulationObject = {
          id: objectId(projectId, 'population'), type: 'population', projectId,
          content: { description: populationDescription, location: text(populationValue.location), timeframe: text(populationValue.timeframe) },
          knowledgeType: 'general_unverified', knowledgeRationale: 'مجتمع دراسة اعتمده الباحث ضمن التصميم.', origin: 'unknown', status: 'accepted', consistencyStatus: 'not_checked', source: sourceReference(designDocument, 'population'),
        };
        const sample: SampleObject = {
          id: objectId(projectId, 'sample'), type: 'sample', projectId,
          content: { strategy: sampleStrategy, inclusionCriteria: text(sampleValue.inclusionCriteria), sizeRationale: text(sampleValue.sizeRationale), populationId: population.id },
          knowledgeType: 'general_unverified', knowledgeRationale: 'عينة مقترحة اعتمدها الباحث ولم تُنفذ بعد.', origin: 'unknown', status: 'accepted', consistencyStatus: 'not_checked', source: sourceReference(designDocument, 'sample'),
        };
        objects.push(population, sample);
        relationships.push({ id: relationshipId(sample.id, 'samples_from', population.id), fromId: sample.id, toId: population.id, relationType: 'samples_from', status: 'unvalidated', derived: true, derivation: 'nested_source_field', knowledgeType: 'inference', consistencyStatus: 'not_checked' });
        if (!methodologyDocument) warnings.push(warning('study_design_without_methodology', designDocument.id, 'تمت قراءة تصميم الدراسة من دون منهجية محفوظة صالحة.'));
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
