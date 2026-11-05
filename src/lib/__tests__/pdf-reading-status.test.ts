jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));
const info = jest.fn(); const getText = jest.fn(); const destroy = jest.fn();
jest.mock('pdf-parse', () => ({ PDFParse: jest.fn().mockImplementation(() => ({ getInfo: info, getText, destroy })) }));
import { GET, POST } from '@/app/api/academic/parse-pdf/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
const saved = new Map<string, Record<string, unknown>>();
const upsert = jest.fn(async (row: Record<string, unknown>) => { saved.set(row.id as string, row); return { error: null }; });
const db = { from: jest.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: [...saved.values()], error: null }) }) }) }) })) };

const text = 'Digital PDF fixture text, not a real scientific paper. '.repeat(3);
function request(projectId?: string) {
  const form = new FormData(); form.append('file', new File(['%PDF-fixture'], 'fixture.pdf', { type: 'application/pdf' }));
  if (projectId !== undefined) form.append('projectId', projectId);
  form.append('reading', JSON.stringify({ complete: true, verificationStatus: 'verified' }));
  return new Request('http://localhost', { method: 'POST', body: form });
}
beforeEach(() => {
  jest.clearAllMocks(); saved.clear();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'fixture' }, supabase: db });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  (createServiceClient as jest.Mock).mockReturnValue({ from: () => ({ upsert }) });
  upsert.mockImplementation(async (row) => { saved.set(row.id as string, row); return { error: null }; });
  info.mockResolvedValue({ total: 2 }); getText.mockResolvedValue({ text, pages: [{ text }, { text }] });
});
test('reports processed pages and explicit 50-page limit for text extraction', async () => {
  expect((await (await POST(request())).json()).reading).toMatchObject({ totalPages: 2, processedPages: 2, maxPages: 50, complete: true, method: 'text-layer' });
  expect(destroy).toHaveBeenCalled();
});
test('mixed text and empty/scanned pages never claim complete reading', async () => {
  getText.mockResolvedValue({ text, pages: [{ text }, { text: '' }] });
  expect((await (await POST(request())).json()).reading.complete).toBe(false);
});
test('over-limit rejects instead of silently reading a truncated document', async () => {
  info.mockResolvedValue({ total: 51 }); expect((await POST(request())).status).toBe(400); expect(getText).not.toHaveBeenCalled();
});
test('scanned document does not run external OCR without consent', async () => {
  getText.mockResolvedValue({ text: '', pages: [{ text: '' }, { text: '' }] });
  const body = await (await POST(request())).json(); expect(body.reading.complete).toBe(false); expect(body.ocrAvailable).toBe(true); expect(body.extractedViaOcr).toBeUndefined();
});
test('owned extraction persists server-derived metadata, restores it and retry does not duplicate', async () => {
  getText.mockResolvedValue({ text, pages: [{ text }, { text: '' }] });
  expect((await (await POST(request('owned-project'))).json()).reportSaved).toBe(true);
  await POST(request('owned-project'));
  expect(saved.size).toBe(1);
  const row = [...saved.values()][0];
  expect(row.type).toBe('journey:pdf_extraction');
  expect(JSON.parse(row.content as string)).toEqual({ fileName: 'fixture.pdf', reading: { totalPages: 2, processedPages: 2, maxPages: 50, textCharacters: text.length, method: 'text-layer', complete: false } });
  const response = await GET(new Request('http://localhost?projectId=owned-project'));
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect((await response.json()).reports[0].reading.complete).toBe(false);
});
test('anonymous requests cannot parse, restore or write', async () => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue(null);
  expect((await POST(request('owned-project'))).status).toBe(401);
  expect((await GET(new Request('http://localhost?projectId=owned-project'))).status).toBe(401);
  expect(getText).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
});
test('cross-project access rejected before parsing, OCR or service write', async () => {
  (ownsProject as jest.Mock).mockResolvedValue(false);
  expect((await POST(request('other-project'))).status).toBe(404);
  expect((await GET(new Request('http://localhost?projectId=other-project'))).status).toBe(404);
  expect(ownsProject).toHaveBeenCalledWith('other-project', 'fixture', db);
  expect(getText).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
});
test('legacy extraction has no project write and missing/invalid project ids are rejected', async () => {
  await POST(request()); expect(upsert).not.toHaveBeenCalled();
  expect((await POST(request(''))).status).toBe(400);
  expect((await GET(new Request('http://localhost'))).status).toBe(400);
});
test('storage failure retains extraction but explicitly reports that it was not saved', async () => {
  upsert.mockResolvedValueOnce({ error: { message: 'fixture failure' } } as never);
  const response = await POST(request('owned-project'));
  expect(response.status).toBe(503);
  const body = await response.json(); expect(body.text).toBe(text); expect(body.reportSaved).toBeUndefined();
  expect(body.error).toContain('تعذر حفظ');
});
test('corrupt stored reports are omitted and restored OCR never claims complete', async () => {
  saved.set('bad', { id: 'bad', content: '{bad' });
  saved.set('ocr', { id: 'ocr', content: JSON.stringify({ fileName: 'scan.pdf', reading: { totalPages: 2, processedPages: 2, maxPages: 50, method: 'external-ocr', complete: true }, verificationStatus: 'verified' }) });
  const body = await (await GET(new Request('http://localhost?projectId=owned-project'))).json();
  expect(body.reports).toHaveLength(1); expect(body.reports[0].reading.complete).toBe(false);
  expect(body.reports[0].verificationStatus).toBeUndefined();
});
