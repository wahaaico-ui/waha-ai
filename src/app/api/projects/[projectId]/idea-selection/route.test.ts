const authoriseProject = jest.fn();
const insert = jest.fn();
jest.mock('@/lib/research-project-access', () => ({ authoriseProject: (...args: unknown[]) => authoriseProject(...args) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert }) }) }));

import { NextResponse } from 'next/server';
import { GET, PUT } from './route';

const projectId = '33333333-3333-4333-8333-333333333333';
const context = { params: Promise.resolve({ projectId }) };
let latest: { content: string } | null = null;

function ownerSession() {
  const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain, maybeSingle: async () => ({ data: latest, error: null }) };
  return { ok: true, projectId, access: { user: { id: 'u1' }, supabase: { from: () => chain } } };
}

const put = (body: unknown) => PUT(new Request('https://waha.systems/x', { method: 'PUT', body: JSON.stringify(body) }), context);

describe('idea selection route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latest = null;
    authoriseProject.mockResolvedValue(ownerSession());
    insert.mockResolvedValue({ error: null });
  });

  test('only the owner can read or save', async () => {
    authoriseProject.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) });
    expect((await GET(new Request('https://waha.systems/x'), context)).status).toBe(404);
    expect((await put({ answers: {}, ratings: [] })).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  test('returns empty answers and ratings before anything is saved', async () => {
    const body = await (await GET(new Request('https://waha.systems/x'), context)).json();
    expect(body).toEqual({ answers: {}, constraints: {}, ratings: [], savedAt: null });
  });

  test('saves the quick access, data and time answers with the snapshot', async () => {
    const constraints = { access: 'partly', data: 'no', time: 'short' };
    expect((await put({ answers: { time: 'فصل دراسي' }, constraints, ratings: [] })).status).toBe(200);
    expect(JSON.parse(insert.mock.calls[0][0].content)).toMatchObject({ answers: { time: 'فصل دراسي' }, constraints });
  });

  test('rejects a quick answer that was not offered, without saving', async () => {
    expect((await put({ answers: {}, constraints: { time: 'forever' }, ratings: [] })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  test('reads back the quick answers, and an older snapshot without them as unanswered', async () => {
    latest = { content: JSON.stringify({ answers: {}, constraints: { access: 'yes' }, ratings: [], savedAt: '2026-11-11T10:00:00.000Z' }) };
    expect((await (await GET(new Request('https://waha.systems/x'), context)).json()).constraints).toEqual({ access: 'yes' });
    latest = { content: JSON.stringify({ answers: { time: 'سنة' }, ratings: [], savedAt: '2026-11-06T10:00:00.000Z' }) };
    expect((await (await GET(new Request('https://waha.systems/x'), context)).json()).constraints).toEqual({});
  });

  test('saves valid answers and ratings as a server-written snapshot', async () => {
    const response = await put({ answers: { interest: 'الأثر على الطلبة' }, ratings: [{ pathId: 'p1', passion: 5, feasibility: 4 }] });
    expect(response.status).toBe(200);
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({ project_id: projectId, type: 'idea-selection:v1', version: 1 });
    expect(JSON.parse(row.content)).toMatchObject({ answers: { interest: 'الأثر على الطلبة' }, ratings: [{ pathId: 'p1', passion: 5, feasibility: 4 }] });
  });

  test('rejects invalid ratings without saving', async () => {
    expect((await put({ answers: {}, ratings: [{ pathId: 'p1', passion: 9, feasibility: 1 }] })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  test('reads back the latest saved snapshot', async () => {
    latest = { content: JSON.stringify({ answers: { time: 'ستة أشهر' }, ratings: [], savedAt: '2026-11-06T10:00:00.000Z' }) };
    const body = await (await GET(new Request('https://waha.systems/x'), context)).json();
    expect(body.answers).toEqual({ time: 'ستة أشهر' });
  });
});
