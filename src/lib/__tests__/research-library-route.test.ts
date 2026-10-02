jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));

import { GET, POST } from '@/app/api/research/library/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;

afterEach(() => jest.clearAllMocks());

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
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit']) query[method] = jest.fn(() => query);
  query.insert = jest.fn((row: unknown) => { if (captured) captured.insert = row; return query; });
  query.maybeSingle = jest.fn().mockResolvedValue(result);
  query.single = jest.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
}

const savedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'ref-1', project_id: 'project-a', provider: 'waha', external_item_key: '10.1000/abc', doi: '10.1000/abc', title: 'A real study',
  authors: [{ type: 'author', name: 'A. Author' }], publication_year: 2022, publication_title: 'Journal', url: null, citation_data: {}, ...overrides,
});

function libraryPost(item: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/research/library', { method: 'POST', body: JSON.stringify({ projectId: 'project-a', item }) }));
}

test('POST ignores client verification, confidence and provenance and stores the reference as unverified', async () => {
  const captured: { insert?: Record<string, unknown> } = {};
  let call = 0;
  const from = jest.fn(() => {
    call += 1;
    return call === 1 ? chain({ data: null, error: null }) : chain({ data: savedRow(), error: null }, captured);
  });
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
