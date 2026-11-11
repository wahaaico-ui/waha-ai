const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));

import { GET } from './route';

const projectId = 'eb52bade-75cb-4bd0-a1d3-d5681650a00e';
const context = { params: Promise.resolve({ projectId }) };
const base = { project_id: projectId, version: 1, created_at: '2026-11-11T12:00:00.000Z' };

function access(rows: unknown[], error: unknown = null) {
  const query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: rows, error });
  return { access: { user: { id: 'user-a' }, supabase: { from: jest.fn().mockReturnValue(query) } }, query };
}

const call = () => GET(new Request(`https://waha.systems/api/projects/${projectId}/consistency/map`), context);

describe('consistency map route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ownsProject.mockResolvedValue(true);
  });

  test('requires sign-in and project ownership before reading documents', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    const { access: owner, query } = access([]);
    requireAuthenticatedUser.mockResolvedValue(owner);
    ownsProject.mockResolvedValue(false);
    expect((await call()).status).toBe(404);
    expect(query.select).not.toHaveBeenCalled();
  });

  test('reads only the owner\'s journey stages and returns the map privately', async () => {
    const { access: owner, query } = access([
      { ...base, id: 'problem-v1', type: 'journey:problem', content: { problemStatement: 'يعاني طلبة التمريض من ضعف التحصيل عند استخدام منصات التعلم الإلكتروني.', researchGap: 'فجوة محلية.' } },
      { ...base, id: 'objectives-v1', type: 'journey:objectives', content: { objectives: ['قياس أثر منصات التعلم الإلكتروني على تحصيل طلبة التمريض.'] } },
    ]);
    requireAuthenticatedUser.mockResolvedValue(owner);
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(query.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(query.in).toHaveBeenCalledWith('type', ['journey:problem', 'journey:objectives', 'journey:questions', 'journey:hypotheses', 'journey:methodology']);
    const { map } = await response.json();
    expect(map.problem.kind).toBe('problem');
    expect(map.chains).toHaveLength(1);
    expect(map).not.toHaveProperty('score');
  });

  test('does not expose a database error', async () => {
    const { access: owner } = access([], { message: 'relation documents does not exist' });
    requireAuthenticatedUser.mockResolvedValue(owner);
    const response = await call();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('relation');
  });
});
