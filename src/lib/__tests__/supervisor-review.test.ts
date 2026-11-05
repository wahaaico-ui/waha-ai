jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));
import { GET, POST } from '@/app/api/projects/[projectId]/supervisor-review/route';
import { POST as exportTask } from '@/app/api/academic/export/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { parseSupervisorReview, SUPERVISOR_DOCUMENT_TYPE } from '@/lib/supervisor-review';
import { createTableFake } from '@/lib/test-support/table-fake';
const mockDb = createTableFake();
const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const context = { params: Promise.resolve({ projectId }) };
const originalText = 'هذه مسودة اختبار تقيد الاستنتاجات بالسياق الجامعي الحالي وتحتاج إلى مراجعة المشرف.';
const review = { originalText, revisedText: originalText + ' تم توضيح حدود العينة وعدم تعميم السببية.', notes: [{ id: 'ba13fcdb-69a7-41aa-a2c9-c495917bcfa3', comment: 'وضح حدود الاستنتاج وتجنب تعميم السببية.', location: 'فقرة الاستنتاج', response: 'أضفت حدود العينة وقيدت صياغة الاستنتاج.', status: 'addressed' }] };
const post = (body: unknown) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  jest.clearAllMocks(); mockDb.reset();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: mockDb.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  mockDb.constraints.set('documents', (row) => mockDb.rows('documents').some((item) => item.id === row.id) ? '23505' : null);
});
test('saves an immutable review, retries without duplication, restores original and revised text, and exports notes', async () => {
  const response = await POST(post({ ...review, project_id: 'foreign', origin: 'supervisor_approved' }), context);
  expect(response.status).toBe(200); const body = await response.json();
  expect((await POST(post(review), context)).status).toBe(200); expect(mockDb.rows('documents')).toHaveLength(1);
  expect(mockDb.rows('documents')[0]).toMatchObject({ project_id: projectId, type: SUPERVISOR_DOCUMENT_TYPE, version: 1 });
  expect(mockDb.writes.every((write) => write.client === 'service')).toBe(true);
  const restored = await (await GET(new Request('http://localhost'), context)).json();
  expect(restored.reviews[0]).toMatchObject(review);
  const exported = await exportTask(post({ projectId, task: 'supervisor', documentId: body.documentId }));
  expect(exported.status).toBe(200); const markdown = await exported.text();
  expect(markdown).toContain(review.revisedText); expect(markdown).toContain(review.originalText); expect(markdown).toContain(review.notes[0].response);
  expect(markdown).toContain('لا تعني موافقة المشرف');
  const changed = await POST(post({ ...review, revisedText: review.revisedText + ' نسخة جديدة.' }), context);
  expect((await changed.json()).documentId).not.toBe(body.documentId); expect(mockDb.rows('documents')).toHaveLength(2);
});
test('refuses unauthenticated and foreign projects before writing or exporting', async () => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValueOnce(null);
  expect((await POST(post(review), context)).status).toBe(401);
  (ownsProject as jest.Mock).mockResolvedValue(false);
  expect((await POST(post(review), context)).status).toBe(404);
  expect((await GET(new Request('http://localhost'), context)).status).toBe(404);
  expect((await exportTask(post({ projectId, task: 'supervisor', documentId: review.notes[0].id }))).status).toBe(404);
  expect(mockDb.writes).toHaveLength(0);
});
test('a review document from another project cannot be exported', async () => {
  mockDb.seed('documents', { id: review.notes[0].id, project_id: 'foreign', type: SUPERVISOR_DOCUMENT_TYPE, content: JSON.stringify(review) });
  expect((await exportTask(post({ projectId, task: 'supervisor', documentId: review.notes[0].id }))).status).toBe(404);
});
test('changed or deferred notes require an explanation; addressed notes require an actual text change', () => {
  expect(parseSupervisorReview({ ...review, revisedText: originalText })).toBeNull();
  expect(parseSupervisorReview({ ...review, notes: [{ ...review.notes[0], response: '' }] })).toBeNull();
  expect(parseSupervisorReview({ ...review, notes: [{ ...review.notes[0], status: 'deferred', response: '' }] })).toBeNull();
  expect(parseSupervisorReview({ ...review, notes: [...review.notes, ...review.notes] })).toBeNull();
  expect(parseSupervisorReview({ originalText, revisedText: originalText, notes: [] })).not.toBeNull();
});
