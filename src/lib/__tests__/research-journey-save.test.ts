import { JourneyStageSaveError, saveJourneyDraft, saveJourneyStage } from '@/lib/research-journey';
import type { ProblemObjectivesConsistencyReport } from '@/lib/research-objects/types';

const failedReport = {
  checkType: 'problem_objective_consistency',
  formulaVersion: 'problem-objective-consistency/v1',
  knowledgeType: 'inference',
  projectId: 'project-1',
  problemId: 'problem-1',
  objectiveIds: ['objective-1'],
  overallScore: 20,
  coverageScore: 10,
  status: 'failed',
  summary: 'يوجد خلل جوهري في صلة الأهداف بالمشكلة.',
  uncoveredProblemConcepts: ['التحصيل'],
  duplicateObjectivePairs: [],
  results: [],
  issues: ['الهدف لا يعالج المشكلة.'],
  checkedAt: '2026-08-27T10:00:00.000Z',
} satisfies ProblemObjectivesConsistencyReport;

afterEach(() => {
  jest.restoreAllMocks();
});

test('preserves a rejected consistency report for the objectives UI', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    error: failedReport.summary,
    gate: {
      status: 'needs_improvement',
      stage: 'objectives',
      reason: failedReport.summary,
      nextStage: 'objectives',
    },
    consistency: failedReport,
    consistencyWarnings: [],
  }), {
    status: 422,
    headers: { 'Content-Type': 'application/json' },
  }));

  try {
    await saveJourneyStage('project-1', 'objectives', { objectives: ['هدف أول', 'هدف ثان'] });
    throw new Error('Expected saveJourneyStage to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(JourneyStageSaveError);
    const saveError = error as JourneyStageSaveError;
    expect(saveError.message).toBe(failedReport.summary);
    expect(saveError.consistency).toEqual(failedReport);
  }
});

test('sends autosave drafts through PATCH without caching', async () => {
  const savedAt = '2026-09-19T18:00:01.000Z';
  const clientUpdatedAt = '2026-09-19T18:00:00.000Z';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    success: true,
    stage: 'problem',
    draft: { content: { problemStatement: 'مسودة' }, clientUpdatedAt, savedAt },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const result = await saveJourneyDraft('project/1', 'problem', { problemStatement: 'مسودة' }, clientUpdatedAt, true);

  expect(result.success).toBe(true);
  expect(fetchMock).toHaveBeenCalledWith('/api/projects/project%2F1/journey', expect.objectContaining({
    method: 'PATCH',
    cache: 'no-store',
    keepalive: true,
    body: JSON.stringify({ stage: 'problem', content: { problemStatement: 'مسودة' }, clientUpdatedAt }),
  }));
});

test('returns the newer server draft when autosave detects a conflict', async () => {
  const serverDraft = {
    content: { problemStatement: 'الأحدث' },
    clientUpdatedAt: '2026-09-19T18:05:00.000Z',
    savedAt: '2026-09-19T18:05:01.000Z',
  };
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    error: 'A newer draft is already saved',
    draft: serverDraft,
  }), { status: 409, headers: { 'Content-Type': 'application/json' } }));

  await expect(saveJourneyDraft(
    'project-1',
    'problem',
    { problemStatement: 'الأقدم' },
    '2026-09-19T18:00:00.000Z',
  )).resolves.toEqual({ error: 'A newer draft is already saved', draft: serverDraft });
});

test('turns an expired autosave session into a clear Arabic error', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  }));

  await expect(saveJourneyDraft('project-1', 'problem', { problemStatement: 'مسودة' }))
    .rejects.toThrow('انتهت جلسة الدخول');
});
