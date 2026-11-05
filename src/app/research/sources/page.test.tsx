jest.mock('@/components/SiteHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/lib/use-project-id', () => ({ useProjectId: jest.fn() }));

import { renderToStaticMarkup } from 'react-dom/server';
import ResearchSourcesPage from './page';
import { useProjectId } from '@/lib/use-project-id';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('discovery is project scoped and links to the library and writing workspace', () => {
  (useProjectId as jest.Mock).mockReturnValue('project-a');
  const html = renderToStaticMarkup(<ResearchSourcesPage />);
  expect(html).toContain('البحث عن المصادر والاستشهادات');
  expect(html).toContain('/research/library?projectId=project-a');
  expect(html).toContain('/research/tasks?projectId=project-a&amp;task=writing');
  expect(html).toContain('dir="rtl"');
  expect(html).toContain('sm:px-6');
  expect(html).not.toContain('اقترح مسودة من مشروعي');
});

test('without a project there is no discovery form or unscoped search', () => {
  (useProjectId as jest.Mock).mockReturnValue('');
  const html = renderToStaticMarkup(<ResearchSourcesPage />);
  expect(html).toContain('اختيار المشروع');
  expect(html).not.toContain('<textarea');
  expect(html).not.toContain('مساعد الأدلة والاستشهادات');
});

test('the page reuses discovery, with project changes resetting its result selection', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/research/sources/page.tsx'), 'utf8');
  expect(source).toContain('<ResearchEvidenceSidebar key={projectId} projectId={projectId} />');
  expect(source).not.toMatch(/fetch\(|\/api\//);
  const sidebar = readFileSync(join(process.cwd(), 'src/components/ResearchEvidenceSidebar.tsx'), 'utf8');
  expect(sidebar).toContain('query: requestedQuery');
  expect(sidebar).toContain('projectId');
  expect(sidebar).toContain('نتائج إضافية من OpenAlex');
  expect(sidebar).toContain('JSON.stringify({ projectId, resultId: paper.resultId })');
  expect(sidebar).toContain('JSON.stringify({ projectId, resultId: paper.resultId, style, context: query.trim() })');
});
