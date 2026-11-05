jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
import { GET } from '@/app/api/research/library/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { BibliographyEngine } from '@/lib/citations/BibliographyEngine';
import { loadProjectLibrary } from '@/lib/project-library-client';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const originalFetch = global.fetch;
const projectId = 'ce0c5872-122d-4f72-a9d1-43b120b95f45';
const row = (index: number) => ({ id: `reference-${index}`, project_id: projectId, user_id: 'owner', provider: 'user_asserted',
  external_item_key: `fixture-${index}`, title: `Declared fixture ${index}`, authors: [], publication_year: 2024,
  doi: null, publication_title: null, url: null, citation_data: {}, created_at: '2026-10-23' });

beforeEach(() => { jest.clearAllMocks(); (ownsProject as jest.Mock).mockResolvedValue(true); });
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); jest.useRealTimers(); });

test.each([[20, 200], [50, 7], [1075, 200]])('loads all %i owned rows with server pages of %i and no formatting work', async (count, ceiling) => {
  const db = createTableFake({ strictQuery: true, serverRowLimit: ceiling });
  for (let i = 0; i < count; i++) db.seed('project_references', row(i));
  db.seed('project_references', { ...row(count), user_id: 'other-owner', title: 'PRIVATE FOREIGN USER' });
  db.seed('project_references', { ...row(count + 1), project_id: 'other-project', title: 'PRIVATE FOREIGN PROJECT' });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: db.session });
  const format = jest.spyOn(BibliographyEngine, 'build');
  let maxBytes = 0, calls = 0;
  global.fetch = jest.fn(async (url, init) => {
    calls++;
    const response = await GET(new Request(`http://localhost${url}`, { signal: init?.signal }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('private, no-store');
    const page = await response.clone().json();
    expect(page).not.toHaveProperty('bibliographies');
    expect(page.items.length).toBeLessThanOrEqual(200);
    maxBytes = Math.max(maxBytes, Buffer.byteLength(JSON.stringify(page)));
    return response;
  });
  const progress: [number, number][] = [];
  const start = performance.now();
  const items = await loadProjectLibrary(projectId, { onProgress: (loaded, total) => progress.push([loaded, total]) });
  const elapsedMs = Math.round(performance.now() - start);
  expect(items).toHaveLength(count);
  expect(new Set(items.map(item => item.id)).size).toBe(count);
  expect(JSON.stringify(items)).not.toContain('PRIVATE FOREIGN');
  expect(progress.at(-1)).toEqual([count, count]);
  expect(calls).toBe(Math.ceil(count / ceiling));
  expect(format).not.toHaveBeenCalled();
  expect(db.writes).toHaveLength(0);
  if (process.env.WAHA_QA_ARTIFACT_DIR) writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, `paged-library-${count}.json`), JSON.stringify({
    count, calls, maxBytes, elapsedMs, formattingCalls: format.mock.calls.length,
    database: 'explicit in-memory substitute', productionCapacityEstablished: false,
  }, null, 2) + '\n');
});

test.each(['-1', '1.5', '1e2', 'NaN', '9007199254740991'])('rejects invalid offset %s', async value => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: {} });
  const response = await GET(new Request(`http://localhost/api/research/library?projectId=${projectId}&view=items&offset=${value}`));
  expect(response.status).toBe(400);
});

test.each([401, 404])('keeps paged metadata behind authorization (%i)', async status => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue(status === 401 ? null : { user: { id: 'owner' }, supabase: {} });
  (ownsProject as jest.Mock).mockResolvedValue(false);
  expect((await GET(new Request(`http://localhost/api/research/library?projectId=${projectId}&view=items&offset=0`))).status).toBe(status);
});

const page = (items: { id: string }[], total: number, offset = 0, nextOffset: number | null = null) => Response.json({ success: true, items, total, offset, nextOffset });
test.each(['count', 'duplicate', 'empty', 'offset', 'cursor', 'error', 'invalid'])('does not return a partial result after %s breaks a later page', async failure => {
  const second = failure === 'count' ? page([{ id: 'b' }], 3, 1, 2)
    : failure === 'duplicate' ? page([{ id: 'a' }], 2, 1)
      : failure === 'empty' ? page([], 2, 1, 1)
        : failure === 'offset' ? page([{ id: 'b' }], 2, 0)
          : failure === 'cursor' ? page([{ id: 'b' }], 2, 1, 2)
            : failure === 'error' ? new Response('private database error', { status: 500 }) : Response.json(null);
  global.fetch = jest.fn().mockResolvedValueOnce(page([{ id: 'a' }], 2, 0, 1)).mockResolvedValueOnce(second);
  await expect(loadProjectLibrary(projectId)).rejects.toThrow(/تغيرت المكتبة|تعذر تحميل/);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('accepts a confirmed empty library and encodes the project once', async () => {
  global.fetch = jest.fn().mockResolvedValue(page([], 0));
  expect(await loadProjectLibrary('project & another')).toEqual([]);
  expect(global.fetch).toHaveBeenCalledWith('/api/research/library?projectId=project%20%26%20another&view=items&offset=0', expect.objectContaining({ cache: 'no-store' }));
});

test('respects a bounded Retry-After pause before retrying the same page', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0.001' } })).mockResolvedValueOnce(page([{ id: 'a' }], 1));
  expect(await loadProjectLibrary(projectId)).toEqual([{ id: 'a' }]);
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe((global.fetch as jest.Mock).mock.calls[1][0]);
});

test('does not retry without a bound when rate limiting persists', async () => {
  global.fetch = jest.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '0.001' } })));
  await expect(loadProjectLibrary(projectId)).rejects.toHaveProperty('status', 429);
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

test('cancels a pending rate-limit pause when leaving the project', async () => {
  const controller = new AbortController();
  global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
  const loading = loadProjectLibrary(projectId, { signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await expect(loading).rejects.toHaveProperty('name', 'AbortError');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('cancels a slow page after its own timeout without presenting an empty library', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })));
  const rejected = expect(loadProjectLibrary(projectId)).rejects.toThrow('استغرق تحميل المكتبة');
  await jest.advanceTimersByTimeAsync(20_001);
  await rejected;
});

test('does not start a request for an already canceled project', async () => {
  const controller = new AbortController(); controller.abort(); global.fetch = jest.fn();
  await expect(loadProjectLibrary(projectId, { signal: controller.signal })).rejects.toHaveProperty('name', 'AbortError');
  expect(global.fetch).not.toHaveBeenCalled();
});
