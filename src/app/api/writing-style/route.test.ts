const requireAuthenticatedUser = jest.fn();
const updateUser = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args) }));

import { GET, POST, PUT } from './route';

const paragraph = 'يهدف هذا البحث إلى دراسة أثر التعليم الإلكتروني في تحصيل طلبة الجامعات. ويعتمد الباحث على المنهج الوصفي التحليلي (عودة، 2019). وقد أظهرت دراسات سابقة أن التعليم الإلكتروني يرفع الدافعية حين يتوافر الدعم التقني.';
const sample = Array.from({ length: 6 }, (_, index) => `${paragraph} الفقرة ${index + 1} تضيف تفصيلًا عن الجامعات الناشئة والتعليم الإلكتروني فيها.`).join('\n\n');
const signedIn = (metadata: Record<string, unknown> = {}) => requireAuthenticatedUser.mockResolvedValue({ user: { id: 'u1', user_metadata: metadata }, supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } } });
const call = (method: typeof POST, body: unknown) => method(new Request('https://waha.systems/api/writing-style', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => { jest.clearAllMocks(); updateUser.mockResolvedValue({ error: null }); });

describe('style test route (DOC-26-03, DOC-13-06)', () => {
  test('a signed-out visitor can neither read, measure nor approve', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await call(POST, { sample })).status).toBe(401);
    expect((await call(PUT, { sample, terms: [], voice: 'third', sentenceLength: 'medium' })).status).toBe(401);
  });

  test('measuring saves nothing, and a short sample says how many words are missing', async () => {
    signedIn();
    const short = await call(POST, { sample: 'نص قصير' });
    expect(short.status).toBe(422);
    expect((await short.json()).values).toEqual([2, 150]);
    const measured = await call(POST, { sample });
    expect(measured.status).toBe(200);
    expect((await measured.json()).profile.approvedAt).toBeUndefined();
    expect(updateUser).not.toHaveBeenCalled();
  });

  test('approving re-measures the sample, keeps the edits and stores only the profile', async () => {
    signedIn();
    const response = await call(PUT, { sample, terms: ['التعليم الإلكتروني', 'الدافعية'], voice: 'first', sentenceLength: 'short' });
    expect(response.status).toBe(200);
    const saved = updateUser.mock.calls[0][0].data.writingStyle;
    expect(saved).toMatchObject({ version: 1, terms: ['التعليم الإلكتروني', 'الدافعية'], voice: 'first', sentenceLength: 'short' });
    expect(JSON.stringify(saved)).not.toContain('يهدف هذا البحث');
  });

  test('choices outside the allowed ones are refused', async () => {
    signedIn();
    expect((await call(PUT, { sample, terms: [], voice: 'royal', sentenceLength: 'medium' })).status).toBe(400);
    expect((await call(PUT, { sample, terms: 'x', voice: 'third', sentenceLength: 'medium' })).status).toBe(400);
  });

  test('reads back only an approved profile', async () => {
    signedIn({ writingStyle: { version: 1 } });
    expect(await (await GET()).json()).toEqual({ profile: null });
  });
});
