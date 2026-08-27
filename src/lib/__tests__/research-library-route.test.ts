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
