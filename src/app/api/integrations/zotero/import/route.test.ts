import { createClient } from '@supabase/supabase-js';

const mockAuth = jest.fn(), mockOwns = jest.fn(), mockEntitlement = jest.fn(), mockIntegration = jest.fn(), mockService = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: () => mockAuth(), ownsProject: (...args: unknown[]) => mockOwns(...args) }));
jest.mock('@/lib/billing/entitlements', () => ({ hasEntitlement: (...args: unknown[]) => mockEntitlement(...args) }));
jest.mock('@/lib/integrations/zotero/server', () => ({ getZoteroIntegration: (...args: unknown[]) => mockIntegration(...args) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockService() }));
import { POST } from './route';
import { GET as collections } from '../collections/route';

const project = '81000000-0000-0000-0000-000000000001', user = '00000000-0000-0000-0000-000000000001';
const originalFetch = global.fetch;
const providerFetch = jest.fn();
const rowsByKey = new Map<string, Record<string, unknown>>();
let calls: Array<{ url: string; headers: Headers; rows: Record<string, unknown>[] }>;
let databaseMode: 'ok' | 'error' | 'missing-count' | 'wrong-count';
const item = (i: number, itemType = 'journalArticle') => {
  const key = i.toString(36).toUpperCase().padStart(8, '0');
  return { key, version: 9, data: { key, itemType, title: `مرجع ${i} 🙂`, creators: [{ creatorType: 'author', name: 'مؤلف تجريبي' }], DOI: `10.1234/fixture.${i}` } };
};
function pages(count: number) {
  const source = Array.from({ length: count }, (_, i) => item(i));
  providerFetch.mockImplementation(async (input: string) => {
    const url = new URL(input), start = Number(url.searchParams.get('start'));
    return Response.json(source.slice(start, start + 100), { headers: { 'Total-Results': String(count), 'Last-Modified-Version': '9' } });
  });
}
const request = (body: unknown = { projectId: project }) => new Request('https://declared-test.invalid/api/integrations/zotero/import', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
beforeEach(() => {
  jest.clearAllMocks(); rowsByKey.clear(); calls = []; databaseMode = 'ok';
  mockAuth.mockResolvedValue({ user: { id: user }, supabase: {} }); mockOwns.mockReset().mockResolvedValue(true); mockEntitlement.mockResolvedValue(true);
  mockIntegration.mockResolvedValue({ external_user_id: '12345', secret: { apiKey: 'declared-fixture-key' } });
  global.fetch = providerFetch as typeof fetch; providerFetch.mockReset(); pages(50);
  mockService.mockImplementation(() => createClient('https://declared-database.invalid', 'declared-fixture-service-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input)), headers = new Headers(init?.headers);
      expect(url.origin).toBe('https://declared-database.invalid'); expect(url.pathname).toBe('/rest/v1/project_references');
      expect(init?.method).toBe('POST'); expect(url.searchParams.get('on_conflict')).toBe('project_id,provider,external_item_key');
      expect(headers.get('prefer')).toContain('count=exact'); expect(headers.get('prefer')).toContain('resolution=merge-duplicates');
      expect(headers.get('prefer')).not.toContain('return=representation'); expect(url.searchParams.has('select')).toBe(false);
      const rows = JSON.parse(String(init?.body)) as Record<string, unknown>[];
      expect(rows.every(row => row.project_id === project && row.user_id === user && row.provider === 'zotero')).toBe(true);
      calls.push({ url: url.toString(), headers, rows });
      if (databaseMode === 'error') return Response.json({ code: 'XX000', message: 'PRIVATE_DATABASE_DETAILS' }, { status: 500 });
      for (const row of rows) rowsByKey.set(String(row.external_item_key), row);
      const count = databaseMode === 'missing-count' ? '*' : String(rows.length - (databaseMode === 'wrong-count' ? 1 : 0));
      return new Response(null, { status: 201, headers: { 'Content-Range': `*/${count}` } });
    } },
  }));
});
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

test.each([0, 50, 100, 101, 250, 1051])('imports %i complete references with the actual installed SDK and one atomic mutation', async count => {
  pages(count); const response = await POST(request());
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ complete: true, imported: count, total: count });
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(calls).toHaveLength(count ? 1 : 0);
  expect(rowsByKey.size).toBe(count); if (count) expect(calls[0].rows).toHaveLength(count);
  expect(mockOwns).toHaveBeenCalledTimes(count ? 3 : 2);
});
test('repeating an import updates identical provider keys without creating duplicates or claiming new records', async () => {
  pages(250); expect((await POST(request())).status).toBe(200); expect((await POST(request())).status).toBe(200);
  expect(rowsByKey.size).toBe(250); expect(calls).toHaveLength(2);
  expect(rowsByKey.get(item(0).key)).toMatchObject({ title: 'مرجع 0 🙂', doi: '10.1234/fixture.0', source_version: 9, user_id: user });
});
test('notes and attachments never create reference rows', async () => {
  providerFetch.mockResolvedValue(Response.json([item(0, 'note'), item(1, 'attachment')], { headers: { 'Total-Results': '2', 'Last-Modified-Version': '9' } }));
  expect(await (await POST(request())).json()).toEqual({ complete: true, imported: 0, total: 0 }); expect(calls).toHaveLength(0);
});
test('a later provider failure causes no database mutation or truncated success', async () => {
  pages(101); const first = providerFetch.getMockImplementation()!;
  providerFetch.mockImplementation(async (input: string) => new URL(input).searchParams.get('start') === '100' ? new Response('PRIVATE_PROVIDER_DETAILS', { status: 500 }) : first(input));
  const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('PRIVATE_PROVIDER_DETAILS'); expect(calls).toHaveLength(0);
});
test('a changed library is retryable and cannot save pages from different versions', async () => {
  pages(101); const original = providerFetch.getMockImplementation()!;
  providerFetch.mockImplementation(async (input: string) => { const response = await original(input); if (new URL(input).searchParams.get('start') === '100') response.headers.set('Last-Modified-Version', '10'); return response; });
  expect((await POST(request())).status).toBe(409); expect(calls).toHaveLength(0);
});
test.each(['error', 'missing-count', 'wrong-count'] as const)('a database %s cannot confirm a successful or partial import', async mode => {
  databaseMode = mode; const response = await POST(request()); expect(response.status).toBe(503);
  const text = await response.text(); expect(text).toContain('تعذر تأكيد'); expect(text).not.toContain('PRIVATE_DATABASE_DETAILS'); expect(text).not.toContain('declared-fixture-key');
  expect(JSON.parse(text).complete).toBe(false);
});
test('anonymous requests never access the provider, billing, integrations or service client', async () => {
  mockAuth.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
  expect(providerFetch).not.toHaveBeenCalled(); expect(mockEntitlement).not.toHaveBeenCalled(); expect(mockIntegration).not.toHaveBeenCalled(); expect(mockService).not.toHaveBeenCalled();
});
test('entitlement denial and disconnected accounts do not start provider reads', async () => {
  mockEntitlement.mockResolvedValue(false); expect((await POST(request())).status).toBe(403); mockEntitlement.mockResolvedValue(true);
  mockIntegration.mockResolvedValue(null); expect((await POST(request())).status).toBe(409); expect(providerFetch).not.toHaveBeenCalled();
});
test.each([null, [], {}, { projectId: 42 }, { projectId: '../other' }, { projectId: project, collectionKey: '../other' }])('rejects invalid input %j before any provider request', async body => {
  expect((await POST(request(body))).status).toBe(400); expect(providerFetch).not.toHaveBeenCalled(); expect(mockService).not.toHaveBeenCalled();
});
test('malformed JSON returns a handled client error', async () => {
  expect((await POST(new Request('https://test.invalid', { method: 'POST', body: '{' }))).status).toBe(400);
});
test('a foreign project and ownership lost before saving produce no write', async () => {
  mockOwns.mockResolvedValueOnce(false); expect((await POST(request())).status).toBe(404); expect(providerFetch).not.toHaveBeenCalled();
  mockOwns.mockResolvedValueOnce(true).mockResolvedValueOnce(false); expect((await POST(request())).status).toBe(404); expect(calls).toHaveLength(0);
});
test('ownership lost after a database response is not reported as confirmed success', async () => {
  mockOwns.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect((await POST(request())).status).toBe(503); expect(calls).toHaveLength(1);
});
test('provider Retry-After is preserved without exposing its raw body', async () => {
  providerFetch.mockResolvedValue(new Response('PRIVATE_PROVIDER_DETAILS', { status: 429, headers: { 'Retry-After': '17' } }));
  const response = await POST(request()); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('17'); expect(await response.text()).not.toContain('PRIVATE_PROVIDER_DETAILS'); expect(calls).toHaveLength(0);
});
test('integration secret/read failures are handled without leaking details', async () => {
  mockIntegration.mockRejectedValue(new Error('PRIVATE_KEY_DECRYPTION_DETAILS'));
  const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('PRIVATE_KEY_DECRYPTION_DETAILS');
});
test('collections return empty libraries and handle upstream errors privately', async () => {
  pages(0); const empty = await collections(); expect(empty.status).toBe(200); expect(await empty.json()).toEqual({ collections: [] });
  providerFetch.mockRejectedValue(new Error('PRIVATE_FETCH_ERROR')); const failed = await collections(); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('PRIVATE_FETCH_ERROR');
});
