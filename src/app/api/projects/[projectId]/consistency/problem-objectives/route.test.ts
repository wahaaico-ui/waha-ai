const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

import { GET } from './route';

const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';
const context = { params: Promise.resolve({ projectId }) };

function createDocumentQuery(data: unknown[], error: unknown = null) {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order
    .mockReturnValueOnce(query)
    .mockResolvedValueOnce({ data, error });

  return query;
}

function authenticatedAccess(query?: ReturnType<typeof createDocumentQuery>) {
  return {
    user: { id: 'user-a' },
    supabase: {
      from: jest.fn().mockReturnValue(query),
    },
  };
}

describe('problem-objectives consistency authorization and evaluation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 before reading any project when no Supabase user is authenticated', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(
      new Request(`https://waha.test/api/projects/${projectId}/consistency/problem-objectives`),
      context,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('returns 404 without reading documents when user A requests user B project', async () => {
    const access = authenticatedAccess();
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(false);

    const response = await GET(
      new Request(`https://waha.test/api/projects/${projectId}/consistency/problem-objectives`),
      context,
    );

    expect(response.status).toBe(404);
    expect(ownsProject).toHaveBeenCalledWith(projectId, 'user-a', access.supabase);
    expect(access.supabase.from).not.toHaveBeenCalled();
  });

  test('evaluates only the authenticated owner saved problem and objectives', async () => {
    const query = createDocumentQuery([
      {
        id: 'problem-v1',
        project_id: projectId,
        type: 'journey:problem',
        content: JSON.stringify({
          problemStatement: 'انخفاض المشاركة الأكاديمية لدى طلبة الجامعات في التعلم الإلكتروني',
          researchGap: 'نقص الأدلة حول العوامل المؤثرة في المشاركة الأكاديمية',
        }),
        version: 1,
        created_at: '2026-08-27T10:00:00.000Z',
      },
      {
        id: 'objectives-v1',
        project_id: projectId,
        type: 'journey:objectives',
        content: JSON.stringify({
          objectives: [
            'قياس مستوى المشاركة الأكاديمية لدى طلبة الجامعات في التعلم الإلكتروني',
            'تحليل العوامل المؤثرة في المشاركة الأكاديمية لدى طلبة الجامعات',
          ],
        }),
        version: 1,
        created_at: '2026-08-27T10:05:00.000Z',
      },
    ]);
    const access = authenticatedAccess(query);
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);

    const response = await GET(
      new Request(`https://waha.test/api/projects/${projectId}/consistency/problem-objectives`),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projectId).toBe(projectId);
    expect(body.report.checkType).toBe('problem_objective_consistency');
    expect(body.report.formulaVersion).toBe('problem-objective-consistency/v1');
    expect(body.report.objectiveIds).toHaveLength(2);
    expect(body.evaluatedDocuments).toHaveLength(2);
    expect(query.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(query.in).toHaveBeenCalledWith('type', ['journey:problem', 'journey:objectives']);
  });

  test('returns a generic 500 response without leaking database errors', async () => {
    const query = createDocumentQuery([], { message: 'sensitive database details' });
    const access = authenticatedAccess(query);
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);

    const response = await GET(
      new Request(`https://waha.test/api/projects/${projectId}/consistency/problem-objectives`),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Unable to evaluate project consistency' });
    expect(JSON.stringify(body)).not.toContain('sensitive database details');
  });
});
