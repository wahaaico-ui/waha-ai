import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ResearchWorkspaceLinks from './ResearchWorkspaceLinks';
import ResearchDraftAssistant from './ResearchDraftAssistant';

test('context links preserve and encode the project, with keyboard-accessible anchors', () => {
  const html = renderToStaticMarkup(<ResearchWorkspaceLinks projectId="project & other" />);
  expect(html).toContain('/research/sources?projectId=project%20%26%20other');
  expect(html).toContain('/research/language-tools?projectId=project%20%26%20other');
  expect(html).toContain('البحث عن مصادر');
  expect(html).toContain('مراجعة اللغة');
  expect(html).toContain('dir="rtl"');
  expect(html).toContain('flex-wrap');
  expect(html).toContain('focus-visible:');
  expect(renderToStaticMarkup(<ResearchWorkspaceLinks projectId="" />)).toBe('');
});

test.each(['objectives', 'questions', 'methodology'] as const)('%s retains drafting without embedded tool forms', (stage) => {
  const html = renderToStaticMarkup(<ResearchDraftAssistant projectId="project-a" stage={stage} showTools={false} onDraft={() => undefined} />);
  expect(html).toContain('اقترح مسودة من مشروعي');
  expect(html).not.toContain('مساعد الأدلة والاستشهادات');
  expect(html).not.toMatch(/<textarea|<select/);
  const source = readFileSync(join(process.cwd(), `src/app/research/${stage}/page.tsx`), 'utf8');
  expect(source).toContain(`stage="${stage}" showTools={false}`);
  expect(source).toContain('<ResearchWorkspaceLinks projectId={projectId} />');
  expect(source).toContain('saveJourneyStage');
  expect(source).toContain('ConsistencyPanel');
  expect(source).toContain('useJourneyAutosave');
});
