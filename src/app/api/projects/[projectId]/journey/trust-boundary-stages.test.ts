// Route-level checks that analysis content is re-validated before storage. Gate evaluation is not under test here (it has
// its own tests), so it is reported as open for every stage.
const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
const serviceFrom = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
}));
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (...args: unknown[]) => serviceFrom(...args) }),
}));
jest.mock('@/lib/research-workflow', () => {
  const actual = jest.requireActual('@/lib/research-workflow');
  return {
    ...actual,
    evaluateGate: (stage: string) => ({ status: 'open', stage, reason: 'test gate', nextStage: null }),
  };
});

import { POST } from './route';
import { WORKFLOW_STAGES } from '@/lib/research-workflow';

const context = { params: Promise.resolve({ projectId: 'project-a' }) };
const sessionFrom = jest.fn();
const access = { user: { id: 'user-a', email: 'a@example.test', user_metadata: {} }, supabase: { from: sessionFrom, rpc: jest.fn() } };

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'like', 'order', 'limit', 'update', 'delete', 'in']) query[method] = jest.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function priorDocuments(stage: string, overrides: Record<string, unknown> = {}) {
  return WORKFLOW_STAGES.slice(0, WORKFLOW_STAGES.indexOf(stage as (typeof WORKFLOW_STAGES)[number])).map((previous, index) => ({
    id: `${previous}-1`, project_id: 'project-a', type: `journey:${previous}`, version: 1, created_at: `2026-09-0${(index % 9) + 1}T00:00:00.000Z`,
    content: JSON.stringify(overrides[previous] || { placeholder: true }),
  }));
}

function mockWrites(documents: unknown[]) {
  const stageInsert = jest.fn().mockResolvedValue({ error: null });
  let documentCall = 0;
  sessionFrom.mockImplementation((table: string) => {
    if (table === 'documents') {
      documentCall += 1;
      if (documentCall === 1) return chain({ data: documents, error: null });
      if (documentCall === 2) return { insert: stageInsert };
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    }
    return chain({ error: null });
  });
  serviceFrom.mockImplementation((table: string) => sessionFrom(table));
  return stageInsert;
}

function post(stage: string, content: Record<string, unknown>) {
  return POST(new Request('https://waha.test/api/projects/project-a/journey', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, content }),
  }), context);
}

const savedLiterature = { papers: [
  { id: 'p1', title: 'Study one', year: 2021 },
  { id: 'p2', title: 'Study two', year: 2022 },
  { id: 'p3', title: 'Study three', year: 2023 },
] };

const analysis = (supportingPaperIds: string[]) => ({
  introduction: 'تمهيد يربط الدراسات المختارة بعنوان البحث المعتمد.',
  thematicSynthesis: 'تخليق موضوعي للدراسات المختارة يبين ما تتفق عليه وما تختلف فيه من نتائج.',
  themes: [{ title: 'المحور الأول', synthesis: 'خلاصة المحور مبنية على الدراسات المحددة.', supportingPaperIds }],
  researchGapsIdentified: ['فجوة محتملة تحتاج تحققاً أوسع من الدراسات المختارة.'],
  conclusion: 'خلاصة أولية تحتاج مراجعة الباحث قبل الاعتماد.',
  limitations: ['اعتمد التخليق على المستخلصات المتاحة فقط.'],
  sources: [{ id: 'fabricated', title: 'Fabricated source' }],
});

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue(access);
  ownsProject.mockResolvedValue(true);
});

// Literature selection (by server-held result id) is covered in
// literature-selection.test.ts.

test('analysis: a theme citing a paper outside the saved literature is rejected before any write', async () => {
  const stageInsert = mockWrites(priorDocuments('analysis', { literature: savedLiterature }));

  const response = await post('analysis', analysis(['p1', 'not-in-literature']));

  expect(response.status).toBe(422);
  expect((await response.json()).error).toContain('رُفض حفظ التخليق');
  expect(stageInsert).not.toHaveBeenCalled();
});

test('analysis: a valid synthesis is re-validated and its source list is rebuilt from saved literature', async () => {
  const stageInsert = mockWrites(priorDocuments('analysis', { literature: savedLiterature }));

  const response = await post('analysis', analysis(['p1', 'p2']));

  expect(response.status).toBe(200);
  const stored = JSON.parse(stageInsert.mock.calls[0][0].content);
  expect(stored.themes[0].supportingPaperIds).toEqual(['p1', 'p2']);
  expect(stored.sources.map((source: { id: string }) => source.id)).toEqual(['p1', 'p2', 'p3']);
  expect(stored.serverDerivation.trustModel).toBe('server-derived/v1');
});
