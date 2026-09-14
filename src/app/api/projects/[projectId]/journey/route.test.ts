const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

import { GET, POST } from './route';
import { buildProblemDraftFallback } from '@/lib/research-draft-fallback';

const context = { params: Promise.resolve({ projectId: 'project-owned-by-b' }) };
const accessForA = {
  user: { id: 'user-a', email: 'a@example.test', user_metadata: {} },
  supabase: { from: jest.fn() },
};

describe('project journey authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET returns 401 without an authenticated Supabase user', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(new Request('https://waha.test/api/projects/project-owned-by-b/journey'), context);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('x-waha-request-id')).toBe(body.requestId);
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('GET returns 404 before reading another user project', async () => {
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(false);

    const response = await GET(new Request('https://waha.test/api/projects/project-owned-by-b/journey'), context);

    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith('project-owned-by-b', 'user-a', accessForA.supabase);
    expect(accessForA.supabase.from).not.toHaveBeenCalled();
  });

  test('POST returns 401 before parsing the body when unauthenticated', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'verify', content: {} }),
    });

    const response = await POST(request, context);

    expect(response.status).toBe(401);
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('POST returns 404 before modifying another user project', async () => {
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(false);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'verify', content: { decision: 'proceed' } }),
    });

    const response = await POST(request, context);

    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith('project-owned-by-b', 'user-a', accessForA.supabase);
    expect(accessForA.supabase.from).not.toHaveBeenCalled();
  });

  test('POST rejects structurally valid objectives that are inconsistent with the saved problem', async () => {
    const documents = journeyDocuments();
    const readQuery = createJourneyReadQuery(documents);
    accessForA.supabase.from.mockReturnValue(readQuery);
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'objectives',
        content: {
          objectives: [
            'تحليل أسعار الطاقة المتجددة في الأسواق الأوروبية خلال العقد الأخير.',
            'قياس نمو الصادرات الزراعية في دول أمريكا الجنوبية خلال السنوات الماضية.',
          ],
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.gate.status).toBe('needs_improvement');
    expect(body.consistency.status).toBe('failed');
    expect(body.consistency.checkType).toBe('problem_objective_consistency');
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('POST refuses unchanged problem guidance before any database write', async () => {
    const documents = journeyDocuments().filter(document => document.type !== 'journey:problem');
    accessForA.supabase.from.mockReturnValue(createJourneyReadQuery(documents));
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const draft = buildProblemDraftFallback({ title: JSON.parse(documents[1].content) });
    const response = await POST(new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'problem', content: { ...draft, requireResearcherNote: false, researcherNote: 'أهتم بتحسين التعلم الإلكتروني لدى طلبة التمريض في الجامعة.' } }),
    }), context);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain('إرشادي');
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('GET preserves stored guidance but returns the researcher to the problem stage', async () => {
    const documents = journeyDocuments();
    const draft = buildProblemDraftFallback({ title: JSON.parse(documents[1].content) });
    documents[2].content = JSON.stringify({ ...draft, researcherNote: 'أهتم بتحسين التعلم الإلكتروني لدى طلبة التمريض في الجامعة.' });
    const before = JSON.stringify(documents);
    accessForA.supabase.from.mockReturnValue(createJourneyReadQuery(documents));
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const response = await GET(new Request('https://waha.test/api/projects/project-owned-by-b/journey'), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.nextStage).toBe('problem');
    expect(body.outputs.problem.researchGap).toBe(draft?.researchGap);
    expect(JSON.stringify(documents)).toBe(before);
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('POST cannot bypass unfinished saved guidance by requesting objectives directly', async () => {
    const documents = journeyDocuments();
    const draft = buildProblemDraftFallback({ title: JSON.parse(documents[1].content) });
    documents[2].content = JSON.stringify({ ...draft, researcherNote: 'أهتم بتحسين التعلم الإلكتروني لدى طلبة التمريض في الجامعة.' });
    accessForA.supabase.from.mockReturnValue(createJourneyReadQuery(documents));
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const response = await POST(new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'objectives', content: { objectives: [
        'قياس أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية.',
        'تحليل دافعية طلبة التمريض نحو التعلم الإلكتروني في الجامعات المحلية.',
      ] } }),
    }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).gate.nextStage).toBe('problem');
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('POST saves objectives with a consistency warning and records the decision summary', async () => {
    const documents = journeyDocuments({
      problemStatement: 'يحتاج أثر المنصات الرقمية على التحصيل والدافعية والاندماج الأكاديمي لدى الطلبة في الجامعات الريفية إلى فحص منهجي.',
    });
    const readQuery = createJourneyReadQuery(documents);
    const stageInsert = jest.fn().mockResolvedValue({ error: null });
    const decisionInsert = jest.fn().mockResolvedValue({ error: null });
    const updateQuery = { update: jest.fn(), eq: jest.fn() };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValueOnce(updateQuery).mockResolvedValueOnce({ error: null });
    let documentCall = 0;
    accessForA.supabase.from.mockImplementation((table: string) => {
      if (table === 'documents') {
        documentCall += 1;
        if (documentCall === 1) return readQuery;
        if (documentCall === 2) return { insert: stageInsert };
        return { insert: decisionInsert };
      }
      return updateQuery;
    });
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'objectives',
        content: {
          objectives: [
            'قياس أثر المنصات الرقمية على التحصيل لدى الطلبة في الجامعات الريفية.',
            'تحليل أثر المنصات الرقمية على التحصيل الأكاديمي لدى الطلبة في الجامعات الريفية.',
          ],
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.consistency.status).toBe('warning');
    expect(stageInsert).toHaveBeenCalledTimes(1);
    expect(decisionInsert).toHaveBeenCalledTimes(1);
    const decision = JSON.parse(decisionInsert.mock.calls[0][0].content);
    expect(decision.consistency.status).toBe('warning');
    expect(decision.consistency.formulaVersion).toBe('problem-objective-consistency/v1');
  });

  test('POST blocks inconsistent questions before inserting any document', async () => {
    const documents = journeyDocuments({ includeObjectives: true });
    const readQuery = createJourneyReadQuery(documents);
    accessForA.supabase.from.mockReturnValue(readQuery);
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'questions',
        content: {
          questions: [
            'ما أثر أسعار الطاقة المتجددة على الصادرات الزراعية في أوروبا؟',
            'كيف تؤثر السياحة الدولية في أسعار العقارات داخل المدن الساحلية؟',
          ],
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.consistency.checkType).toBe('objective_question_consistency');
    expect(body.consistency.status).toBe('failed');
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('POST saves questions with a warning and records the objective-question formula', async () => {
    const documents = journeyDocuments({ includeObjectives: true, similarObjectives: true });
    const readQuery = createJourneyReadQuery(documents);
    const stageInsert = jest.fn().mockResolvedValue({ error: null });
    const decisionInsert = jest.fn().mockResolvedValue({ error: null });
    const updateQuery = { update: jest.fn(), eq: jest.fn() };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValueOnce(updateQuery).mockResolvedValueOnce({ error: null });
    let documentCall = 0;
    accessForA.supabase.from.mockImplementation((table: string) => {
      if (table === 'documents') {
        documentCall += 1;
        if (documentCall === 1) return readQuery;
        if (documentCall === 2) return { insert: stageInsert };
        return { insert: decisionInsert };
      }
      return updateQuery;
    });
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const duplicateQuestion = 'ما أثر المنصات الذكية على التحصيل الأكاديمي لدى طلبة التمريض؟';
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'questions',
        content: { questions: [duplicateQuestion, duplicateQuestion] },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.consistency.status).toBe('warning');
    expect(stageInsert).toHaveBeenCalledTimes(1);
    const decision = JSON.parse(decisionInsert.mock.calls[0][0].content);
    expect(decision.consistency.checkType).toBe('objective_question_consistency');
    expect(decision.consistency.formulaVersion).toBe('objective-question-consistency/v1');
  });

  test('POST blocks hypotheses that do not test the saved questions', async () => {
    const documents = journeyDocuments({ includeObjectives: true, includeQuestions: true });
    const readQuery = createJourneyReadQuery(documents);
    accessForA.supabase.from.mockReturnValue(readQuery);
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'hypotheses',
        content: {
          mode: 'required',
          hypotheses: [
            'توجد علاقة بين أسعار العقارات وحركة السياحة الساحلية في المدن الأوروبية.',
            'يوجد أثر للمناخ على صادرات المحاصيل الزراعية في دول أمريكا الجنوبية.',
          ],
          rationale: '',
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.consistency.checkType).toBe('question_hypothesis_consistency');
    expect(body.consistency.status).toBe('failed');
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('POST saves aligned hypotheses and records their consistency formula', async () => {
    const documents = journeyDocuments({ includeObjectives: true, includeQuestions: true });
    const readQuery = createJourneyReadQuery(documents);
    const stageInsert = jest.fn().mockResolvedValue({ error: null });
    const decisionInsert = jest.fn().mockResolvedValue({ error: null });
    const updateQuery = { update: jest.fn(), eq: jest.fn() };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValueOnce(updateQuery).mockResolvedValueOnce({ error: null });
    let documentCall = 0;
    accessForA.supabase.from.mockImplementation((table: string) => {
      if (table === 'documents') {
        documentCall += 1;
        if (documentCall === 1) return readQuery;
        if (documentCall === 2) return { insert: stageInsert };
        return { insert: decisionInsert };
      }
      return updateQuery;
    });
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'hypotheses',
        content: {
          mode: 'required',
          hypotheses: [
            'يوجد أثر للتعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية.',
            'توجد علاقة بين التعلم الإلكتروني ودافعية طلبة التمريض في الجامعات المحلية.',
          ],
          rationale: '',
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.consistency.status).toBe('passed');
    expect(stageInsert).toHaveBeenCalledTimes(1);
    const decision = JSON.parse(decisionInsert.mock.calls[0][0].content);
    expect(decision.consistency.formulaVersion).toBe('question-hypothesis-consistency/v1');
  });

  test('POST blocks a methodology that cannot answer the saved questions before inserting', async () => {
    const documents = journeyDocuments({ includeObjectives: true, includeQuestions: true, qualitativeQuestions: true, includeHypotheses: true, hypothesesNotApplicable: true });
    const readQuery = createJourneyReadQuery(documents);
    accessForA.supabase.from.mockReturnValue(readQuery);
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'methodology',
        content: {
          approach: 'quantitative',
          population: 'طلبة التمريض في الجامعات المحلية من مستخدمي منصات التعلم الإلكتروني.',
          sample: 'عينة طبقية عشوائية من طلبة التمريض وفق الجامعة والمستوى الدراسي.',
          instrument: 'استبانة محكمة ومقياس كمي للتحصيل الأكاديمي والدافعية.',
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.consistency.checkType).toBe('question_methodology_consistency');
    expect(body.consistency.status).toBe('failed');
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(1);
  });

  test('POST saves a methodology warning and records the question-methodology formula', async () => {
    const documents = journeyDocuments({ includeObjectives: true, includeQuestions: true, includeHypotheses: true });
    const readQuery = createJourneyReadQuery(documents);
    const stageInsert = jest.fn().mockResolvedValue({ error: null });
    const decisionInsert = jest.fn().mockResolvedValue({ error: null });
    const updateQuery = { update: jest.fn(), eq: jest.fn() };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValueOnce(updateQuery).mockResolvedValueOnce({ error: null });
    let documentCall = 0;
    accessForA.supabase.from.mockImplementation((table: string) => {
      if (table === 'documents') {
        documentCall += 1;
        if (documentCall === 1) return readQuery;
        if (documentCall === 2) return { insert: stageInsert };
        return { insert: decisionInsert };
      }
      return updateQuery;
    });
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'methodology',
        content: {
          approach: 'quantitative',
          population: 'طلاب كليات صحية في عدد من مؤسسات التعليم الجامعي المحلية.',
          sample: 'تشمل الدراسة مجموعة من المشاركين خلال الفصل الدراسي الجامعي الحالي.',
          instrument: 'استبانة محكمة ومقياس كمي للتحصيل الأكاديمي والدافعية.',
        },
      }),
    });

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.consistency.status).toBe('warning');
    expect(stageInsert).toHaveBeenCalledTimes(1);
    const decision = JSON.parse(decisionInsert.mock.calls[0][0].content);
    expect(decision.consistency.checkType).toBe('question_methodology_consistency');
    expect(decision.consistency.formulaVersion).toBe('question-methodology-consistency/v1');
  });
});

function createJourneyReadQuery(documents: Array<Record<string, unknown>>) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    like: jest.fn(),
    order: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.like.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: documents, error: null });
  return query;
}

function journeyDocuments(options: {
  problemStatement?: string;
  includeObjectives?: boolean;
  similarObjectives?: boolean;
  includeQuestions?: boolean;
  qualitativeQuestions?: boolean;
  includeHypotheses?: boolean;
  hypothesesNotApplicable?: boolean;
} = {}) {
  const base = {
    project_id: 'project-owned-by-b',
    version: 1,
    created_at: '2026-08-27T10:00:00.000Z',
  };
  return [
    {
      ...base,
      id: 'verify-1',
      type: 'journey:verify',
      content: JSON.stringify({
        decision: 'proceed',
        searchCoverage: { uniqueStudies: 3 },
        researchPaths: [{ id: 'path-1' }, { id: 'path-2' }, { id: 'path-3' }],
        selectedResearchPath: { id: 'path-1' },
      }),
    },
    {
      ...base,
      id: 'title-1',
      type: 'journey:title',
      content: JSON.stringify({ title: 'أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية' }),
    },
    {
      ...base,
      id: 'problem-1',
      type: 'journey:problem',
      content: JSON.stringify({
        problemStatement: options.problemStatement || 'ينبغي فحص أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية بصورة منهجية واضحة.',
        researchGap: 'توجد حاجة إلى أدلة ميدانية حول تحصيل طلبة التمريض في الجامعات المحلية.',
        researcherNote: 'اخترت المشكلة لأهميتها في تحسين تعليم طلبة التمريض محلياً.',
      }),
    },
    ...(options.includeObjectives ? [{
      ...base,
      id: 'objectives-1',
      type: 'journey:objectives',
      content: JSON.stringify({
        objectives: options.similarObjectives ? [
          'قياس أثر المنصات الذكية على التحصيل الأكاديمي لدى طلبة التمريض.',
          'تحليل أثر المنصات الذكية على التحصيل الأكاديمي لدى طلبة التمريض.',
        ] : [
          'قياس أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية.',
          'تحليل دافعية طلبة التمريض نحو التعلم الإلكتروني في الجامعات المحلية.',
        ],
      }),
    }] : []),
    ...(options.includeQuestions ? [{
      ...base,
      id: 'questions-1',
      type: 'journey:questions',
      content: JSON.stringify({
        questions: options.qualitativeQuestions ? [
          'كيف يصف طلبة التمريض خبراتهم مع منصات التعلم الإلكتروني في الجامعات المحلية؟',
          'لماذا تتباين تصورات طلبة التمريض حول دافعية التعلم الإلكتروني في الجامعات المحلية؟',
        ] : [
          'ما أثر التعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية؟',
          'ما العلاقة بين التعلم الإلكتروني ودافعية طلبة التمريض في الجامعات المحلية؟',
        ],
      }),
    }] : []),
    ...(options.includeHypotheses ? [{
      ...base,
      id: 'hypotheses-1',
      type: 'journey:hypotheses',
      content: JSON.stringify(options.hypothesesNotApplicable ? {
        mode: 'not_applicable',
        hypotheses: [],
        rationale: 'الدراسة نوعية استكشافية وتركز على فهم الخبرات والتصورات دون اختبار علاقات كمية مسبقة.',
      } : {
        mode: 'required',
        hypotheses: [
          'يوجد أثر للتعلم الإلكتروني على تحصيل طلبة التمريض في الجامعات المحلية.',
          'توجد علاقة بين التعلم الإلكتروني ودافعية طلبة التمريض في الجامعات المحلية.',
        ],
        rationale: '',
      }),
    }] : []),
  ];
}
