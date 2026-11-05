jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/proxy', () => ({ requestFingerprint: jest.fn().mockResolvedValue('visitor-fingerprint') }));
jest.mock('@/lib/idea-query-planning', () => ({ planIdeaSearchQueries: jest.fn() }));
let mockDailyCount = 0;
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => {
    const query = { select: () => query, eq: () => query, gte: async () => ({ count: mockDailyCount, error: null }) };
    return query;
  } }),
}));

import { POST } from '@/app/api/verify-idea/route';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { planIdeaSearchQueries } from '@/lib/idea-query-planning';

const plan = planIdeaSearchQueries as jest.Mock;
const auth = requireAuthenticatedUser as jest.Mock;
const explore = () => POST(new Request('https://waha.systems/api/verify-idea', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: 'written corrective feedback in EFL writing' }) }) as never);

beforeAll(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-key'; });
afterAll(() => { delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; });
beforeEach(() => { jest.clearAllMocks(); plan.mockResolvedValue({ isValid: false, queries: [] }); });

test('a visitor past the daily limit is refused by the server before any model or index is called', async () => {
  auth.mockResolvedValue(null); mockDailyCount = 3;
  const response = await explore();
  expect(response.status).toBe(429);
  expect((await response.json()).error).toBe('استخدمت الاستكشافات المجانية الثلاثة اليوم. سجّل الدخول لتتابع داخل مشروعك، أو عد بعد 24 ساعة.');
  expect(plan).not.toHaveBeenCalled();
});

test('a visitor under the limit and a signed-in researcher continue to the exploration', async () => {
  auth.mockResolvedValue(null); mockDailyCount = 2;
  await explore(); expect(plan).toHaveBeenCalledTimes(1);
  auth.mockResolvedValue({ user: { id: 'researcher', user_metadata: {} }, supabase: {} }); mockDailyCount = 10;
  await explore(); expect(plan).toHaveBeenCalledTimes(2);
});
