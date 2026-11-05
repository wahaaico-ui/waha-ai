import { GET } from '@/app/api/dashboard-stats/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { GET as restoreSupervisor } from '@/app/api/projects/[projectId]/supervisor-review/route';
import { GET as restoreLanguage } from '@/app/api/academic/language-tools/route';
import { createTableFake } from '@/lib/test-support/table-fake';
import { readDashboardPages, readDashboardWork } from '@/lib/dashboard-resume-server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
const auth = jest.mocked(requireAuthenticatedUser);
let db: ReturnType<typeof createTableFake>;

beforeEach(() => {
  db = createTableFake({ strictQuery: true, serverRowLimit: 3 });
  auth.mockResolvedValue({ user: { id: 'owner', email: 'owner@example.invalid', user_metadata: { full_name: 'Researcher' } }, supabase: db.session } as never);
});
afterEach(() => jest.restoreAllMocks());

test('returns a complete owned dashboard across provider row caps, including recent writing and stage drafts', async () => {
  for (let index = 0; index < 8; index++) {
    db.seed('projects', { id: `p${index}`, user_id: 'owner', title: `Project ${index}`, status: 'draft', created_at: `2026-10-0${index + 1}T00:00:00Z` });
    db.seed('users_usage', { id: `u${index}`, user_id: 'owner', report_score: index * 10 });
    for (let version = 1; version <= 5; version++) db.seed('documents', { id: `doc-${index}-${version}`, project_id: `p${index}`, type: 'journey:title', version, content: JSON.stringify({ title: `Approved research title for project ${index}, revision ${version}` }), created_at: '2026-10-10T00:00:00Z' });
  }
  db.seed('documents', { id: 'write', project_id: 'p0', type: 'evidence-writing:v1', version: 1, content: JSON.stringify({ text: 'Saved manuscript.', citations: [] }), created_at: '2026-10-19T00:00:00Z' });
  db.seed('documents', { id: 'review', project_id: 'p3', type: 'journey:supervisor_review', version: 1,
    content: JSON.stringify({ originalText: 'Original research paragraph before supervisor review.', revisedText: 'Revised research paragraph after supervisor review.', notes: [] }), created_at: '2026-10-17T00:00:00Z' });
  db.seed('documents', { id: 'language', project_id: 'p4', type: 'journey:language_task', version: 1,
    content: JSON.stringify({ operation: 'translate', text: 'Original language paragraph.', output: 'Final translated paragraph.', targetLanguage: 'en', status: 'completed' }), created_at: '2026-10-18T00:00:00Z' });
  db.seed('research_stage_drafts', { project_id: 'p2', stage: 'problem', content: { problemStatement: 'Unfinished saved research problem.' }, updated_at: '2026-10-20T00:00:00Z' });
  db.seed('projects', { id: 'foreign', user_id: 'other', title: 'private-project' });
  db.seed('users_usage', { user_id: 'other', report_score: 100 });
  db.seed('documents', { id: 'foreign-doc', project_id: 'foreign', type: 'evidence-writing:v1', content: JSON.stringify({ text: 'private-manuscript', citations: [] }) });
  const response = await GET();
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(result.stats).toEqual({ total: 8, avg: 35, best: 70 });
  expect(result.projects).toHaveLength(8);
  expect(result.latestProject.id).toBe('p2');
  expect(result.latestProject.resume.href).toBe('/research/problem?projectId=p2');
  expect(result.projects.find((p: { id: string }) => p.id === 'p0').resume.href).toBe('/research/tasks?projectId=p0&task=writing');
  expect(result.projects.find((p: { id: string }) => p.id === 'p1').resume.lastVersion).toBe(5);
  expect(JSON.stringify(result)).not.toMatch(/private-project|private-manuscript/);
  expect(db.writes).toHaveLength(0);
  if (process.env.WAHA_DASHBOARD_QA_DIR) {
    mkdirSync(process.env.WAHA_DASHBOARD_QA_DIR, { recursive: true });
    writeFileSync(join(process.env.WAHA_DASHBOARD_QA_DIR, 'dashboard-fixture.json'), JSON.stringify(result, null, 2));
  }
});

test('does not query work tables before authentication', async () => {
  auth.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
});

test('supports an empty owned account', async () => {
  const response = await GET();
  expect(await response.json()).toMatchObject({ success: true, projects: [], latestProject: null, stats: { total: 0, avg: 0, best: 0 } });
});

test('reports a failed later page instead of returning a partial successful dashboard', async () => {
  let requests = 0;
  await expect(readDashboardPages(async () => (++requests === 1
    ? { data: [{ id: 'first' }], error: null } : { data: null, error: { code: 'provider_failure' } })))
    .rejects.toThrow('dashboard_read_failed');
  expect(requests).toBe(2);
});

test('returns a safe error when an owned database read fails', async () => {
  auth.mockResolvedValue({ user: { id: 'owner' }, supabase: { from() { throw new Error('private-provider-detail'); } } } as never);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const response = await GET();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain('private-provider-detail');
});

test('batches more than fifty projects and reads only the selected document revisions', async () => {
  const ids = Array.from({ length: 52 }, (_, i) => `p${i}`);
  for (const project_id of ids) for (let version = 1; version <= 4; version++) db.seed('documents', {
    id: `${project_id}-${version}`, project_id, type: 'journey:title', version, content: '{}', created_at: '2026-10-20T00:00:00Z',
  });
  const work = await readDashboardWork(db.session as never, ids);
  expect(work.documents).toHaveLength(52);
  expect(work.documents.every(row => row.version === 4)).toBe(true);
});

test.each(['supervisor', 'language'] as const)('dashboard preview and restored %s agree when two saves share a timestamp', async task => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  db.seed('projects', { id: projectId, user_id: 'owner', title: 'A saved research project', created_at: '2026-10-01T00:00:00Z' });
  jest.mocked(ownsProject).mockResolvedValue(true);
  for (const id of ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']) {
    const text = `Saved academic text for document ${id}.`;
    db.seed('documents', { id, project_id: projectId, type: task === 'supervisor' ? 'journey:supervisor_review' : 'journey:language_task',
      version: 1, created_at: '2026-10-20T10:00:00Z', content: JSON.stringify(task === 'supervisor'
        ? { originalText: 'Original text before academic supervisor review.', revisedText: text, notes: [] }
        : { operation: 'translate', text: 'Original text before translation.', output: text, targetLanguage: 'en', status: 'completed' }) });
  }
  const dashboard = await (await GET()).json();
  const response = task === 'supervisor'
    ? await restoreSupervisor(new Request('http://localhost'), { params: Promise.resolve({ projectId }) })
    : await restoreLanguage(new Request(`http://localhost?projectId=${projectId}`));
  expect(response.status).toBe(200);
  const restored = await response.json();
  const latest = task === 'supervisor' ? restored.reviews[0] : restored.tasks[0];
  expect(latest.documentId).toBe('33333333-3333-4333-8333-333333333333');
  expect(dashboard.latestProject.resume.lastOutputPreview).toBe(task === 'supervisor' ? latest.revisedText : latest.output);
});
