const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));
import { POST } from './route';

const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const from = jest.fn();
const request = (body: string = JSON.stringify({ projectId })) => new Request('https://waha.test/api/academic/export', { method: 'POST', body });
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
    from.mockImplementation((table: string) => ({ select: () => ({ eq: () => table === 'projects'
      ? { single: async () => ({ data: { title: 'بحث', university_policy: null } }) }
      : table === 'documents' ? { order: async () => ({ data: [{ type: 'journey:problem', version: 1, content: '{"problemStatement":"نص محفوظ"}' }] }) }
      : table === 'project_references' ? { eq: () => ({ order: async () => ({ data: [] }) }) }
      : Promise.resolve({ data: [] }) }) }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(await response.text()).toContain('نص محفوظ');
  });
  it.each([
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK'],
    ['pdf', 'application/pdf', '%PDF'],
  ])('returns a real %s attachment', async (format, contentType, signature) => {
    from.mockImplementation((table: string) => ({ select: () => ({ eq: () => table === 'projects'
      ? { single: async () => ({ data: { title: 'بحث عربي', university_policy: null } }) }
      : table === 'documents' ? { order: async () => ({ data: [{ type: 'journey:problem', version: 1, content: '{"problemStatement":"نص محفوظ"}' }] }) }
      : table === 'project_references' ? { eq: () => ({ order: async () => ({ data: [] }) }) }
      : Promise.resolve({ data: [] }) }) }));
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
    const ownerFilter = jest.fn(() => ({ order: async () => ({ data: null, error: { message: 'denied' } }) }));
    const projectFilter = jest.fn(() => ({ eq: ownerFilter }));
    from.mockImplementation((table: string) => ({ select: () => table === 'project_references' ? { eq: projectFilter } : ({ eq: () => table === 'projects'
      ? { single: async () => ({ data: { title: 'بحث', university_policy: null } }) }
      : table === 'documents' ? { order: async () => ({ data: [] }) }
      : Promise.resolve({ data: [] }) }) }));
    const response = await POST(request());
    expect(projectFilter).toHaveBeenCalledWith('project_id', projectId);
    expect(ownerFilter).toHaveBeenCalledWith('user_id', 'owner');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('denied');
  });
});
