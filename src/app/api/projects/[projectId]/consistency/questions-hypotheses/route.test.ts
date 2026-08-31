const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

import { GET } from './route';

const context = { params: Promise.resolve({ projectId: 'private-project' }) };

describe('questions-hypotheses consistency authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 before reading documents for an anonymous request', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(new Request('https://waha.test/api/projects/private-project/consistency/questions-hypotheses'), context);
    expect(response.status).toBe(401);
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('returns 404 before reading a project owned by another user', async () => {
    const supabase = { from: jest.fn() };
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, supabase });
    ownsProject.mockResolvedValue(false);
    const response = await GET(new Request('https://waha.test/api/projects/private-project/consistency/questions-hypotheses'), context);
    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith('private-project', 'user-a', supabase);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
