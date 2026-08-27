const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

import { GET } from './route';

const projectId = 'project-question-methodology';
const context = { params: Promise.resolve({ projectId }) };

function createDocumentQuery(data: unknown[], error: unknown = null) {
  const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error });
  return query;
}

function authenticatedAccess(query?: ReturnType<typeof createDocumentQuery>) {
  return { user: { id: 'user-a' }, supabase: { from: jest.fn().mockReturnValue(query) } };
}

describe('questions-methodology consistency authorization and evaluation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 401 before reading data when unauthenticated', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    const response = await GET(new Request('https://waha.test/consistency'), context);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(ownsProject).not.toHaveBeenCalled();
  });

  test('returns 404 before reading another user project', async () => {
    const access = authenticatedAccess();
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(false);
    const response = await GET(new Request('https://waha.test/consistency'), context);
    expect(response.status).toBe(404);
    expect(access.supabase.from).not.toHaveBeenCalled();
  });

  test('evaluates only saved questions and methodology for the owner', async () => {
    const base = { project_id: projectId, version: 1, created_at: '2026-08-27T12:00:00.000Z' };
    const query = createDocumentQuery([
      { ...base, id: 'questions-v1', type: 'journey:questions', content: { questions: ['ما أثر المنصات الذكية على التحصيل الأكاديمي لدى طلبة التمريض؟'] } },
      { ...base, id: 'methodology-v1', type: 'journey:methodology', content: { approach: 'quantitative', population: 'طلبة التمريض المستخدمون للمنصات الذكية.', sample: 'عينة طبقية عشوائية من طلبة التمريض.', instrument: 'استبانة محكمة ومقياس للتحصيل الأكاديمي.' } },
    ]);
    const access = authenticatedAccess(query);
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);
    const response = await GET(new Request('https://waha.test/consistency'), context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.report.checkType).toBe('question_methodology_consistency');
    expect(body.report.status).toBe('passed');
    expect(query.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(query.in).toHaveBeenCalledWith('type', ['journey:questions', 'journey:methodology']);
  });

  test('returns a generic 500 without leaking database errors', async () => {
    const query = createDocumentQuery([], { message: 'sensitive database details' });
    const access = authenticatedAccess(query);
    requireAuthenticatedUser.mockResolvedValue(access);
    ownsProject.mockResolvedValue(true);
    const response = await GET(new Request('https://waha.test/consistency'), context);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Unable to evaluate project consistency' });
    expect(JSON.stringify(body)).not.toContain('sensitive database details');
  });
});
