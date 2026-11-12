const requireAuthenticatedUser = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args) }));

import { DELETE, GET, POST } from './route';

type Result = { data?: unknown; error?: { code?: string } | null };
/** A chainable stand-in for the user's own Supabase client that records each call. */
function signedIn(results: { select?: Result; update?: Result; insert?: Result }, orcid: string | null = '0000-0003-1613-5981') {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain = (result: Result) => {
    const node: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'is']) node[name] = (...args: unknown[]) => { calls.push([name, ...args]); return node; };
    node.maybeSingle = async () => result; node.single = async () => result;
    node.then = (resolve: (value: Result) => unknown) => resolve(result);
    return node;
  };
  const from = (table: string) => ({
    select: (...args: unknown[]) => { calls.push(['from', table], ['select', ...args]); return chain(results.select ?? { data: null, error: null }); },
    update: (value: unknown) => { calls.push(['from', table], ['update', value]); return chain(results.update ?? { error: null }); },
    insert: (value: unknown) => { calls.push(['from', table], ['insert', value]); return chain(results.insert ?? { data: null, error: null }); },
  });
  requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-1', user_metadata: orcid ? { orcid } : {} }, supabase: { from } });
  return calls;
}
const post = (body: unknown) => POST(new Request('https://waha.systems/api/career/share', { method: 'POST', body: JSON.stringify(body) }));
const row = { token: 'a'.repeat(32), orcid: '0000-0003-1613-5981', sections: ['timeline'], created_at: '2026-11-12T10:00:00.000Z' };

beforeEach(() => jest.clearAllMocks());

describe('career share link route (DOC-30-03)', () => {
  test('a signed-out visitor can neither read, create nor revoke a link', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await post({ sections: ['timeline'] })).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
  });

  test('reads only the signed-in account\'s active link', async () => {
    const calls = signedIn({ select: { data: row, error: null } });
    const response = await GET();
    expect(await response.json()).toEqual({ link: { token: row.token, orcid: row.orcid, sections: ['timeline'], createdAt: row.created_at } });
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1']);
    expect(calls).toContainEqual(['is', 'revoked_at', null]);
  });

  test('says the link is not available yet while the table is missing', async () => {
    signedIn({ select: { data: null, error: { code: 'PGRST205' } } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('رابط المشاركة غير مفعّل بعد على الموقع.');
  });

  test('a new link needs chosen sections and a saved iD', async () => {
    signedIn({});
    expect((await post({ sections: [] })).status).toBe(400);
    expect((await post({ sections: ['projects'] })).status).toBe(400);
    signedIn({}, null);
    expect((await post({ sections: ['timeline'] })).status).toBe(409);
  });

  test('creating a link first revokes the earlier one, then saves the iD and sections for this account', async () => {
    const calls = signedIn({ insert: { data: row, error: null } });
    const response = await post({ sections: ['directions', 'timeline'] });
    expect(response.status).toBe(201);
    const update = calls.findIndex(call => call[0] === 'update');
    const insert = calls.findIndex(call => call[0] === 'insert');
    expect(update).toBeGreaterThanOrEqual(0);
    expect(update).toBeLessThan(insert);
    expect(calls[insert][1]).toMatchObject({ user_id: 'user-1', orcid: '0000-0003-1613-5981', sections: ['timeline', 'directions'] });
    expect((calls[insert][1] as { token: string }).token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  test('revoking touches only the account\'s own active link', async () => {
    const calls = signedIn({});
    const response = await DELETE();
    expect(await response.json()).toEqual({ link: null });
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1']);
    expect(calls).toContainEqual(['is', 'revoked_at', null]);
  });
});
