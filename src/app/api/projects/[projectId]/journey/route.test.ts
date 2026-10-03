const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

// Server-owned journey documents are written with the server client. The mock
// delegates to the test's Supabase double so existing call sequences hold, and
// records that the write went through the server client.
const serviceFrom = jest.fn();
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (...args: unknown[]) => serviceFrom(...args) }),
}));

import { GET, PATCH, POST } from './route';
import { buildProblemDraftFallback } from '@/lib/research-draft-fallback';

const context = { params: Promise.resolve({ projectId: 'project-owned-by-b' }) };
const accessForA = {
  user: { id: 'user-a', email: 'a@example.test', user_metadata: {} },
  supabase: { from: jest.fn(), rpc: jest.fn() },
};

describe('project journey authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceFrom.mockImplementation((...args: unknown[]) => accessForA.supabase.from(...args));
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

  test('POST accepts structurally valid objectives despite failed lexical overlap', async () => {
    const documents = journeyDocuments();
    const readQuery = createJourneyReadQuery(documents);
    const inserts = allowStageWrites(readQuery);
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

    expect(response.status).toBe(200);
    expect(body.gate.status).toBe('open');
    expect(body.consistency.status).toBe('failed');
    expect(body.consistency.checkType).toBe('problem_objective_consistency');
    expect(inserts).toHaveBeenCalledTimes(2);
    expect(JSON.parse(inserts.mock.calls[1][0].content).consistency.advisory).toBe(true);
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
    expect(accessForA.supabase.from).toHaveBeenCalledTimes(2);
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

  test('PATCH saves an owned stage draft without evaluating the quality gate', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{
        content: { objectives: ['مسودة قصيرة'] },
        client_updated_at: '2026-09-19T10:00:00.000Z',
        updated_at: '2026-09-19T10:00:01.000Z',
      }],
      error: null,
    });
    accessForA.supabase.rpc = rpc;
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);

    const response = await PATCH(new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'objectives',
        content: { objectives: ['مسودة قصيرة'] },
        clientUpdatedAt: '2026-09-19T10:00:00.000Z',
      }),
    }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.draft.content.objectives).toEqual(['مسودة قصيرة']);
    expect(rpc).toHaveBeenCalledWith('save_research_stage_draft', {
      p_project_id: 'project-owned-by-b',
      p_stage: 'objectives',
      p_content: { objectives: ['مسودة قصيرة'] },
      p_client_updated_at: '2026-09-19T10:00:00.000Z',
    });
  });

  test('PATCH rejects an invalid client timestamp before writing', async () => {
    const rpc = jest.fn();
    accessForA.supabase.rpc = rpc;
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(true);

    const response = await PATCH(new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'problem', content: { problemStatement: 'مسودة' }, clientUpdatedAt: 'not-a-date' }),
    }), context);

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
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

  test('POST accepts structurally valid questions despite failed lexical overlap', async () => {
    const documents = journeyDocuments({ includeObjectives: true });
    const readQuery = createJourneyReadQuery(documents);
    const inserts = allowStageWrites(readQuery);
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

    expect(response.status).toBe(200);
    expect(body.consistency.checkType).toBe('objective_question_consistency');
    expect(body.consistency.status).toBe('failed');
    expect(inserts).toHaveBeenCalledTimes(2);
    expect(JSON.parse(inserts.mock.calls[1][0].content).consistency.advisory).toBe(true);
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

  test('POST accepts structurally valid hypotheses despite failed lexical overlap', async () => {
    const documents = journeyDocuments({ includeObjectives: true, includeQuestions: true });
    const readQuery = createJourneyReadQuery(documents);
    const inserts = allowStageWrites(readQuery);
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

    expect(response.status).toBe(200);
    expect(body.consistency.checkType).toBe('question_hypothesis_consistency');
    expect(body.consistency.status).toBe('failed');
    expect(inserts).toHaveBeenCalledTimes(2);
    expect(JSON.parse(inserts.mock.calls[1][0].content).consistency.advisory).toBe(true);
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

  test('POST accepts structurally valid methodology despite failed lexical overlap', async () => {
    const documents = journeyDocuments({ includeObjectives: true, includeQuestions: true, qualitativeQuestions: true, includeHypotheses: true, hypothesesNotApplicable: true });
    const readQuery = createJourneyReadQuery(documents);
    const inserts = allowStageWrites(readQuery);
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

    expect(response.status).toBe(200);
    expect(body.consistency.checkType).toBe('question_methodology_consistency');
    expect(body.consistency.status).toBe('failed');
    expect(inserts).toHaveBeenCalledTimes(2);
    expect(JSON.parse(inserts.mock.calls[1][0].content).consistency.advisory).toBe(true);
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

function allowStageWrites(readQuery: ReturnType<typeof createJourneyReadQuery>) {
  const inserts = jest.fn().mockResolvedValue({ error: null });
  const update = { update: jest.fn(), eq: jest.fn() };
  update.update.mockReturnValue(update);
  update.eq.mockReturnValueOnce(update).mockResolvedValueOnce({ error: null });
  let reads = 0;
  accessForA.supabase.from.mockImplementation((table: string) => {
    if (table === 'documents') return ++reads === 1 ? readQuery : { insert: inserts };
    return update;
  });
  return inserts;
}

test.each(['objectives', 'questions', 'hypotheses', 'methodology'])('invalid %s structure remains rejected', async (stage) => {
  jest.clearAllMocks();
  const inserts = allowStageWrites(createJourneyReadQuery(journeyDocuments({ includeObjectives: true, includeQuestions: true, includeHypotheses: true })));
  serviceFrom.mockImplementation((...args: unknown[]) => accessForA.supabase.from(...args));
  requireAuthenticatedUser.mockResolvedValue(accessForA);
  ownsProject.mockResolvedValue(true);
  const response = await POST(new Request('https://waha.test/api/projects/p/journey', { method: 'POST', body: JSON.stringify({ stage, content: {} }) }), context);
  expect(response.status).toBe(422);
  expect(inserts).not.toHaveBeenCalled();
});
