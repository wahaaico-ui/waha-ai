const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
const isProjectEmailConfigured = jest.fn();
const sendProjectSnapshotEmail = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

jest.mock('@/lib/email/resend', () => ({
  isProjectEmailConfigured: (...args: unknown[]) => isProjectEmailConfigured(...args),
  sendProjectSnapshotEmail: (...args: unknown[]) => sendProjectSnapshotEmail(...args),
}));

import { POST } from './route';
import { createTableFake } from '@/lib/test-support/table-fake';

const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';

function terminalQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, jest.Mock> = {};
  let offset = 0;
  for (const method of ['select', 'eq', 'in', 'like', 'neq', 'order', 'limit']) {
    query[method] = jest.fn().mockReturnValue(query);
  }
  query.maybeSingle = jest.fn().mockResolvedValue(result);
  query.range = jest.fn((from: number) => { offset = from; return query; });
  query.then = jest.fn(resolve => Promise.resolve({ ...result, data: offset === 0 && result.data ? [result.data] : [] }).then(resolve));
  return query;
}

type QueryResult = { data: unknown; error: unknown };

function authenticatedAccess(projectResult: QueryResult = { data: { id: projectId, title: 'مشروع الباحث' }, error: null }, documentResult: QueryResult = {
  data: {
    id: 'document-1',
    type: 'journey:problem',
    content: JSON.stringify({ problemStatement: 'مشكلة بحث موثقة', researchGap: 'فجوة محلية' }),
    version: 2,
    created_at: '2026-08-30T10:00:00.000Z',
  },
  error: null,
}, draftResult: QueryResult = { data: null, error: null }) {
  const projectQuery = terminalQuery({ ...projectResult, data: projectResult.data ? { created_at: '2026-08-01T00:00:00Z', status: 'draft', ...projectResult.data as object } : null });
  const documentQuery = terminalQuery({ ...documentResult, data: documentResult.data ? { project_id: projectId, ...documentResult.data as object } : null });
  const draftQuery = terminalQuery({ ...draftResult, data: draftResult.data ? { project_id: projectId, ...draftResult.data as object } : null });
  return {
    projectQuery,
    documentQuery,
    access: {
      user: {
        id: 'user-a',
        email: 'owner@example.com',
        user_metadata: { full_name: 'الباحث أحمد' },
      },
      supabase: {
        from: jest.fn((table: string) => table === 'projects'
          ? projectQuery
          : table === 'research_stage_drafts'
            ? draftQuery
            : documentQuery),
      },
    },
  };
}

function request(body: unknown = { projectId }) {
  return new Request('https://waha.test/api/email/project-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('project snapshot email route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isProjectEmailConfigured.mockReturnValue(true);
    sendProjectSnapshotEmail.mockResolvedValue({ id: 'email-1' });
  });

  test('returns 401 before reading a project when no user is authenticated', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(response.headers.get('x-waha-request-id')).toBe(body.requestId);
    expect(ownsProject).not.toHaveBeenCalled();
    expect(sendProjectSnapshotEmail).not.toHaveBeenCalled();
  });

  test('returns 404 and never sends when the authenticated user does not own the project', async () => {
    const { access } = authenticatedAccess();
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith(projectId, 'user-a', access.supabase);
    expect(access.supabase.from).not.toHaveBeenCalled();
    expect(sendProjectSnapshotEmail).not.toHaveBeenCalled();
  });

  test('returns a clear 503 without querying content when email delivery is not configured', async () => {
    const { access } = authenticatedAccess();
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);
    isProjectEmailConfigured.mockReturnValue(false);
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.code).toBe('EMAIL_NOT_CONFIGURED');
    expect(access.supabase.from).not.toHaveBeenCalled();
  });

  test('sends only the latest owned content to the authenticated account email', async () => {
    const { access, projectQuery, documentQuery } = authenticatedAccess();
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);
    const response = await POST(request({ projectId, email: 'attacker@example.com', content: 'forged' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, sentTo: 'ow***@example.com' });
    expect(projectQuery.eq).toHaveBeenCalledWith('user_id', 'user-a');
    expect(documentQuery.in).toHaveBeenCalledWith('project_id', [projectId]);
    expect(documentQuery.in).toHaveBeenCalledWith('type', expect.arrayContaining(['evidence-writing:v1', 'journey:supervisor_review']));
    expect(sendProjectSnapshotEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      subject: expect.stringContaining('مشروع الباحث'),
      text: expect.stringContaining('مشكلة بحث موثقة'),
      idempotencyKey: expect.stringContaining(projectId),
    }));
    expect(JSON.stringify(sendProjectSnapshotEmail.mock.calls)).not.toContain('attacker@example.com');
    expect(JSON.stringify(sendProjectSnapshotEmail.mock.calls)).not.toContain('forged');
  });

  test('returns 409 when the owned project has no saved journey output', async () => {
    const { access } = authenticatedAccess(
      { data: { id: projectId, title: 'مشروع الباحث' }, error: null },
      { data: null, error: null },
    );
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(sendProjectSnapshotEmail).not.toHaveBeenCalled();
  });

  test('prefers a newer autosaved draft and labels it honestly', async () => {
    const { access } = authenticatedAccess(
      { data: { id: projectId, title: 'مشروع الباحث' }, error: null },
      {
        data: {
          id: 'document-1',
          type: 'journey:problem',
          content: JSON.stringify({ problemStatement: 'نسخة معتمدة أقدم' }),
          version: 2,
          created_at: '2026-08-30T10:00:00.000Z',
        },
        error: null,
      },
      {
        data: {
          stage: 'objectives',
          content: { objectives: ['مسودة هدف حديثة'] },
          client_updated_at: '2026-08-30T11:00:00.000Z',
          updated_at: '2026-08-30T11:00:01.000Z',
        },
        error: null,
      },
    );
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(sendProjectSnapshotEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      subject: expect.stringContaining('مسودة محفوظة تلقائياً'),
      text: expect.stringContaining('مسودة هدف حديثة'),
      idempotencyKey: expect.stringContaining('draft-objectives'),
    }));
    expect(JSON.stringify(sendProjectSnapshotEmail.mock.calls)).not.toContain('نسخة معتمدة أقدم');
  });
});

test.each([
  ['evidence-writing:v1', { text: 'Latest saved writing manuscript.', citations: [] }, 'Latest saved writing manuscript.'],
  ['journey:supervisor_review', { originalText: 'Original academic paragraph before review.', revisedText: 'Latest saved supervisor revision.', notes: [] }, 'Latest saved supervisor revision.'],
  ['journey:language_task', { operation: 'translate', text: 'Original academic paragraph.', output: 'Latest saved translation output.', targetLanguage: 'en', status: 'completed' }, 'Latest saved translation output.'],
])('emails the same latest %s shown in the dashboard without sending a previous stage', async (type, content, expected) => {
  jest.clearAllMocks();isProjectEmailConfigured.mockReturnValue(true);sendProjectSnapshotEmail.mockResolvedValue({ id: 'mock-only' });ownsProject.mockResolvedValue(true);
  const db = createTableFake({ strictQuery: true, serverRowLimit: 2 });
  db.seed('projects', { id: projectId, user_id: 'user-a', title: 'Research project', status: 'draft', created_at: '2026-08-01T00:00:00Z' });
  db.seed('documents', { id: 'older', project_id: projectId, type: 'journey:title', version: 1, content: JSON.stringify({ title: 'Do not email this older research title' }), created_at: '2026-09-01T00:00:00Z' });
  db.seed('documents', { id: 'newest', project_id: projectId, type, version: 1, content: JSON.stringify(content), created_at: '2026-10-20T00:00:00Z' });
  requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a', email: 'owner@example.com', user_metadata: {} }, supabase: db.session });
  const response = await POST(request());
  expect(response.status).toBe(200);
  const message = sendProjectSnapshotEmail.mock.calls[0][0];
  expect(message.text).toContain(expected);
  expect(message.text).not.toContain('Do not email this older research title');
  expect(message.text).not.toContain('مخرج معتمد');
  expect(message.to).toBe('owner@example.com');
  expect(message.idempotencyKey).toContain('newest');
  expect(db.writes).toHaveLength(0);
});
