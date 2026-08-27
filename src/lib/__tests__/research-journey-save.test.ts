import { JourneyStageSaveError, saveJourneyStage } from '@/lib/research-journey';
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
