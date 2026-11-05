jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));

import { GET } from '@/app/api/research/library/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { CITATION_STYLES } from '@/lib/citations/types';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const projectId = 'ce0c5872-122d-4f72-a9d1-43b120b95f45';
const userId = 'owner';
const request = () => new Request(`http://localhost/api/research/library?projectId=${projectId}`);
const row = (index: number) => ({
  id: `reference-${String(index).padStart(5, '0')}`, project_id: projectId, user_id: userId,
  provider: 'user_asserted', external_item_key: `fixture-${index}`, doi: null,
  title: `DECLARED LIBRARY FIXTURE ${index}`, authors: [], publication_year: 2024,
  publication_title: null, url: null, citation_data: {}, created_at: '2026-10-23T00:00:00.000Z',
});

beforeEach(() => { jest.clearAllMocks(); (ownsProject as jest.Mock).mockResolvedValue(true); });

test.each([20, 50, 1075])('returns every one of %i owned references and formats all six complete bibliographies', async (count) => {
  const db = createTableFake({ strictQuery: true, serverRowLimit: 1000 });
  for (let index = 0; index < count; index++) db.seed('project_references', row(index));
  db.seed('project_references', { ...row(count), user_id: 'another-user', title: 'PRIVATE FOREIGN USER' });
  db.seed('project_references', { ...row(count + 1), project_id: 'another-project', title: 'PRIVATE FOREIGN PROJECT' });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: userId }, supabase: db.session });
  const start = performance.now();
  const response = await GET(request());
  expect(response.status).toBe(200);
  const body = await response.json();
  if (process.env.WAHA_QA_ARTIFACT_DIR) writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `library-${count}.json`), JSON.stringify({
    count, total: body.total, elapsedMs: Math.round(performance.now() - start), bytes: Buffer.byteLength(JSON.stringify(body)),
    database: 'explicit in-memory contract substitute', aiCalls: 0, productionCapacityEstablished: false,
  }, null, 2) + '\n');
  expect(body.items.length).toBe(count);
  expect(body.total).toBe(count);
  expect(new Set(body.items.map((item: { id: string }) => item.id)).size).toBe(count);
  for (const style of CITATION_STYLES) expect(body.bibliographies[style].length).toBe(count);
  expect(JSON.stringify(body)).not.toContain('PRIVATE FOREIGN');
  expect(response.headers.get('Cache-Control')).toContain('private, no-store');
  expect(db.writes).toHaveLength(0);
}, 30_000);

test('adapts to a smaller database page ceiling and orders identical timestamps consistently', async () => {
  const db = createTableFake({ strictQuery: true, serverRowLimit: 7 });
  for (let index = 0; index < 50; index++) db.seed('project_references', row(index));
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: userId }, supabase: db.session });
  const body = await (await GET(request())).json();
  expect(body.success).toBe(true);
  expect(body.items.length).toBe(50);
  expect(body.items.map((item: { id: string }) => item.id)).toEqual(Array.from({ length: 50 }, (_, index) => row(49 - index).id));
});

test.each(['database-error', 'count-change', 'duplicate', 'empty-page'] as const)('fails closed on %s after an earlier successful page', async (failure) => {
  const first = { data: [row(0)], count: 2, error: null };
  const second = failure === 'database-error' ? { data: null, count: null, error: { message: 'PRIVATE DATABASE ERROR' } }
    : failure === 'count-change' ? { data: [row(1)], count: 3, error: null }
      : failure === 'duplicate' ? { data: [row(0)], count: 2, error: null }
        : { data: [], count: 2, error: null };
  let calls = 0;
  const from = jest.fn(() => {
    const result = calls++ === 0 ? first : second;
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'range']) query[method] = () => query;
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return query;
  });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: userId }, supabase: { from } });
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Unable to load project library' });
  expect(from).toHaveBeenCalledTimes(2);
});

test('reports an empty library only when the database confirms zero owned rows', async () => {
  const db = createTableFake({ strictQuery: true });
  db.seed('project_references', { ...row(1), user_id: 'another-user' });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: userId }, supabase: db.session });
  const response = await GET(request());
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.items).toEqual([]);
  for (const entries of Object.values(body.bibliographies)) expect(entries).toEqual([]);
});
