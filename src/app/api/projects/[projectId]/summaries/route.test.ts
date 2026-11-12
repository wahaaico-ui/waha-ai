/** Contract test with an in-memory database, NOT live RLS/E2E. */
const authoriseProject = jest.fn();
jest.mock('@/lib/research-project-access', () => ({ authoriseProject: (...args: unknown[]) => authoriseProject(...args) }));

import { NextResponse } from 'next/server';
import { GET } from './route';
import { POST as exportFile } from '@/app/api/academic/export/route';
import { createTableFake } from '@/lib/test-support/table-fake';
import { JOURNAL_PRESETS, JOURNAL_TEMPLATE_TYPE } from '@/lib/journal-template';

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: async () => mockAccess(),
  ownsProject: async (projectId: string, userId: string) => projectId === PROJECT && userId === 'owner',
}));
const PROJECT = '44444444-4444-4444-8444-444444444444';
let mockAccess: () => unknown = () => null;

const context = { params: Promise.resolve({ projectId: PROJECT }) };
const call = () => GET(new Request(`https://waha.systems/api/projects/${PROJECT}/summaries`), context);
let db: ReturnType<typeof createTableFake>;
const stage = (name: string, content: unknown, version = 1) => db.seed('documents', { id: `${name}-${version}`, project_id: PROJECT, type: `journey:${name}`, content: JSON.stringify(content), version, created_at: `2026-11-1${version}T10:00:00Z` });

beforeEach(() => {
  jest.clearAllMocks();
  db = createTableFake({ strictQuery: true });
  db.seed('projects', { id: PROJECT, user_id: 'owner', title: 'مشروع' });
  authoriseProject.mockResolvedValue({ ok: true, projectId: PROJECT, access: { user: { id: 'owner' }, supabase: db.session } });
  mockAccess = () => ({ user: { id: 'owner', user_metadata: {} }, supabase: db.session });
});
afterEach(() => expect(db.writes).toEqual([]));

test('only the owner can read the summaries', async () => {
  authoriseProject.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) });
  expect((await call()).status).toBe(404);
});

test('an empty project gets two summaries that only list what is missing, privately', async () => {
  const response = await call();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('private');
  expect(body.journal.sections).toEqual([]);
  expect(body.decision.sections).toEqual([]);
  expect(body.journal.missing.length).toBeGreaterThan(0);
  expect(body.decision.missing.length).toBe(4);
});

test('the newest saved version of each stage and the saved journal template are used', async () => {
  stage('problem', { problemStatement: 'نسخة قديمة' }, 1);
  stage('problem', { problemStatement: 'مشكلة حديثة محفوظة' }, 2);
  stage('publication', { approvedTitle: 'عنوان', targetName: 'BMC Nursing', structuredAbstract: { background: 'أ', objective: 'ب', methods: 'ج', results: 'د', conclusion: 'هـ' }, keywords: ['واحد', 'اثنان', 'ثلاثة'] });
  db.seed('documents', { id: 'tpl', project_id: PROJECT, type: JOURNAL_TEMPLATE_TYPE, content: JSON.stringify(JOURNAL_PRESETS.imrad), version: 1, created_at: '2026-11-12T10:00:00Z' });
  const body = await (await call()).json();
  expect(body.decision.sections[0]).toEqual({ heading: 'المشكلة', text: 'مشكلة حديثة محفوظة' });
  expect(body.journal.target).toBe('BMC Nursing');
  expect(body.journal.checks.map((check: { state: string }) => check.state)).toEqual(['met', 'met']);
});

test('each summary downloads as a Word file for the owner, and not for anyone else', async () => {
  stage('problem', { problemStatement: 'مشكلة محفوظة للتصدير' });
  const request = (task: string) => new Request('https://waha.systems/api/academic/export', { method: 'POST', body: JSON.stringify({ projectId: PROJECT, task, format: 'docx' }) });
  // Without the results and their limits a decision summary is not handed over.
  expect((await exportFile(request('decision_summary'))).status).toBe(409);
  stage('results', { overallSummary: 'نتيجة محفوظة', limitations: 'حدود محفوظة' });
  const response = await exportFile(request('decision_summary'));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toContain('waha-decision_summary.docx');
  expect(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString()).toBe('PK');
  const latex = await exportFile(new Request('https://waha.systems/api/academic/export', { method: 'POST', body: JSON.stringify({ projectId: PROJECT, task: 'decision_summary', format: 'latex' }) }));
  expect(latex.status).toBe(200);
  expect(latex.headers.get('content-type')).toContain('application/x-tex');
  expect(latex.headers.get('content-disposition')).toContain('waha-decision_summary.tex');
  expect(await latex.text()).toContain('\\section*{حدود النتائج}');
  mockAccess = () => ({ user: { id: 'stranger', user_metadata: {} }, supabase: db.session });
  expect((await exportFile(request('journal_summary'))).status).toBe(404);
});
