import { renderToStaticMarkup } from 'react-dom/server';
import ProblemObjectivesConsistencyPanel from './ProblemObjectivesConsistencyPanel';
import type { ProblemObjectivesConsistencyReport } from '@/lib/research-objects/types';

const report: ProblemObjectivesConsistencyReport = {
  checkType: 'problem_objective_consistency',
  formulaVersion: 'problem-objective-consistency/v1',
  knowledgeType: 'inference',
  projectId: 'project-1',
  problemId: 'problem-1',
  objectiveIds: ['objective-1'],
  overallScore: 76,
  coverageScore: 70,
  status: 'warning',
  summary: 'العلاقة تحتاج تحسينًا قبل الاعتماد النهائي.',
  uncoveredProblemConcepts: ['الدافعية'],
  duplicateObjectivePairs: [],
  results: [{
    id: 'validation-1',
    relationshipId: 'relationship-1',
    checkType: 'problem_objective_consistency',
    score: 76,
    formulaVersion: 'problem-objective-consistency/v1',
    knowledgeType: 'inference',
    rationale: 'صلة الهدف بالمشكلة قابلة للتحسين.',
    gapsFound: ['لم يغط الهدف مفهوم الدافعية.'],
    suggestedAction: 'أضف البعد المرتبط بالدافعية إلى هدف مستقل.',
    evidenceUsed: ['problem-1', 'objective-1'],
    status: 'warning',
    checkedAt: '2026-08-27T10:00:00.000Z',
    objectiveId: 'objective-1',
    problemId: 'problem-1',
    dimensions: { relevance: 80, measurability: 100, specificity: 65 },
    matchedConcepts: ['المشاركة'],
    uncoveredConcepts: ['الدافعية'],
  }],
  issues: ['مفهوم الدافعية غير مغطى بوضوح.'],
  checkedAt: '2026-08-27T10:00:00.000Z',
};

test('shows an advisory review without heuristic conclusions or numerical precision', () => {
  const html = renderToStaticMarkup(<ProblemObjectivesConsistencyPanel status="ready" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('المشكلة ↔ الأهداف');
  expect(html).toContain('مراجعة أولية للعلاقات البحثية');
  expect(html).toContain('هذه مراجعة آلية أولية، وليست قياساً لجودة البحث أو إثباتاً لصلاحية تصميمه.');
  expect(html).not.toContain('/100');
  expect(html).not.toContain('progressbar');
  expect(html).not.toContain(report.summary);
  for (const issue of report.issues) expect(html).not.toContain(issue);
  for (const result of report.results) {
    expect(html).not.toContain(result.suggestedAction);
    for (const gap of result.gapsFound) expect(html).not.toContain(gap);
  }
});

test('marks a report as stale after the researcher edits objectives', () => {
  const html = renderToStaticMarkup(
    <ProblemObjectivesConsistencyPanel
      status="stale"
      report={report}
      warnings={[]}
      error=""
      onRetry={() => undefined}
    />,
  );

  expect(html).toContain('النسخة المحفوظة السابقة');
  expect(html).toContain('احفظ التعديلات لتحديثها');
});
