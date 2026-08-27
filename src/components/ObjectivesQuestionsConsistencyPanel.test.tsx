import { renderToStaticMarkup } from 'react-dom/server';
import ObjectivesQuestionsConsistencyPanel from './ObjectivesQuestionsConsistencyPanel';
import type { ObjectivesQuestionsConsistencyReport } from '@/lib/research-objects/types';

const report: ObjectivesQuestionsConsistencyReport = {
  checkType: 'objective_question_consistency',
  formulaVersion: 'objective-question-consistency/v1',
  knowledgeType: 'inference',
  projectId: 'project-1',
  objectiveIds: ['objective-1'],
  questionIds: ['question-1'],
  overallScore: 72,
  coverageScore: 100,
  status: 'warning',
  summary: 'الأسئلة مرتبطة بالأهداف وتحتاج تحسينًا.',
  unmatchedObjectiveIds: [],
  duplicateQuestionPairs: [],
  results: [{
    id: 'validation-1', relationshipId: 'relationship-1', checkType: 'objective_question_consistency',
    score: 72, formulaVersion: 'objective-question-consistency/v1', knowledgeType: 'inference',
    rationale: 'المواءمة قابلة للتحسين.', gapsFound: ['السؤال لا يغطي المجتمع بوضوح.'],
    suggestedAction: 'أضف مجتمع الدراسة المذكور في الهدف.', evidenceUsed: ['objective-1', 'question-1'],
    status: 'warning', checkedAt: '2026-08-27T12:00:00.000Z', objectiveId: 'objective-1', questionId: 'question-1',
    dimensions: { alignment: 68, answerability: 100, specificity: 70 }, matchedConcepts: ['التحصيل'], missingObjectiveConcepts: ['الطلبة'],
  }],
  issues: ['تغطية السؤال للهدف تحتاج تحسينًا.'],
  checkedAt: '2026-08-27T12:00:00.000Z',
};

test('renders objective-question scores and corrective action', () => {
  const html = renderToStaticMarkup(<ObjectivesQuestionsConsistencyPanel status="ready" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('الأهداف ↔ الأسئلة');
  expect(html).toContain('72/100');
  expect(html).toContain('أضف مجتمع الدراسة المذكور في الهدف');
  expect(html).toContain('تقييم استدلالي مساعد');
});

test('marks the saved report stale after question editing', () => {
  const html = renderToStaticMarkup(<ObjectivesQuestionsConsistencyPanel status="stale" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('النسخة المحفوظة السابقة');
});
