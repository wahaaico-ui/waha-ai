import fs from 'fs';
import path from 'path';
import { RETIRED_AI_ROUTES, type RetiredAiRoute } from '@/lib/retired-ai-route';

const routes = Object.keys(RETIRED_AI_ROUTES) as RetiredAiRoute[];

afterEach(() => jest.restoreAllMocks());

test('nineteen early AI routes are retired', () => {
  expect(routes).toHaveLength(19);
});

test.each(routes)('%s answers 410 with the page that replaces it, without calling any AI service', async route => {
  const call = jest.spyOn(global, 'fetch');
  const { POST } = await import(`@/app${route}/route`) as { POST: () => Promise<Response> };
  const response = await POST();
  const body = await response.json();
  expect(response.status).toBe(410);
  expect(body.next).toBe(RETIRED_AI_ROUTES[route]);
  expect(fs.existsSync(path.join(__dirname, '..', RETIRED_AI_ROUTES[route], 'page.tsx'))).toBe(true);
  expect(call).not.toHaveBeenCalled();
});

test('no page or script calls a retired route', () => {
  const callers: string[] = [];
  const walk = (dir: string) => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', '.next', 'api'].includes(entry.name)) walk(full); return; }
    if (!/\.(tsx?|mjs)$/.test(entry.name) || /\.test\./.test(entry.name)) return;
    const text = fs.readFileSync(full, 'utf8');
    for (const route of routes) if (new RegExp(`['"\`]${route}(?![\\w/-])`).test(text)) callers.push(`${full}: ${route}`);
  });
  walk(path.join(__dirname, '..'));
  walk(path.join(__dirname, '../../../tests'));
  expect(callers.filter(caller => !caller.includes('retired-ai-route.ts'))).toEqual([]);
});
