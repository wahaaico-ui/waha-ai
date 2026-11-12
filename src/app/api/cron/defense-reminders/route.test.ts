const insert = jest.fn();
const sendTransactionalEmail = jest.fn();
let planRows: Array<{ project_id: string; content: string }> = [];
let emailConfigured = true;

jest.mock('@/lib/email/resend', () => ({
  isProjectEmailConfigured: () => emailConfigured,
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmail(...args),
}));
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => {
    const chain = (result: unknown) => {
      const node: Record<string, unknown> = {};
      for (const name of ['select', 'eq', 'order', 'limit']) node[name] = () => node;
      node.maybeSingle = async () => result;
      node.then = (resolve: (value: unknown) => unknown) => resolve(result);
      return node;
    };
    return {
      from: (table: string) => table === 'projects'
        ? { select: () => chain({ data: { title: 'التعليم الإلكتروني', user_id: 'user-1' }, error: null }) }
        : { select: () => chain({ data: planRows, error: null, ...{} }), insert: async (row: { content: string; project_id: string }) => { insert(row); planRows = [{ project_id: row.project_id, content: row.content }, ...planRows]; return { error: null }; } },
      auth: { admin: { getUserById: async () => ({ data: { user: { email: 'owner@example.org', email_confirmed_at: '2026-01-01T00:00:00Z' } } }) } },
    };
  },
}));

import { GET } from './route';

const run = (secret?: string) => GET(new Request('https://waha.systems/api/cron/defense-reminders', { headers: secret ? { authorization: `Bearer ${secret}` } : {} }));
const plan = (defenseDate: string, reminderSentAt: string | null = null) => JSON.stringify({ version: 1, defenseDate, done: ['slides'], reminderSentAt });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'cron-test-secret';
  emailConfigured = true;
  planRows = [{ project_id: 'p1', content: plan('2026-12-01') }];
  jest.useFakeTimers().setSystemTime(new Date('2026-11-17T06:00:00Z'));
});
afterEach(() => { jest.useRealTimers(); delete process.env.CRON_SECRET; });

describe('defense reminder job (DOC-38-03)', () => {
  test('only Vercel, holding the secret, may run it', async () => {
    expect((await run()).status).toBe(401);
    expect((await run('wrong')).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await run('cron-test-secret')).status).toBe(503);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  test('without a mail service nothing is sent or recorded', async () => {
    emailConfigured = false;
    expect((await run('cron-test-secret')).status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });

  test('with the clock at fourteen days before, the reminder goes out once and is recorded', async () => {
    expect(await (await run('cron-test-secret')).json()).toEqual({ sent: 1, failed: 0 });
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.org', idempotencyKey: 'defense-reminder:p1:2026-12-01', subject: expect.stringContaining('14') }));
    expect(JSON.parse(insert.mock.calls[0][0].content)).toMatchObject({ defenseDate: '2026-12-01', done: ['slides'], reminderSentAt: '2026-11-17T06:00:00.000Z' });

    jest.setSystemTime(new Date('2026-11-18T06:00:00Z'));
    expect(await (await run('cron-test-secret')).json()).toEqual({ sent: 0, failed: 0 });
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  test('a defense more than two weeks away is not reminded yet', async () => {
    jest.setSystemTime(new Date('2026-11-16T06:00:00Z'));
    expect(await (await run('cron-test-secret')).json()).toEqual({ sent: 0, failed: 0 });
  });
});
