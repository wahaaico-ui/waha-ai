const requireAuthenticatedUser = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
}));

import { GET } from './route';

function authenticatedQuery(result: { data: unknown[] | null; error: unknown }) {
  const limit = jest.fn().mockResolvedValue(result);
  const order = jest.fn(() => ({ limit }));
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  requireAuthenticatedUser.mockResolvedValue({
    user: { id: 'user-123' },
    supabase: { from },
  });
  return { from, select, eq, order, limit };
}

describe('verify idea history route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('rejects anonymous access with a correlated request ID', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(new Request('https://waha.systems/api/verify-idea/history', {
      headers: { 'x-request-id': 'history-request-1' },
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.requestId).toBe('history-request-1');
    expect(response.headers.get('x-waha-request-id')).toBe('history-request-1');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  test('loads only the authenticated user history without caching it', async () => {
    const items = [{ id: 'verification-1', topic: 'موضوع بحثي', acceptance_score: 72 }];
    const query = authenticatedQuery({ data: items, error: null });
    const response = await GET(new Request('https://waha.systems/api/verify-idea/history'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual(items);
    expect(query.from).toHaveBeenCalledWith('idea_verifications');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  test('returns a safe correlated error when the history query fails', async () => {
    authenticatedQuery({ data: null, error: { code: 'database-error' } });
    const response = await GET(new Request('https://waha.systems/api/verify-idea/history', {
      headers: { 'x-request-id': 'history-request-2' },
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Unable to load verification history', requestId: 'history-request-2' });
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain('database-error');
  });
});
