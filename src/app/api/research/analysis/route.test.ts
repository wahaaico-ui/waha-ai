jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: jest.fn() }));
jest.mock('@/lib/research-search-results', () => ({ resolveLibrarySelection: jest.fn() }));
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { generateStructured } from '@/lib/ai/geminiClient';
import { resolveLibrarySelection } from '@/lib/research-search-results';
import { POST } from './route';
const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const resolve = resolveLibrarySelection as jest.Mock;
const ai = generateStructured as jest.Mock;
const paper = { id: '10.1234/source', title: 'Saved source', authors: 'Author', abstract: 'A genuine stored abstract describing participant experiences.' };
const generated = {
  introduction: 'هذه مسودة أولية من المستخلصات المتاحة تحتاج مراجعة الباحث.',
  thematicSynthesis: 'توضح المستخلصات حدود المعلومات المتاحة دون قراءة النصوص الكاملة.',
  themes: [{ title: 'خبرات المشاركين', synthesis: 'يتناول المستخلص خبرات المشاركين ويحتاج الرجوع إلى النص الأصلي.', supportingPaperIds: [paper.id] }],
  researchGapsIdentified: ['هذه ملاحظة أولية تحتاج فحصاً أوسع وليست فجوة مثبتة.'],
  conclusion: 'يحتاج الباحث إلى قراءة المصادر الأصلية ومراجعة هذه المسودة.',
  limitations: ['المدخلات مستخلصات فقط وليست النصوص الكاملة للدراسات.'],
};
function query(data: unknown) {
  const q: Record<string, unknown> = {};
  for (const key of ['select', 'eq', 'in', 'order']) q[key] = jest.fn(() => q);
  q.maybeSingle = jest.fn().mockResolvedValue({ data, error: null });
  q.then = (done: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(done);
  return q;
}
const request = (mode?: string) => new Request('http://localhost/api/research/analysis', { method: 'POST', body: JSON.stringify({ projectId: 'project-a', ...(mode ? { mode } : {}) }) });
beforeEach(() => {
  jest.clearAllMocks(); owns.mockResolvedValue(true); resolve.mockResolvedValue([paper]);
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: { from: (table: string) => query(table === 'documents' ? [] : table === 'projects' ? { title: 'Research topic' } : { content: { referenceIds: ['reference-a'] } }) } });
  ai.mockResolvedValue({ output: JSON.stringify(generated) });
});
test('preliminary synthesis rehydrates saved library selection and never needs formal instrument approval', async () => {
  const response = await POST(request('preliminary')); const body = await response.json();
  expect(response.status).toBe(200); expect(body.preliminary).toBe(true);
  expect(resolve).toHaveBeenCalledWith({ userId: 'user-a', projectId: 'project-a', referenceIds: ['reference-a'] });
  expect(body.analysis.themes[0].supportingPaperIds).toEqual([paper.id]);
  expect(body.sources[0]).toEqual(expect.objectContaining({ id: paper.id, abstractAvailable: true }));
  expect(body.analysis.limitations).toContain('لم تُقرأ النصوص الكاملة؛ استُخدمت مستخلصات 1 دراسة من 1 دراسة مختارة، وحتى 3000 حرفًا من مستخلص كل دراسة ضمن ميزانية السياق.');
});
test('without any abstract it refuses generation rather than inventing results', async () => {
  resolve.mockResolvedValue([{ ...paper, abstract: '' }]);
  expect((await POST(request('preliminary'))).status).toBe(409); expect(ai).not.toHaveBeenCalled();
});
test('comparison requires two available abstracts, while a one-study summary remains possible', async () => {
  const compared = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ projectId: 'project-a', mode: 'preliminary', comparison: true }) }));
  expect(compared.status).toBe(409); expect(ai).not.toHaveBeenCalled();
  expect((await POST(request('preliminary'))).status).toBe(200);
});
test('empty gap list is accepted without changing server citation validation', async () => {
  ai.mockResolvedValue({ output: JSON.stringify({ ...generated, researchGapsIdentified: [] }) });
  const response = await POST(request('preliminary'));
  expect(response.status).toBe(200); expect((await response.json()).analysis.researchGapsIdentified).toEqual([]);
});
test('a provider missing-abstract placeholder cannot trigger synthesis', async () => {
  resolve.mockResolvedValue([{ ...paper, abstract: 'المستخلص غير متوفر' }]);
  expect((await POST(request('preliminary'))).status).toBe(409); expect(ai).not.toHaveBeenCalled();
});
test('keeps every saved selection beyond the former 12-source limit', async () => {
  const selected = Array.from({ length: 13 }, (_, index) => ({ ...paper, id: `study-${index}` }));
  resolve.mockResolvedValue(selected);
  ai.mockResolvedValue({ output: JSON.stringify({ ...generated, themes: [{ ...generated.themes[0], supportingPaperIds: ['study-0', 'study-12'] }] }) });
  const response = await POST(request('preliminary')); const body = await response.json();
  expect(response.status).toBe(200); expect(body.sources).toHaveLength(13);
  const prompt = ai.mock.calls[0][0].prompt;
  const packet = JSON.parse(prompt.split('DATA_START\n').at(-1).split('\nDATA_END')[0]);
  expect(packet.map((source: { id: string }) => source.id)).toEqual(selected.map((source) => source.id));
  expect(body.analysis.themes[0].supportingPaperIds).toEqual(['study-0', 'study-12']);
});
test('missing abstracts are excluded from the prompt and mentioned in server limitations', async () => {
  resolve.mockResolvedValue([paper, { id: 'missing', title: 'No abstract source', abstract: '' }]);
  const response = await POST(request('preliminary')); const body = await response.json();
  expect(response.status).toBe(200); expect(ai.mock.calls[0][0].prompt).not.toContain('No abstract source');
  expect(body.sources).toContainEqual(expect.objectContaining({ id: 'missing', title: 'No abstract source', abstractAvailable: false }));
  expect(body.analysis.limitations).toContain('استُبعدت 1 دراسة لغياب المستخلص؛ عناوينها وحالة المستخلص محفوظة في قائمة الدراسات المستخدمة.');
});
test('rejects AI references to missing-abstract or unselected studies', async () => {
  resolve.mockResolvedValue([paper, { id: 'missing', title: 'No abstract source', abstract: '' }]);
  ai.mockResolvedValue({ output: JSON.stringify({ ...generated, themes: [{ ...generated.themes[0], supportingPaperIds: ['missing'] }] }) });
  expect((await POST(request('preliminary'))).status).toBe(422);
});
test('formal synthesis still requires an approved title and three studies', async () => {
  expect((await POST(request())).status).toBe(409); expect(resolve).not.toHaveBeenCalled(); expect(ai).not.toHaveBeenCalled();
});
test('rejects deleted or cross-project library selection before generation', async () => {
  resolve.mockResolvedValue(null); expect((await POST(request('preliminary'))).status).toBe(422); expect(ai).not.toHaveBeenCalled();
});
test('anonymous and another owner cannot run preliminary synthesis', async () => {
  auth.mockResolvedValue(null); expect((await POST(request('preliminary'))).status).toBe(401);
  auth.mockResolvedValue({ user: { id: 'u' }, supabase: {} }); owns.mockResolvedValue(false);
  expect((await POST(request('preliminary'))).status).toBe(404); expect(resolve).not.toHaveBeenCalled(); expect(ai).not.toHaveBeenCalled();
});
test('rejects an invented numeric finding even when its citation names a selected source', async () => {
  ai.mockResolvedValue({ output: JSON.stringify({ ...generated, themes: [{ ...generated.themes[0], synthesis: 'The selected study demonstrated a 999.123% improvement in competence.' }] }) });
  const response = await POST(request('preliminary'));
  expect(response.status).toBe(422);
  expect((await response.json()).error).toContain('أرقام');
});
test('a number in an uncited source cannot substantiate a theme attributed to another source', async () => {
  resolve.mockResolvedValue([paper, { ...paper, id: 'other-paper', abstract: 'The second study reported a 52.3% outcome in its own population.' }]);
  ai.mockResolvedValue({ output: JSON.stringify({ ...generated, themes: [{ ...generated.themes[0], synthesis: 'The first selected source reported a 52.3% outcome among participants.' }] }) });
  expect((await POST(request('preliminary'))).status).toBe(422);
});
test('accepts the cited source numeric value written using Arabic digits', async () => {
  resolve.mockResolvedValue([{ ...paper, abstract: 'The study reported a 52.3% outcome among participants.' }]);
  ai.mockResolvedValue({ output: JSON.stringify({ ...generated, themes: [{ ...generated.themes[0], synthesis: 'وردت نسبة ٥٢٫٣٪ في مستخلص المصدر المختار دون تعميمها على جميع الدراسات.' }] }) });
  expect((await POST(request('preliminary'))).status).toBe(200);
});
