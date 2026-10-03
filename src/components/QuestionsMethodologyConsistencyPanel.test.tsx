import { renderToStaticMarkup } from 'react-dom/server';
import QuestionsMethodologyConsistencyPanel from './QuestionsMethodologyConsistencyPanel';
import type { QuestionsMethodologyConsistencyReport } from '@/lib/research-objects/types';

const report: QuestionsMethodologyConsistencyReport = {
  checkType: 'question_methodology_consistency',
  formulaVersion: 'question-methodology-consistency/v1',
  knowledgeType: 'inference',
  projectId: 'project-1',
  questionIds: ['question-1'],
  methodologyId: 'methodology-1',
  overallScore: 66,
  coverageScore: 100,
  status: 'warning',
  summary: 'التصميم مرتبط بالسؤال ويحتاج تحسينًا.',
  results: [{
    id: 'validation-1', relationshipId: 'relationship-1', checkType: 'question_methodology_consistency',
    score: 66, formulaVersion: 'question-methodology-consistency/v1', knowledgeType: 'inference',
    rationale: 'المجتمع يحتاج تحديدًا.', gapsFound: ['مجتمع الدراسة لا يعكس السؤال بوضوح.'],
    suggestedAction: 'حدّد مجتمع الدراسة المذكور في السؤال.', evidenceUsed: ['question-1', 'methodology-1'],
    status: 'warning', checkedAt: '2026-08-27T12:00:00.000Z', questionId: 'question-1', methodologyId: 'methodology-1',
    inferredQuestionMode: 'quantitative', dimensions: { approachFit: 100, populationAlignment: 35, instrumentFit: 100, sampleClarity: 65 }, matchedPopulationConcepts: [],
  }],
  issues: ['ارتباط المجتمع بالسؤال غير واضح.'],
  checkedAt: '2026-08-27T12:00:00.000Z',
};

test('shows an advisory review without heuristic conclusions or numerical precision', () => {
  const html = renderToStaticMarkup(<QuestionsMethodologyConsistencyPanel status="ready" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('الأسئلة ↔ المنهجية');
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

test('marks the saved report stale after methodology editing', () => {
  const html = renderToStaticMarkup(<QuestionsMethodologyConsistencyPanel status="stale" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('النسخة المحفوظة السابقة');
});
