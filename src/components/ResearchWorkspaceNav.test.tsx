jest.mock('@/lib/use-project-id', () => ({ useProjectId: jest.fn() }));
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));

import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ResearchWorkspaceNav from './ResearchWorkspaceNav';
import { useProjectId } from '@/lib/use-project-id';
import { usePathname } from 'next/navigation';

test('actual research destinations including university instructions preserve encoded project context', () => {
  (useProjectId as jest.Mock).mockReturnValue('project & other');
  (usePathname as jest.Mock).mockReturnValue('/research/library');
  const html = renderToStaticMarkup(<ResearchWorkspaceNav />);
  for (const route of ['problem', 'sources', 'library', 'intelligence', 'language-tools', 'guidelines', 'publication']) {
    expect(html).toContain(`/research/${route}?projectId=project%20%26%20other`);
    expect(existsSync(join(process.cwd(), `src/app/research/${route}/page.tsx`))).toBe(true);
  }
  expect((html.match(/<a /g) || []).length).toBe(8);
  expect(html).toContain('dir="rtl"');
  expect(html).toContain('grid-cols-2');
  expect(html).toContain('sm:grid-cols-4');
  expect(html).toContain('xl:grid-cols-8');
  expect(html).toContain('focus-visible:');
  expect(html).toContain('المكتبة والمراجع');
  expect(html).toMatch(/aria-current="page"[^>]+href="\/research\/library\?projectId=project%20%26%20other"/);
  expect(html).toContain('حزمة النشر والتصدير');
});

test('no project means no unscoped workspace destinations', () => {
  (useProjectId as jest.Mock).mockReturnValue('');
  expect(renderToStaticMarkup(<ResearchWorkspaceNav />)).toBe('');
});

test('the shared research layout exposes navigation without altering destination pages', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/research/layout.tsx'), 'utf8');
  expect(source).toContain('<ResearchWorkspaceNav />');
  expect(source).toContain('{children}');
  expect(source).toContain('<ResearchUtilityDock />');
});
