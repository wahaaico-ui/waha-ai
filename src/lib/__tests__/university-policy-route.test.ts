jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/university-guide-server', () => ({ extractUniversityGuide: jest.fn() }));
import { randomUUID } from 'node:crypto';
import { GET, PATCH, POST } from '@/app/api/academic/projects/policy/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { extractUniversityGuide } from '@/lib/university-guide-server';
import { UNIVERSITY_POLICY_MAX_CHARS } from '@/lib/university-policy';
import { guideRuleCandidates } from '@/lib/guide-workflow';

const db = createTableFake(), projectId = randomUUID(), userId = randomUUID();
const request = (universityPolicy: unknown, expectedPolicy: string | null = null) => new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ projectId, universityPolicy, expectedPolicy }) });
const load = (id = projectId) => new Request(`http://localhost?projectId=${id}`);
const upload = (type = 'application/pdf', id = projectId) => {
  const form = new FormData(); form.set('projectId', id); form.set('file', new File(['%PDF-1.7\nDeclared mocked-parser fixture'], 'guide.pdf', { type }));
  return new Request('http://localhost', { method: 'POST', body: form });
};
beforeEach(() => {
  db.reset(); jest.clearAllMocks();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: userId }, supabase: db.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  db.rows('projects').push({ id: projectId, user_id: userId, university_policy: null });
  (extractUniversityGuide as jest.Mock).mockResolvedValue({ text: 'Use APA 7 and preserve original quotations.', totalPages: 2, emptyPages: [] });
});
test('rejects a filename masquerading as the actual university guide', async () => {
  expect((await PATCH(request('Manual PDF Upload: university.pdf'))).status).toBe(422);
  expect(db.writes).toHaveLength(0);
});
test('rejects an object instead of instruction text without writing it to the project', async () => {
  expect((await PATCH(request({ text: 'forged structure' }))).status).toBe(422);
  expect(db.writes).toHaveLength(0);
});
test('does not confirm success when no owned project was updated', async () => {
  db.rows('projects')[0].user_id = randomUUID();
  expect((await PATCH(request('Use APA 7 and preserve original quotations.'))).status).toBe(404);
  expect(db.writes).toHaveLength(0);
});
test('reviewed text saves and reloads exactly, including Arabic, numeric signs and literal markup', async () => {
  const policy = 'الجامعة: توثيق APA 7\nUse p < .05 and 95% CI, ±2.\n<script>alert(1)</script>';
  const response = await PATCH(request(policy)); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ saved: true, projectId, universityPolicy: policy });
  const restored = await GET(load()); expect(restored.headers.get('cache-control')).toContain('no-store');
  expect(await restored.json()).toEqual({ projectId, universityPolicy: policy, legacyFileName: null });
});
test('approved guide rules persist atomically with the guide and reload with evidence', async () => {
  const policy = 'حجم المتن العربي: 14 نقطة\nالهامش العلوي: 3 سم';
  const rules = guideRuleCandidates(policy).map(rule => ({ ...rule, status: 'approved' as const }));
  const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ projectId, universityPolicy: policy, expectedPolicy: null, rules }) }));
  expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.storedPolicy).toContain('WAHA_GUIDE_V1:');
  const restored = await (await GET(load())).json();
  expect(restored).toMatchObject({ universityPolicy: policy, rules });
  expect(restored.storedPolicy).toBe(saved.storedPolicy);
});
test('different stale edits conflict, while an identical retry does not overwrite the saved instructions', async () => {
  const first = 'First reviewed university instructions.';
  expect((await PATCH(request(first))).status).toBe(200);
  expect((await PATCH(request('Another reviewed set of instructions.'))).status).toBe(409);
  expect((await PATCH(request(first))).status).toBe(200); expect(db.writes).toHaveLength(1);
  expect((await PATCH(request('A deliberately revised set.', first))).status).toBe(200);
});
test('two concurrent different writes from the same base cannot both succeed', async () => {
  const results = await Promise.all([PATCH(request('First reviewed guide.')), PATCH(request('Second reviewed guide.'))]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]); expect(db.writes).toHaveLength(1);
});
test('legacy filename is identified on load and can be replaced only with actual instruction text', async () => {
  const legacy = 'Manual PDF Upload: دليل الجامعة.pdf'; db.rows('projects')[0].university_policy = legacy;
  expect((await (await GET(load())).json()).legacyFileName).toBe('دليل الجامعة.pdf');
  expect((await PATCH(request('راجع كل اقتباس مع المصدر الأصلي قبل التسليم.', legacy))).status).toBe(200);
});
test('PDF extraction is a preview: no automatic project write, then explicit save and reload', async () => {
  const response = await POST(upload()); expect(response.status).toBe(200);
  const preview = await response.json(); expect(preview.saved).toBe(false); expect(preview.totalPages).toBe(2);
  expect(db.writes).toHaveLength(0); expect(extractUniversityGuide).toHaveBeenCalledTimes(1);
  expect((await PATCH(request(preview.text))).status).toBe(200);
  expect((await (await GET(load())).json()).universityPolicy).toBe(preview.text);
});
test('all methods reject unauthenticated and foreign-project access without parsing files or writing', async () => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue(null);
  expect((await GET(load())).status).toBe(401); expect((await PATCH(request('Instructions.'))).status).toBe(401); expect((await POST(upload())).status).toBe(401);
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: randomUUID() }, supabase: db.session });
  expect((await GET(load())).status).toBe(404); expect((await PATCH(request('Instructions.'))).status).toBe(404); expect((await POST(upload())).status).toBe(404);
  expect(extractUniversityGuide).not.toHaveBeenCalled(); expect(db.writes).toHaveLength(0);
});
test('rejects malformed input, oversized actual streamed bodies and invalid PDF MIME', async () => {
  expect((await PATCH(new Request('http://localhost', { method: 'PATCH', body: '{' }))).status).toBe(400);
  expect((await PATCH(request(' '))).status).toBe(422);
  expect((await PATCH(request('x'.repeat(UNIVERSITY_POLICY_MAX_CHARS + 1)))).status).toBe(422);
  const oversized = new Request('http://localhost', { method: 'PATCH', headers: { 'content-length': '1' }, body: 'x'.repeat(500_000) });
  expect((await PATCH(oversized)).status).toBe(413);
  expect((await POST(upload('text/plain'))).status).toBe(422); expect(extractUniversityGuide).not.toHaveBeenCalled();
  const large = new Request('http://localhost', { method: 'POST', headers: { 'content-length': '1' }, body: 'x'.repeat(4 * 1024 * 1024 + 65_537) });
  expect((await POST(large)).status).toBe(413); expect(db.writes).toHaveLength(0);
});
test('PDF errors retain previous instructions; failed persistence does not reveal database details', async () => {
  db.rows('projects')[0].university_policy = 'Existing saved instructions.';
  (extractUniversityGuide as jest.Mock).mockRejectedValue(new Error('parser internals'));
  const parsed = await POST(upload()); expect(parsed.status).toBe(422); expect(JSON.stringify(await parsed.json())).not.toContain('parser internals');
  db.constraints.set('projects', () => 'database password secret');
  const saved = await PATCH(request('Revised instructions.', 'Existing saved instructions.')); expect(saved.status).toBe(503);
  expect(JSON.stringify(await saved.json())).not.toContain('password'); expect(db.rows('projects')[0].university_policy).toBe('Existing saved instructions.');
});
test('an image-only guide says the text layer is missing and that WAHA does not read images', async () => {
  (extractUniversityGuide as jest.Mock).mockRejectedValue(new Error('guide_no_text'));
  const response = await POST(upload()); expect(response.status).toBe(422);
  expect((await response.json()).error).toBe('لم نجد نصًا قابلًا للقراءة في الملف؛ يبدو أنه صور ممسوحة ضوئيًا. الواحة لا تقرأ الصور (OCR) حاليًا، فالصق نص التعليمات هنا أو ارفع نسخة PDF نصية.');
  (extractUniversityGuide as jest.Mock).mockRejectedValue(new Error('guide_pages'));
  expect((await (await POST(upload())).json()).error).toBe('تعذر قراءة الدليل كاملًا. اختر ملفًا نصيًا حتى 50 صفحة أو الصق التعليمات المطلوبة.');
});
