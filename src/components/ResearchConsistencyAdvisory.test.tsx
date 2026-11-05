import { renderToStaticMarkup } from 'react-dom/server';
import ResearchConsistencyAdvisory from './ResearchConsistencyAdvisory';
import QuestionsHypothesesConsistencyPanel from './QuestionsHypothesesConsistencyPanel';
import type { QuestionsHypothesesConsistencyReport } from '@/lib/research-objects/types';

test.each(['passed', 'warning', 'failed'] as const)('hypothesis review does not display heuristic %s conclusions', (status) => {
  const report = { status, summary: 'استنتاج قطعي غير مبرر', overallScore: 93, coverageScore: 100, issues: ['مفاهيم غير مغطاة: تتسارع، مختلف، إلا، الأدلة، المتوفرة'] } as QuestionsHypothesesConsistencyReport;
  const html = renderToStaticMarkup(<QuestionsHypothesesConsistencyPanel status="ready" report={report} warnings={[]} error="" onRetry={() => undefined} />);
  expect(html).toContain('مراجعة أولية للعلاقات البحثية');
  expect(html).not.toMatch(/\/100|progressbar|استنتاج قطعي|تتسارع|مختلف|المتوفرة/);
  expect(html).toContain('هل يحتاج تصميم البحث إلى فرضيات');
});
test('advisory keeps error retry and structural warnings', () => {
  const html = renderToStaticMarkup(<ResearchConsistencyAdvisory status="error" hasReport={false} relationship="المشكلة ↔ الأهداف" prompts={[]} warnings={[]} error="تعذر قراءة السجل" onRetry={() => undefined} />);
  expect(html).toContain('role="alert"'); expect(html).toContain('إعادة المحاولة');
});
test('idle review is hidden and loading review is explicitly preliminary', () => {
  const props = { hasReport: false, relationship: 'الأهداف ↔ الأسئلة', prompts: [], warnings: [], error: '', onRetry: () => undefined };
  expect(renderToStaticMarkup(<ResearchConsistencyAdvisory {...props} status="idle" />)).toBe('');
  expect(renderToStaticMarkup(<ResearchConsistencyAdvisory {...props} status="loading" />)).toContain('وليست قياساً لجودة البحث');
});
