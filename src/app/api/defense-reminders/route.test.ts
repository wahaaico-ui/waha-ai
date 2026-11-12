const requireAuthenticatedUser = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args) }));

import { GET } from './route';

const chain = (result: unknown, calls: unknown[][]) => {
  const node: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'in', 'order', 'limit']) node[name] = (...args: unknown[]) => { calls.push([name, ...args]); return node; };
  node.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return node;
};
const plan = (defenseDate: string) => JSON.stringify({ version: 1, defenseDate, done: [], reminderSentAt: null });

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-11-20T09:00:00Z')); });
afterEach(() => jest.useRealTimers());

test('a signed-out visitor gets no reminders', async () => {
  requireAuthenticatedUser.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
});

test('lists only the account\'s own projects whose latest saved defense is within two weeks', async () => {
  const calls: unknown[][] = [];
  requireAuthenticatedUser.mockResolvedValue({ user: { id: 'u1' }, supabase: { from: (table: string) => table === 'projects'
    ? chain({ data: [{ id: 'p1', title: 'أ' }, { id: 'p2', title: 'ب' }, { id: 'p3', title: 'ج' }], error: null }, calls)
    : chain({ data: [
      { project_id: 'p1', content: plan('2026-11-25') }, { project_id: 'p1', content: plan('2027-01-01') },
      { project_id: 'p2', content: plan('2027-01-10') }, { project_id: 'p3', content: plan('2026-11-19') },
    ], error: null }, calls) } });
  const body = await (await GET()).json();
  expect(body.reminders).toEqual([{ projectId: 'p1', title: 'أ', defenseDate: '2026-11-25', daysLeft: 5 }]);
  expect(calls).toContainEqual(['eq', 'user_id', 'u1']);
});
