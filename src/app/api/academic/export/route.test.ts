const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));
import { POST } from './route';
import { createTableFake } from '@/lib/test-support/table-fake';
import { guideRuleCandidates, saveGuideEnvelope } from '@/lib/guide-workflow';

const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const from = jest.fn();
const request = (body: string = JSON.stringify({ projectId })) => new Request('https://waha.test/api/academic/export', { method: 'POST', body });
function storageFixture(title = 'بحث') {
  const db = createTableFake({ strictQuery: true });
  db.seed('projects', { id: projectId, title, university_policy: null });
  db.seed('documents', { project_id: projectId, type: 'journey:problem', version: 1, content: '{"problemStatement":"نص محفوظ"}' });
  from.mockImplementation(db.session.from);
  return db;
}
describe('private project export', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requireAuthenticatedUser.mockResolvedValue({ user: { id: 'owner' }, supabase: { from } });
    ownsProject.mockResolvedValue(true);
  });
  it('requires login before reading any data', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects another owner before querying content', async () => {
    ownsProject.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });
  it.each(['{broken', 'null', '{"projectId":123}', JSON.stringify({ projectId, format: 'epub' })])('rejects malformed or unsupported request %s', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('returns a private Markdown attachment with readable stored content', async () => {
    storageFixture();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(await response.text()).toContain('نص محفوظ');
  });
  it('blocks an export that contradicts an approved citation rule', async () => {
    const db = storageFixture();
    const text = 'نظام التوثيق: APA 7';
    db.rows('projects')[0].university_policy = saveGuideEnvelope(text, guideRuleCandidates(text).map(rule => ({ ...rule, status: 'approved' as const })));
    const response = await POST(request(JSON.stringify({ projectId, citationStyle: 'ieee' })));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('APA 7');
  });
  it.each([
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK'],
    ['pdf', 'application/pdf', '%PDF'],
  ])('returns a real %s attachment', async (format, contentType, signature) => {
    storageFixture('بحث عربي');
    const response = await POST(request(JSON.stringify({ projectId, format })));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(contentType);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, signature.length).toString()).toBe(signature);
    expect(bytes.length).toBeGreaterThan(1_000);
  }, 30_000);
  it('does not expose database exceptions', async () => {
    from.mockImplementation(() => { throw new Error('private database detail'); });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private database detail');
  });
  it('filters library by owner and fails instead of silently dropping inaccessible references', async () => {
    const db = storageFixture(); const ownerFilter = jest.fn(); const projectFilter = jest.fn();
    const unavailable = {
      select: () => unavailable,
      eq: (key: string, value: unknown) => { (key === 'project_id' ? projectFilter : ownerFilter)(key, value); return unavailable; },
      order: () => unavailable,
      range: async () => ({ data: null, error: { message: 'denied' }, count: null }),
    };
    from.mockImplementation((table: string) => table === 'project_references' ? unavailable : db.session.from(table));
    const response = await POST(request());
    expect(projectFilter).toHaveBeenCalledWith('project_id', projectId);
    expect(ownerFilter).toHaveBeenCalledWith('user_id', 'owner');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('denied');
  });
});
