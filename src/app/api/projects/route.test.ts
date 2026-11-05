jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn() }));
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { GET, POST } from './route';
const auth = requireAuthenticatedUser as jest.Mock;
const id = '7dd1f26b-d6ea-4e60-803f-0113234379c8';
function query(result: unknown) {
  const q: Record<string, jest.Mock> = {};
  for (const key of ['select', 'eq', 'insert']) q[key] = jest.fn(() => q);
  q.maybeSingle = jest.fn().mockResolvedValue(result); q.single = jest.fn().mockResolvedValue(result); return q;
}
const request = (body: unknown) => new Request('http://localhost/api/projects', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => jest.clearAllMocks());
test('anonymous creation is rejected', async () => {
  auth.mockResolvedValue(null); expect((await POST(request({ projectId: id, title: 'Research topic' }))).status).toBe(401);
});
test('creates a draft independently of exploration and retry reads the same owned id', async () => {
  const read = query({ data: null, error: null }); const insert = query({ data: { id, title: 'Research topic' }, error: null });
  const existing = query({ data: { id, title: 'Research topic' }, error: null });
  const from = jest.fn().mockReturnValueOnce(read).mockReturnValueOnce(insert).mockReturnValue(existing);
  auth.mockResolvedValue({ user: { id: 'u' }, supabase: { from } });
  expect((await POST(request({ projectId: id, title: 'Research topic', user_id: 'forged' }))).status).toBe(201);
  expect(insert.insert).toHaveBeenCalledWith({ id, user_id: 'u', title: 'Research topic', status: 'draft' });
  expect((await POST(request({ projectId: id, title: 'Research topic' }))).status).toBe(200);
  expect(existing.insert).not.toHaveBeenCalled();
  expect(existing.eq).toHaveBeenCalledWith('user_id', 'u');
});
test('reload is owner scoped and another owner id is not returned', async () => {
  const q = query({ data: null, error: null }); auth.mockResolvedValue({ user: { id: 'u' }, supabase: { from: () => q } });
  expect((await GET(new Request(`http://localhost/api/projects?projectId=${id}`))).status).toBe(404);
  expect(q.eq).toHaveBeenCalledWith('user_id', 'u');
});
test('a reload returns the persisted owned draft', async () => {
  const q = query({ data: { id, title: 'Research topic' }, error: null });
  auth.mockResolvedValue({ user: { id: 'u' }, supabase: { from: () => q } });
  const response = await GET(new Request(`http://localhost/api/projects?projectId=${id}`));
  expect(response.status).toBe(200); expect((await response.json()).project.id).toBe(id);
  expect(q.eq).toHaveBeenCalledWith('id', id); expect(q.eq).toHaveBeenCalledWith('user_id', 'u');
});

test('recent projects are owner scoped and limited, never an unfiltered directory', async () => {
  const q = query({ data: null, error: null });
  q.order = jest.fn(() => q); q.limit = jest.fn().mockResolvedValue({ data: [{ id, title: 'Owned draft' }], error: null });
  auth.mockResolvedValue({ user: { id: 'u' }, supabase: { from: () => q } });
  const response = await GET(new Request('http://localhost/api/projects'));
  expect((await response.json()).projects).toHaveLength(1); expect(q.eq).toHaveBeenCalledWith('user_id', 'u');
  expect(q.limit).toHaveBeenCalledWith(12); expect(response.headers.get('cache-control')).toBe('private, no-store');
});
test('concurrent retry resolves a unique-id conflict without a second project', async () => {
  const read = query({ data: null, error: null });
  const insert = query({ data: null, error: { code: '23505' } });
  const retry = query({ data: { id, title: 'Research topic' }, error: null });
  const from = jest.fn().mockReturnValueOnce(read).mockReturnValueOnce(insert).mockReturnValueOnce(retry);
  auth.mockResolvedValue({ user: { id: 'u' }, supabase: { from } });
  const response = await POST(request({ projectId: id, title: 'Research topic' }));
  expect(response.status).toBe(200); expect((await response.json()).existing).toBe(true);
  expect(retry.eq).toHaveBeenCalledWith('user_id', 'u'); expect(retry.insert).not.toHaveBeenCalled();
});
test.each([{ projectId: 'bad', title: 'Research topic' }, { projectId: id, title: 'x' }, { projectId: id, title: [] }])('rejects malformed creation without a write', async (body) => {
  const from = jest.fn(); auth.mockResolvedValue({ user: { id: 'u' }, supabase: { from } });
  expect((await POST(request(body))).status).toBe(400); expect(from).not.toHaveBeenCalled();
});
