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

test('renders question-methodology dimensions and corrective action', () => {
  const html = renderToStaticMarkup(<QuestionsMethodologyConsistencyPanel status="ready" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('الأسئلة ↔ المنهجية');
  expect(html).toContain('66/100');
  expect(html).toContain('ملاءمة الأداة');
  expect(html).toContain('حدّد مجتمع الدراسة المذكور في السؤال');
  expect(html).toContain('فحص استدلالي مساعد');
});

test('marks the saved report stale after methodology editing', () => {
  const html = renderToStaticMarkup(<QuestionsMethodologyConsistencyPanel status="stale" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('النسخة المحفوظة السابقة');
});
