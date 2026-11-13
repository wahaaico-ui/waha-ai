const row = jest.fn();
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ in: () => ({ maybeSingle: async () => row() }) }) }) }) }),
}));
import { hasPaidPlan } from '@/lib/billing/entitlements';

describe('a paid plan removes the mark only while it is active', () => {
  test('no subscription, an expired one, or a failed lookup is the free plan', async () => {
    row.mockReturnValue({ data: null, error: null });
    expect(await hasPaidPlan('user')).toBe(false);
    row.mockReturnValue({ data: { plan: 'pro', status: 'active', current_period_end: '2000-01-01T00:00:00Z' }, error: null });
    expect(await hasPaidPlan('user')).toBe(false);
    row.mockReturnValue({ data: null, error: { message: 'down' } });
    expect(await hasPaidPlan('user')).toBe(false);
    expect(await hasPaidPlan(' ')).toBe(false);
    row.mockImplementation(() => { throw new Error('no service key'); });
    expect(await hasPaidPlan('user')).toBe(false);
    row.mockReset();
  });

  test('an active Pro, Expert or institutional subscription is paid', async () => {
    for (const plan of ['pro', 'expert', 'institutional', 'researcher']) {
      row.mockReturnValue({ data: { plan, status: 'active', current_period_end: '2999-01-01T00:00:00Z' }, error: null });
      expect(await hasPaidPlan('user')).toBe(true);
    }
    row.mockReturnValue({ data: { plan: 'unknown', status: 'active', current_period_end: null }, error: null });
    expect(await hasPaidPlan('user')).toBe(false);
  });
});
