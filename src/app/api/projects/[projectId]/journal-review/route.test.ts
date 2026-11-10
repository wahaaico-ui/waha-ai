const authoriseProject = jest.fn();
const insert = jest.fn();
jest.mock('@/lib/research-project-access', () => ({ authoriseProject: (...args: unknown[]) => authoriseProject(...args) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert }) }) }));

import { NextResponse } from 'next/server';
import { POST as postReview } from './route';
import { PUT as putTemplate } from '../journal-template/route';
import { JOURNAL_PRESETS } from '@/lib/journal-template';

const projectId = '33333333-3333-4333-8333-333333333333';
const context = { params: Promise.resolve({ projectId }) };
const request = (body: unknown, method = 'POST') => new Request('https://waha.systems/x', { method, body: JSON.stringify(body) });
const round = { journal: 'J', round: 1, decision: 'minor', comments: [{ id: '00000001-0000-4000-8000-000000000001', reviewer: 'editor', comment: 'وضّح حجم العينة', location: '', response: '', status: 'open' }] };

describe('journal template and review routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authoriseProject.mockResolvedValue({ ok: true, projectId, access: { user: { id: 'u1' }, supabase: {} } });
    insert.mockResolvedValue({ error: null });
  });

  test('only the owner can save either one', async () => {
    authoriseProject.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) });
    expect((await postReview(request(round), context)).status).toBe(404);
    expect((await putTemplate(request(JOURNAL_PRESETS.imrad, 'PUT'), context)).status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });

  test('saves a valid review round as a server-written snapshot', async () => {
    expect((await postReview(request(round), context)).status).toBe(200);
    expect(insert.mock.calls[0][0]).toMatchObject({ project_id: projectId, type: 'journal-review:v1', version: 1 });
  });

  test('rejects an invalid round and an invalid template without saving', async () => {
    expect((await postReview(request({ ...round, comments: [] }), context)).status).toBe(400);
    expect((await putTemplate(request({ ...JOURNAL_PRESETS.imrad, sections: ['appendix'] }, 'PUT'), context)).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  test('saves a valid template', async () => {
    expect((await putTemplate(request(JOURNAL_PRESETS.review, 'PUT'), context)).status).toBe(200);
    expect(insert.mock.calls[0][0]).toMatchObject({ type: 'journal-template:v1' });
  });
});
