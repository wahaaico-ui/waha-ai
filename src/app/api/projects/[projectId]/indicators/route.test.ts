/** Contract test with an in-memory database, NOT live RLS/E2E. */
const authoriseProject = jest.fn();
jest.mock('@/lib/research-project-access', () => ({ authoriseProject: (...args: unknown[]) => authoriseProject(...args) }));

import { NextResponse } from 'next/server';
import { GET } from './route';
import { createTableFake } from '@/lib/test-support/table-fake';
import { guideRuleCandidates, saveGuideEnvelope } from '@/lib/guide-workflow';
import { JOURNAL_PRESETS, JOURNAL_TEMPLATE_TYPE } from '@/lib/journal-template';
import { WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { IDEA_SELECTION_TYPE } from '@/lib/idea-selection/questions';

const projectId = '33333333-3333-4333-8333-333333333333';
const context = { params: Promise.resolve({ projectId }) };
const call = () => GET(new Request(`https://waha.systems/api/projects/${projectId}/indicators`), context);
const GUIDE = 'نظام التوثيق: APA 7\n1 . يجب ألا يزيد عدد كلمات الرسالة عن ( 40000 ) كلمة باستثناء الملاحق.';

let db: ReturnType<typeof createTableFake>;
beforeEach(() => {
  jest.clearAllMocks();
  db = createTableFake({ strictQuery: true });
  db.seed('projects', { id: projectId, user_id: 'owner', university_policy: null });
  authoriseProject.mockResolvedValue({ ok: true, projectId, access: { user: { id: 'owner' }, supabase: db.session } });
});
afterEach(() => expect(db.writes).toEqual([]));

type Indicator = { id: string; state: string; lines: Array<{ text: string; values?: unknown[] }>; missing: Array<{ text: string }> };
const read = async () => { const response = await call(); return { response, indicators: (await response.json()).indicators as Indicator[] }; };

test('only the owner can read the indicators', async () => {
  authoriseProject.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) });
  expect((await call()).status).toBe(404);
});

test('a project with no guide, no time answer and no journal template is not assessed on all three, privately', async () => {
  const { response, indicators } = await read();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('private');
  expect(indicators.map(indicator => [indicator.id, indicator.state])).toEqual([['guide', 'not_assessed'], ['time', 'not_assessed'], ['publication', 'not_assessed']]);
  expect(indicators.every(indicator => indicator.missing.length > 0)).toBe(true);
});

test('an approved guide, a draft, a time answer and a journal template are read from the project', async () => {
  const envelope = saveGuideEnvelope(GUIDE, guideRuleCandidates(GUIDE).map(rule => ({ ...rule, status: 'approved' as const })));
  db.rows('projects')[0].university_policy = envelope;
  db.seed('documents', { project_id: projectId, type: WRITING_DOCUMENT_TYPE, version: 1, content: JSON.stringify({ text: 'نص المسودة القصير للتجربة', citations: [], citationStyle: 'ieee' }) });
  db.seed('documents', { project_id: projectId, type: JOURNAL_TEMPLATE_TYPE, version: 1, content: JSON.stringify(JOURNAL_PRESETS.imrad) });
  db.seed('documents', { project_id: projectId, type: IDEA_SELECTION_TYPE, version: 1, content: JSON.stringify({ answers: {}, constraints: { time: 'short' }, ratings: [] }) });
  db.seed('project_references', { project_id: projectId, user_id: 'owner', title: 'مرجع' });

  const { indicators } = await read();
  const [guide, time, publication] = indicators;
  expect(guide.state).toBe('attention');
  expect(guide.lines).toContainEqual({ text: 'الدليل يطلب {0}، والمسودة مضبوطة على {1}.', values: ['APA 7', 'IEEE'], state: 'attention' });
  expect(time.state).toBe('not_assessed');
  expect(time.missing).toEqual([{ text: 'لا تكفي المراحل المنجزة لتقدير الوتيرة؛ يلزم إنجاز ثلاث مراحل على الأقل.' }]);
  expect(publication.state).toBe('attention');
  expect(publication.lines.find(item => item.text.startsWith('المراجع'))).toBeUndefined();
});

test('an unreadable saved guide is reported, not treated as no guide', async () => {
  db.rows('projects')[0].university_policy = 'WAHA_GUIDE_V1:{broken';
  const { indicators } = await read();
  expect(indicators[0].missing).toEqual([{ text: 'تعذر قراءة الدليل المحفوظ؛ افتحه في «تعليمات الجامعة» وأعد حفظه.' }]);
});
