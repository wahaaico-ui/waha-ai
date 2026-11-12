const authoriseProject = jest.fn();
const insert = jest.fn();
jest.mock('@/lib/research-project-access', () => ({ authoriseProject: (...args: unknown[]) => authoriseProject(...args) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert: async (row: unknown) => { insert(row); return { error: null }; } }) }) }));

import { GET, PUT } from './route';

let latest: unknown = null;
const chain = (result: unknown) => {
  const node: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'order', 'limit', 'like']) node[name] = () => node;
  node.maybeSingle = async () => result;
  node.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return node;
};
const owned = () => authoriseProject.mockResolvedValue({ ok: true, projectId: '11111111-1111-4111-8111-111111111111', access: { user: { id: 'u1' }, supabase: { from: () => chain({ data: latest, error: null }) } } });
const context = { params: Promise.resolve({ projectId: '11111111-1111-4111-8111-111111111111' }) };
const put = (body: unknown) => PUT(new Request('https://waha.systems/x', { method: 'PUT', body: JSON.stringify(body) }), context);

beforeEach(() => { jest.clearAllMocks(); latest = null; });

describe('defense plan route (DOC-38-03)', () => {
  test('another account\'s project is refused before anything is read or saved', async () => {
    authoriseProject.mockResolvedValue({ ok: false, response: new Response(null, { status: 404 }) });
    expect((await GET(new Request('https://waha.systems/x'), context)).status).toBe(404);
    expect((await put({ defenseDate: '2026-12-01', done: [] })).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  test('a date that is not a real calendar day is rejected', async () => {
    owned();
    expect((await put({ defenseDate: '2026-02-30', done: [] })).status).toBe(400);
    expect((await put({ defenseDate: '2026-12-01' })).status).toBe(400);
  });

  test('saving ticks keeps a reminder already sent for the same date; a new date resets it', async () => {
    owned();
    latest = { content: JSON.stringify({ version: 1, defenseDate: '2026-12-01', done: [], reminderSentAt: '2026-11-17T06:00:00.000Z' }) };
    expect((await (await put({ defenseDate: '2026-12-01', done: ['slides', 'unknown'] })).json()).plan).toEqual({ version: 1, defenseDate: '2026-12-01', done: ['slides'], reminderSentAt: '2026-11-17T06:00:00.000Z' });
    expect((await (await put({ defenseDate: '2026-12-08', done: ['slides'] })).json()).plan.reminderSentAt).toBeNull();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toMatchObject({ project_id: '11111111-1111-4111-8111-111111111111', type: 'defense-plan:v1' });
  });
});
