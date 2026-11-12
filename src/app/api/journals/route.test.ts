const requireAuthenticatedUser = jest.fn();
const loadJournalMatches = jest.fn();
const loadJournalAngles = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args) }));
jest.mock('@/lib/journal-matching', () => ({
  loadJournalMatches: (...args: unknown[]) => loadJournalMatches(...args),
  loadJournalAngles: (...args: unknown[]) => loadJournalAngles(...args),
}));

import { POST } from './route';

const call = (body: unknown) => POST(new Request('https://waha.systems/api/journals', { method: 'POST', body: JSON.stringify(body) }));

describe('journals route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'u1' } });
    loadJournalMatches.mockResolvedValue({ journals: [] });
    loadJournalAngles.mockResolvedValue({ angles: [] });
  });

  test('requires sign-in', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await call({ query: 'simulation' })).status).toBe(401);
    expect(loadJournalMatches).not.toHaveBeenCalled();
  });

  test('matches journals for a topic, privately', async () => {
    const response = await call({ query: '  simulation in nursing education ' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(loadJournalMatches).toHaveBeenCalledWith('simulation in nursing education');
  });

  test('plans angles for an OpenAlex journal id only', async () => {
    expect((await call({ journalId: 'S204691484' })).status).toBe(200);
    expect(loadJournalAngles).toHaveBeenCalledWith('S204691484');
    expect((await call({ journalId: 'S1|S2' })).status).toBe(400);
    expect((await call({ query: 'ab' })).status).toBe(400);
  });

  test('an OpenAlex failure shows no guessed list', async () => {
    loadJournalMatches.mockRejectedValue(new Error('down'));
    const response = await call({ query: 'simulation' });
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('matches');
  });
});
