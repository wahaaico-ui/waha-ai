jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
// project_references is written only through the server client.
const mockServiceFrom = jest.fn();
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: (...args: unknown[]) => mockServiceFrom(...args) }) }));

import { GET, POST } from '@/app/api/research/library/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;

afterEach(() => jest.resetAllMocks());

test('project library rejects anonymous reads and writes', async () => {
  auth.mockResolvedValue(null);
  const get = await GET(new Request('http://localhost/api/research/library?projectId=p'));
  const post = await POST(new Request('http://localhost/api/research/library', { method: 'POST', body: JSON.stringify({ projectId: 'p', item: { title: 'Study' } }) }));
  expect(get.status).toBe(401); expect(post.status).toBe(401); expect(owns).not.toHaveBeenCalled();
});

test('project library rejects a project owned by another user', async () => {
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: {} }); owns.mockResolvedValue(false);
  const response = await GET(new Request('http://localhost/api/research/library?projectId=user-b-project'));
  expect(response.status).toBe(404);
  expect(owns).toHaveBeenCalledWith('user-b-project', 'user-a', expect.anything());
});

// A thenable query double: builder methods return the chain; awaiting it or
// calling single/maybeSingle resolves to the configured result.
function chain(result: unknown, captured?: { insert?: unknown }) {
  const counted = result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)
    ? { ...result, count: result.data.length } : result;
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'range']) query[method] = jest.fn(() => query);
  query.insert = jest.fn((row: unknown) => { if (captured) captured.insert = row; return query; });
  query.maybeSingle = jest.fn().mockResolvedValue(result);
  query.single = jest.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(counted).then(resolve, reject);
  return query;
}

const savedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ref-1', project_id: 'project-a', provider: 'waha', external_item_key: '10.1000/abc', doi: '10.1000/abc', title: 'A real study',
  authors: [{ type: 'author', name: 'A. Author' }], publication_year: 2022, publication_title: 'Journal', url: null, citation_data: {}, ...overrides,
});

function libraryPost(item: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/research/library', { method: 'POST', body: JSON.stringify({ projectId: 'project-a', item }) }));
}

test('GET keeps supplied author name parts and formats the bibliography from them', async () => {
  const row = savedRow({ authors: [{ family: 'Smith', given: 'Jane' }], citation_data: { volume: '4', issue: '2', pages: '10-18' } });
  const db = { from: jest.fn(() => chain({ data: [row], error: null })) };
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: db }); owns.mockResolvedValue(true);
  const response = await GET(new Request('http://localhost/api/research/library?projectId=project-a'));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.items[0].authors).toEqual(['Jane Smith']);
  expect(result.bibliographies['apa-7'][0].text).toContain('Smith, J. (2022).');
});

test('POST ignores client verification, confidence and provenance and stores the reference as unverified', async () => {
  const captured: { insert?: Record<string, unknown> } = {};
  const sessionInsert = jest.fn();
  const from = jest.fn(() => ({ ...chain({ data: null, error: null }), insert: sessionInsert }));
  mockServiceFrom.mockImplementation(() => chain({ data: savedRow({ provider: 'user_asserted' }), error: null }, captured));
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from } }); owns.mockResolvedValue(true);

  const response = await libraryPost({
    title: 'A real study', doi: 'https://doi.org/10.1000/ABC', authors: ['A. Author'], year: 2022,
    verificationStatus: 'verified', confidenceScore: 99, provenance: ['crossref', 'openalex'],
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  const row = captured.insert as Record<string, unknown>;
  // A browser-supplied item is a user-asserted reference (Slice 1), never a discovered one.
  expect(row.provider).toBe('user_asserted');
  expect(row.citation_data).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0, provenance: [], metadataOrigin: 'user_asserted' }));
  expect(body.item.verificationStatus).toBe('unverified');
  // The browser's session never writes the row; the server client does, with
  // the project and user from the ownership check.
  expect(sessionInsert).not.toHaveBeenCalled();
  expect(mockServiceFrom).toHaveBeenCalledWith('project_references');
  expect(row).toEqual(expect.objectContaining({ project_id: 'project-a', user_id: 'user-a' }));
});

test('POST writes nothing for a project the caller does not own', async () => {
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: jest.fn() } }); owns.mockResolvedValue(false);
  const response = await POST(new Request('http://localhost/api/research/library', { method: 'POST', body: JSON.stringify({ projectId: 'user-b-project', item: { title: 'Study title', user_id: 'user-b' } }) }));
  expect(response.status).toBe(404);
  expect(mockServiceFrom).not.toHaveBeenCalled();
});

test('POST never overwrites an existing reference (e.g. a Zotero import) with client metadata', async () => {
  const zoteroRow = savedRow({ provider: 'zotero', title: 'Title from Zotero', citation_data: { verificationStatus: 'verified' } });
  const insert = jest.fn();
  const from = jest.fn(() => ({ ...chain({ data: zoteroRow, error: null }), insert, upsert: insert, update: insert }));
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from } }); owns.mockResolvedValue(true);

  const response = await libraryPost({ title: 'Overwritten title', doi: '10.1000/abc', authors: ['Someone Else'], verificationStatus: 'verified' });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(insert).not.toHaveBeenCalled();
  expect(body.existing).toBe(true);
  expect(body.item.title).toBe('Title from Zotero');
  expect(body.item.verificationStatus).toBe('unverified');
});

test('GET reports legacy rows with a stored "verified" status as unverified', async () => {
  const legacy = savedRow({ provider: 'openalex', citation_data: { verificationStatus: 'verified', confidenceScore: 95, provenance: ['openalex', 'crossref'] } });
  const from = jest.fn(() => chain({ data: [legacy], error: null }));
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from } }); owns.mockResolvedValue(true);

  const response = await GET(new Request('http://localhost/api/research/library?projectId=project-a'));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.items[0]).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0, provenance: ['openalex'] }));
});

test('GET labels a discovery-provider row as server_discovered only when it carries its server search record', async () => {
  const withRecord = savedRow({ id: 'ref-1', provider: 'waha_discovery', citation_data: { metadataOrigin: 'server_discovered', discovery: { resultId: '6f1c7a52-2d1e-4c0b-9a51-0b7f1f1f2a10' } } });
  const withoutRecord = savedRow({ id: 'ref-2', provider: 'waha_discovery', external_item_key: 'forged', citation_data: { metadataOrigin: 'server_discovered' } });
  const manual = savedRow({ id: 'ref-3', provider: 'user_asserted', external_item_key: 'manual' });
  const from = jest.fn(() => chain({ data: [withRecord, withoutRecord, manual], error: null }));
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from } }); owns.mockResolvedValue(true);

  const body = await (await GET(new Request('http://localhost/api/research/library?projectId=project-a'))).json();

  expect(body.items.map((item: { id: string; origin: string }) => [item.id, item.origin])).toEqual([
    ['ref-1', 'server_discovered'], ['ref-2', 'legacy_client_submitted'], ['ref-3', 'user_asserted'],
  ]);
});

test('GET returns all 50 references and scopes the read to the authenticated owner and project', async () => {
  const rows = Array.from({ length: 50 }, (_, index) => savedRow({ id: `ref-${index}`, external_item_key: `key-${index}`, doi: `10.1000/study-${index}`, title: `Study ${index}` }));
  const query = chain({ data: rows, error: null });
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: jest.fn(() => query) } }); owns.mockResolvedValue(true);
  const response = await GET(new Request('http://localhost/api/research/library?projectId=project-a'));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.items).toHaveLength(50);
  for (const entries of Object.values(body.bibliographies)) expect(entries).toHaveLength(50);
  expect(query.eq).toHaveBeenCalledWith('project_id', 'project-a');
  expect(query.eq).toHaveBeenCalledWith('user_id', 'user-a');
  expect(mockServiceFrom).not.toHaveBeenCalled();
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});

test('GET reports database errors without claiming that the project has no saved references', async () => {
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: jest.fn(() => chain({ data: null, error: { message: 'private database detail' } })) } }); owns.mockResolvedValue(true);
  const response = await GET(new Request('http://localhost/api/research/library?projectId=project-a'));
  const body = await response.json();
  expect(response.status).toBe(500);
  expect(body).toEqual({ error: 'Unable to load project library' });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});
