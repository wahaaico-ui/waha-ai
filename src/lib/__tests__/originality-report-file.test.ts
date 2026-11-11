/** Contract test with an in-memory database and mocked sources, NOT live RLS/E2E. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));
jest.mock('@/lib/originality/sources-server', () => ({ loadProjectSources: jest.fn(), loadOpenSources: jest.fn(), readLatestWritingDraft: jest.fn() }));

import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { loadProjectSources, readLatestWritingDraft } from '@/lib/originality/sources-server';
import { createTableFake } from '@/lib/test-support/table-fake';
import { POST as runCheck } from '@/app/api/academic/originality/route';
import { POST as exportTask } from '@/app/api/academic/export/route';
import { ORIGINALITY_DOCUMENT_TYPE, readSavedOriginalityReport } from '@/lib/originality/saved-report';

const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const sourceId = '11111111-1111-4111-8111-111111111111';
const copied = 'تشير النتائج إلى أن استخدام الذكاء الاصطناعي التوليدي يحسن فهم الطلبة للمفاهيم المعقدة';
const draftText = `هذه فقرة كتبها الباحث بنفسه في مقدمة الفصل.\n\n${copied}.`;
const pdf = { id: sourceId, origin: 'project-pdf', title: 'Study A', url: null, year: 2023, text: `مقدمة ${copied} خاتمة` };
const post = (data: unknown) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(data) });

let db: ReturnType<typeof createTableFake>;
beforeEach(() => {
  jest.clearAllMocks();
  db = createTableFake({ strictQuery: true });
  db.seed('projects', { id: projectId, user_id: 'owner', title: 'أثر الذكاء الاصطناعي في التعليم' });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner', user_metadata: { full_name: 'سارة أحمد' } }, supabase: db.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  (createServiceClient as jest.Mock).mockReturnValue(db.service);
  (loadProjectSources as jest.Mock).mockResolvedValue([pdf]);
  (readLatestWritingDraft as jest.Mock).mockResolvedValue({ text: draftText, citations: [], savedAt: '2026-11-10T09:30:00.000Z' });
});
// The browser session only reads; the server writes the report.
afterEach(() => expect(db.writes.filter(write => write.client !== 'service')).toEqual([]));

test('each check is saved once, as an immutable report of the draft it read', async () => {
  const response = await runCheck(post({ projectId, input: 'draft' }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.documentId).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/);

  const rows = db.rows('documents');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: body.documentId, project_id: projectId, type: ORIGINALITY_DOCUMENT_TYPE, version: 1 });
  const saved = readSavedOriginalityReport(rows[0].content);
  expect(saved).toMatchObject({ version: 1, input: 'draft', draftSavedAt: '2026-11-10T09:30:00.000Z' });
  expect(saved?.report).toEqual(body.report);

  // The saved report is not a research stage: the full project export still works and leaves it out.
  const full = await exportTask(post({ projectId, format: 'markdown' }));
  expect(full.status).toBe(200);
  const markdown = await full.text();
  expect(markdown).not.toContain('originality_report');
  expect(markdown).not.toContain(copied);
});

test('the saved report downloads as a file that traces the copied passage to the project PDF', async () => {
  const { documentId } = await (await runCheck(post({ projectId, input: 'draft' }))).json();

  const markdown = await (await exportTask(post({ projectId, task: 'originality', documentId, format: 'markdown' }))).text();
  expect(markdown).toContain(`رقم التقرير: ${documentId}`);
  expect(markdown).toContain('المشروع: أثر الذكاء الاصطناعي في التعليم');
  expect(markdown).toContain('الباحث: سارة أحمد');
  expect(markdown).toContain('المقطع 1: الفقرة 2، الكلمات');
  expect(markdown).toContain(copied);
  expect(markdown).toContain('وُجد في المصدر 1: Study A — غير موثّق');
  expect(markdown).toContain('المصدر 1: Study A (2023) — ملف PDF في المشروع — مطابقات: 1');

  for (const [format, contentType, signature] of [
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK'],
    ['pdf', 'application/pdf', '%PDF'],
  ] as const) {
    const file = await exportTask(post({ projectId, task: 'originality', documentId, format }));
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toContain(contentType);
    expect(file.headers.get('content-disposition')).toBe(`attachment; filename="waha-originality.${format}"`);
    expect(file.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await file.arrayBuffer()).subarray(0, signature.length).toString()).toBe(signature);
  }

  // The Word file itself holds the trace: report number, the passage and its numbered source.
  const word = await exportTask(post({ projectId, task: 'originality', documentId, format: 'docx' }));
  const folder = mkdtempSync(join(tmpdir(), 'waha-originality-'));
  try {
    const path = join(folder, 'report.docx');
    writeFileSync(path, Buffer.from(await word.arrayBuffer()));
    const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], { encoding: 'utf8' });
    const paragraphs = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
      .map(([paragraph]) => [...paragraph.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(([, run]) => run).join('').replace(/[‎‏]/g, ''));
    expect(paragraphs).toContain(`رقم التقرير: ${documentId}`);
    // The passage keeps the draft's own punctuation: it ends at the sentence's full stop.
    expect(paragraphs).toContain(`«${copied}.»`);
    expect(paragraphs).toContain('وُجد في المصدر 1: Study A — غير موثّق');
    expect(paragraphs).toContain('المصدر 1: Study A (2023) — ملف PDF في المشروع — مطابقات: 1');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('a report is served only from the same project, by its saved type and a valid id', async () => {
  const { documentId } = await (await runCheck(post({ projectId, input: 'draft' }))).json();
  const content = db.rows('documents')[0].content;
  const other = db.seed('documents', { project_id: '99999999-9999-4999-8999-999999999999', type: ORIGINALITY_DOCUMENT_TYPE, version: 1, content });
  const review = db.seed('documents', { project_id: projectId, type: 'journey:supervisor_review', version: 1, content });

  const download = (id: unknown) => exportTask(post({ projectId, task: 'originality', documentId: id, format: 'pdf' }));
  expect((await download(documentId)).status).toBe(200);
  expect((await download(other.id)).status).toBe(404);
  expect((await download(review.id)).status).toBe(404);
  expect((await download('not-an-id')).status).toBe(400);
  expect((await download(undefined)).status).toBe(400);
});

test('a check that cannot be saved shows no report', async () => {
  db.constraints.set('documents', () => '500');
  const response = await runCheck(post({ projectId, input: 'text', text: draftText }));
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty('report');
});
