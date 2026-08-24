const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

import { GET, POST } from './route';

const context = { params: Promise.resolve({ projectId: 'project-owned-by-b' }) };
const accessForA = {
  user: { id: 'user-a', email: 'a@example.test', user_metadata: {} },
  supabase: { from: jest.fn() },
};

describe('project journey authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET returns 401 without an authenticated Supabase user', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(new Request('https://waha.test/api/projects/project-owned-by-b/journey'), context);

    expect(response.status).toBe(401);
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('GET returns 404 before reading another user project', async () => {
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(false);

    const response = await GET(new Request('https://waha.test/api/projects/project-owned-by-b/journey'), context);

    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith('project-owned-by-b', 'user-a', accessForA.supabase);
    expect(accessForA.supabase.from).not.toHaveBeenCalled();
  });

  test('POST returns 401 before parsing the body when unauthenticated', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'verify', content: {} }),
    });

    const response = await POST(request, context);

    expect(response.status).toBe(401);
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('POST returns 404 before modifying another user project', async () => {
    requireAuthenticatedUser.mockResolvedValue(accessForA);
    ownsProject.mockResolvedValue(false);
    const request = new Request('https://waha.test/api/projects/project-owned-by-b/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'verify', content: { decision: 'proceed' } }),
    });

    const response = await POST(request, context);

    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith('project-owned-by-b', 'user-a', accessForA.supabase);
    expect(accessForA.supabase.from).not.toHaveBeenCalled();
  });
});
