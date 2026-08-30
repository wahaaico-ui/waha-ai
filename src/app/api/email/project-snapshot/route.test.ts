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

const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';

function terminalQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'like', 'neq', 'order', 'limit']) {
    query[method] = jest.fn().mockReturnValue(query);
  }
  query.maybeSingle = jest.fn().mockResolvedValue(result);
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
}) {
  const projectQuery = terminalQuery(projectResult);
  const documentQuery = terminalQuery(documentResult);
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
        from: jest.fn((table: string) => table === 'projects' ? projectQuery : documentQuery),
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
    expect(response.status).toBe(401);
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
    expect(documentQuery.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(documentQuery.neq).toHaveBeenCalledWith('type', 'journey:decision');
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
});
