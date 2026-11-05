/** Contract test with an in-memory database and mocked providers, NOT live RLS/E2E. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));
jest.mock('@/lib/billing/entitlements', () => ({ hasEntitlement: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: jest.fn() }));
jest.mock('@/lib/language/DeepLService', () => ({ DeepLService: { configured: () => false } }));
jest.mock('@/lib/language/MicrosoftTranslatorService', () => ({ MicrosoftTranslatorService: { configured: () => false } }));
jest.mock('@/lib/language/LanguageToolService', () => ({ LanguageToolService: { configured: () => false } }));
jest.mock('@/lib/research-search-results', () => ({ isResultId: (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value), resolveLibrarySelection: jest.fn() }));

import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { generateStructured } from '@/lib/ai/geminiClient';
import { resolveLibrarySelection } from '@/lib/research-search-results';
import { POST as runLanguage, GET as restoreLanguage } from '@/app/api/academic/language-tools/route';
import { POST as exportTask } from '@/app/api/academic/export/route';
import { languageTaskId } from '@/lib/language-task';

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let sessionWrites: number;
function from(table: string, server = false) {
  const filters: Array<[string, unknown]> = [];
  let action = ''; let patch: Row = {}; let cap = Infinity;
  const execute = () => {
    let rows = (tables[table] || []).filter((row) => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
    if (action && !server) { sessionWrites += 1; throw new Error('Browser write'); }
    if (action === 'insert') {
      if ((tables[table] || []).some((row) => row.id === patch.id)) return { data: null, error: { code: '23505' } };
      const row = { ...patch, created_at: new Date().toISOString() }; (tables[table] ||= []).push(row); rows = [row];
    } else if (action === 'update') rows.forEach((row) => Object.assign(row, patch));
    return { data: rows.slice().reverse().slice(0, cap), error: null };
  };
  const q = {
    select: () => q, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; },
    in: (key: string, value: unknown[]) => { filters.push([key, value]); return q; }, order: () => q,
    limit: (value: number) => { cap = value; return q; }, insert: (value: Row) => { action = 'insert'; patch = value; return q; },
    update: (value: Row) => { action = 'update'; patch = value; return q; },
    maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] || null }; },
    then: (done: (result: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(done),
  }; return q;
}
const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const input = { projectId, operation: 'proofread' as const, text: 'هذه مسودة عربية تحتاج مراجعة لغوية مع حفظ الرقم 42 والإحالة [1].', targetLanguage: 'ar' as const };
const output = 'هذه مسودة عربية منقحة للمراجعة، مع حفظ الرقم 42 والإحالة [1].';
const post = (data: unknown) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(data) });
beforeEach(() => {
  jest.clearAllMocks(); sessionWrites = 0; tables = { documents: [], projects: [{ id: projectId, user_id: 'owner', title: 'مشروع اختبار محاكى' }], research_stage_drafts: [] };
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: { from: (table: string) => from(table) } });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  (createServiceClient as jest.Mock).mockReturnValue({ from: (table: string) => from(table, true) });
  (generateStructured as jest.Mock).mockResolvedValue({ output });
});
afterEach(() => expect(sessionWrites).toBe(0));

test('language request → saved result → restore → exact Markdown; identical retry is cached', async () => {
  const response = await runLanguage(post(input)); const body = await response.json();
  expect(response.status).toBe(200); expect(body.saved).toBe(true);
  const restored = await (await restoreLanguage(new Request(`http://localhost?projectId=${projectId}`))).json();
  expect(restored.tasks[0]).toMatchObject({ text: input.text, output, documentId: body.documentId });
  const exported = await exportTask(post({ projectId, task: 'language', documentId: body.documentId }));
  const markdown = await exported.text(); expect(markdown).toContain(input.text); expect(markdown).toContain(output);
  const cached = await (await runLanguage(post(input))).json();
  expect(cached.cached).toBe(true); expect(tables.documents).toHaveLength(1); expect(generateStructured).toHaveBeenCalledTimes(1);
});

test('provider failure keeps original input, retry fills the same document', async () => {
  (generateStructured as jest.Mock).mockRejectedValueOnce(new Error('Provider unavailable'));
  expect((await runLanguage(post(input))).status).toBe(500);
  const restored = await (await restoreLanguage(new Request(`http://localhost?projectId=${projectId}`))).json();
  expect(restored.tasks[0]).toMatchObject({ text: input.text, output: '', status: 'pending' });
  const retry = await (await runLanguage(post(input))).json();
  expect(retry.documentId).toBe(restored.tasks[0].documentId); expect(tables.documents).toHaveLength(1);
});

test('save-only stores input without provider calls and uses protected document namespace', async () => {
  expect((await runLanguage(post({ ...input, saveOnly: true }))).status).toBe(200);
  expect(generateStructured).not.toHaveBeenCalled(); expect(tables.documents[0].type).toBe('journey:language_task');
});

test('structured provider output is saved and exported as text, invalid numeric changes stay pending', async () => {
  (generateStructured as jest.Mock).mockResolvedValueOnce({ output: JSON.stringify({ corrected_text: output }) });
  const response = await runLanguage(post(input));
  expect(response.status).toBe(200); const body = await response.json(); expect(body.output).toBe(output);
  const exported = await (await exportTask(post({ projectId, task: 'language', documentId: body.documentId }))).text();
  expect(exported).toContain(output); expect(exported).not.toContain('corrected_text');
  (generateStructured as jest.Mock).mockResolvedValueOnce({ output: output.replace('42', '99') });
  expect((await runLanguage(post({ ...input, text: input.text + ' نسخة ثانية.' }))).status).toBe(500);
  expect(JSON.parse(String(tables.documents[1].content)).status).toBe('pending');
});

test('anonymous, another project and client-generated output cannot bypass ownership or generation', async () => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValueOnce(null);
  expect((await runLanguage(post(input))).status).toBe(401);
  (ownsProject as jest.Mock).mockResolvedValueOnce(false);
  expect((await runLanguage(post(input))).status).toBe(404); expect(tables.documents).toHaveLength(0);
  const body = await (await runLanguage(post({ ...input, output: 'forged', canonicalLinked: true }))).json(); expect(body.output).toBe(output);
  (ownsProject as jest.Mock).mockResolvedValueOnce(false);
  expect((await exportTask(post({ projectId, task: 'language', documentId: body.documentId }))).status).toBe(404);
});

test('deterministic request identity includes owner project, operation and target language', () => {
  expect(languageTaskId(projectId, input)).not.toBe(languageTaskId('other-project', input));
  expect(languageTaskId(projectId, input)).not.toBe(languageTaskId(projectId, { ...input, targetLanguage: 'en' }));
});

test('malformed language input rejects before storing or calling a provider', async () => {
  expect((await runLanguage(post({ ...input, text: 42 }))).status).toBe(400);
  expect(tables.documents).toHaveLength(0); expect(generateStructured).not.toHaveBeenCalled();
});

test('language DOCX contains original and saved output with unchanged numbers/citations', async () => {
  const body = await (await runLanguage(post(input))).json();
  const response = await exportTask(post({ projectId, task: 'language', documentId: body.documentId, format: 'docx' }));
  const file = join(mkdtempSync(join(tmpdir(), 'waha-language-docx-')), 'output.docx');
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  const xml = execFileSync('unzip', ['-p', file, 'word/document.xml'], { encoding: 'utf8' });
  const storedText = xml.replace(/<[^>]+>/g, '').replace(/\u200e/g, '');
  expect(storedText).toContain(input.text); expect(storedText).toContain(output); expect(storedText).toContain('42'); expect(storedText).toContain('[1]');
});

const analysis = { introduction: 'هذه مسودة محاكاة لا تثبت نتيجة دراسة حقيقية.', thematicSynthesis: 'هذه مقارنة اختبارية للمستخلصات المتاحة فقط، وليست قراءة للنصوص الكاملة.', themes: [{ title: 'المحور التجريبي', synthesis: 'هذه فقرة اختبار تربط المخرج بإحالة إلى الدراسة المختارة.', supportingPaperIds: ['study-a'] }], researchGapsIdentified: [], conclusion: 'لا تكفي المصادر لتحديد فجوة؛ يلزم الرجوع إلى الدراسات الأصلية.', limitations: ['المخرج اختبار محاكى لا يمثل استنتاجًا علميًا.'], referenceIds: ['ref-a'] };
const paper = { id: 'study-a', referenceId: 'ref-a', title: 'Fixture study — دراسة اختبارية', abstract: 'Fixture abstract only, not a real scholarly result.', authors: 'Fixture Author', doi: '10.1234/fixture', year: 2024 };
function savedAnalysis() {
  tables.research_stage_drafts = [{ project_id: projectId, stage: 'analysis', content: analysis }, { project_id: projectId, stage: 'literature', content: { referenceIds: ['ref-a'] } }];
  (resolveLibrarySelection as jest.Mock).mockResolvedValue([paper]);
}
test('saved synthesis with unsupported numeric findings cannot be exported as an accepted task result', async () => {
  savedAnalysis();
  tables.research_stage_drafts[0].content = { ...analysis, themes: [{ ...analysis.themes[0], synthesis: 'The selected study demonstrated a 999.123% improvement in competence.' }] };
  const response = await exportTask(post({ projectId, task: 'analysis' }));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain('أرقام');
});
test('saved synthesis export rehydrates exact references; changed selection and fabricated citations reject', async () => {
  savedAnalysis();
  const response = await exportTask(post({ projectId, task: 'analysis' })); const text = await response.text();
  expect(response.status).toBe(200); expect(text).toContain(analysis.thematicSynthesis); expect(text).toContain('[1] Fixture study'); expect(text).toContain(paper.doi);
  tables.research_stage_drafts[1].content = { referenceIds: ['other'] };
  expect((await exportTask(post({ projectId, task: 'analysis' }))).status).toBe(409);
  savedAnalysis(); (resolveLibrarySelection as jest.Mock).mockResolvedValue([{ ...paper, id: 'other' }]);
  expect((await exportTask(post({ projectId, task: 'analysis' }))).status).toBe(409);
});

test('actual DOCX content contains exact saved Arabic, references and RTL; generates real PDF', async () => {
  savedAnalysis();
  const folder = mkdtempSync(join(tmpdir(), 'waha-task-export-'));
  const docx = await exportTask(post({ projectId, task: 'analysis', format: 'docx' }));
  const docxFile = join(folder, 'fixture.docx'); writeFileSync(docxFile, Buffer.from(await docx.arrayBuffer()));
  const xml = execFileSync('unzip', ['-p', docxFile, 'word/document.xml'], { encoding: 'utf8' });
  expect(xml).toContain(analysis.thematicSynthesis); expect(xml).toContain(paper.doi); expect(xml).toContain('w:bidi'); expect(xml).toContain('لا تكفي المصادر لتحديد فجوة');
  const pdf = await exportTask(post({ projectId, task: 'analysis', format: 'pdf' }));
  const bytes = Buffer.from(await pdf.arrayBuffer()); expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  writeFileSync(join(folder, 'fixture.pdf'), bytes);
  if (process.env.WAHA_QA_ARTIFACT_DIR) {
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, 'fixture-synthesis.pdf'), bytes);
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, 'fixture-synthesis.docx'), Buffer.from(await (await exportTask(post({ projectId, task: 'analysis', format: 'docx' }))).arrayBuffer()));
  }
}, 30000);

test('export language is validated and only generated labels change', async () => {
  expect((await exportTask(post({ projectId, language: 'tr' }))).status).toBe(400);
  const body = await (await runLanguage(post(input))).json();
  const response = await exportTask(post({ projectId, task: 'language', documentId: body.documentId, language: 'en' }));
  expect(response.status).toBe(200);
  const markdown = await response.text();
  expect(markdown).toContain('## Original input');
  expect(markdown).toContain(input.text); expect(markdown).toContain(output);
  expect(markdown).not.toContain('## المدخل الأصلي');
});
