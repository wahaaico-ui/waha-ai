// Slice 4: project evidence items. Evidence belongs to one project and cites
// only that project's references; its state, source and canonical work are set
// by the server, and only the researcher can confirm or reject support.
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));

import { DELETE, GET, PATCH, POST } from '@/app/api/projects/[projectId]/evidence/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';

const mockDb = createTableFake();
const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;

const PROJECT_A = '10000000-0000-4000-8000-00000000000a';
const PROJECT_B = '10000000-0000-4000-8000-00000000000b';
const WORK = '20000000-0000-4000-8000-000000000001';

function context(projectId = PROJECT_A) { return { params: Promise.resolve({ projectId }) }; }
function json(method: string, body: unknown, query = '') {
  return new Request(`http://localhost/api/projects/x/evidence${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

let discovered: Record<string, unknown>;
let manual: Record<string, unknown>;
let otherProjectReference: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.reset();
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: mockDb.session });
  owns.mockImplementation(async (projectId: string) => projectId === PROJECT_A);
  discovered = mockDb.seed('project_references', { project_id: PROJECT_A, provider: 'waha_discovery', citation_data: { discovery: { resultId: 'r1' } }, work_id: WORK });
  manual = mockDb.seed('project_references', { project_id: PROJECT_A, provider: 'user_asserted', citation_data: {}, work_id: null });
  otherProjectReference = mockDb.seed('project_references', { project_id: PROJECT_B, provider: 'waha_discovery', citation_data: { discovery: { resultId: 'r2' } }, work_id: WORK });
});

const serverWrites = (table: string) => mockDb.writes.filter((write) => write.table === table);

test('evidence from a discovered reference belongs to the project, cites it and inherits its canonical work', async () => {
  const response = await POST(json('POST', { projectReferenceId: discovered.id, evidenceType: 'finding', content: 'Students used AI to simplify concepts.' }), context());
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.item).toEqual(expect.objectContaining({ project_id: PROJECT_A, project_reference_id: discovered.id, work_id: WORK, source_kind: 'server_discovered', state: 'recorded', state_set_by: 'system', origin: 'researcher' }));
  expect(serverWrites('evidence_items').every((write) => write.client === 'service')).toBe(true);
  expect(serverWrites('research_integrity_events')).toEqual([expect.objectContaining({ client: 'service', row: expect.objectContaining({ entity_type: 'evidence_item', action: 'created', project_id: PROJECT_A }) })]);
});

test('state, work, origin and source sent by the browser are ignored', async () => {
  const response = await POST(json('POST', { projectReferenceId: manual.id, evidenceType: 'finding', content: 'A claim from a manual source.', state: 'source_supported', work_id: WORK, workId: WORK, origin: 'system', source_kind: 'server_discovered', project_id: PROJECT_B }), context());
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.item).toEqual(expect.objectContaining({ project_id: PROJECT_A, state: 'user_asserted', work_id: null, source_kind: 'user_asserted', origin: 'researcher' }));
});

test('a reference from another project cannot be cited', async () => {
  const response = await POST(json('POST', { projectReferenceId: otherProjectReference.id, evidenceType: 'finding', content: 'Borrowed evidence.' }), context());
  expect(response.status).toBe(404);
  expect(serverWrites('evidence_items')).toHaveLength(0);
});

test('another project\'s evidence cannot be read, changed or deleted', async () => {
  const foreign = mockDb.seed('evidence_items', { project_id: PROJECT_B, content: 'B evidence', state: 'recorded', project_reference_id: otherProjectReference.id });
  expect((await GET(json('GET', undefined), context(PROJECT_B))).status).toBe(404);
  expect((await PATCH(json('PATCH', { evidenceId: foreign.id, state: 'source_supported' }), context(PROJECT_B))).status).toBe(404);
  expect((await PATCH(json('PATCH', { evidenceId: foreign.id, state: 'source_supported' }), context())).status).toBe(404);
  expect((await DELETE(json('DELETE', undefined, `?evidenceId=${foreign.id}`), context())).status).toBe(404);
  expect(mockDb.rows('evidence_items')[0]).toEqual(expect.objectContaining({ state: 'recorded', content: 'B evidence' }));
  const listed = await (await GET(json('GET', undefined), context())).json();
  expect(listed.items).toEqual([]);
});

test('only the researcher confirms support, only against a cited source, and the server-only states cannot be chosen', async () => {
  const created = await (await POST(json('POST', { projectReferenceId: discovered.id, evidenceType: 'finding', content: 'Recorded point.' }), context())).json();
  const unsourced = await (await POST(json('POST', { evidenceType: 'context', content: 'Researcher note without a source.' }), context())).json();
  expect(unsourced.item).toEqual(expect.objectContaining({ source_kind: 'none', state: 'user_asserted', project_reference_id: null }));

  expect((await PATCH(json('PATCH', { evidenceId: created.item.id, state: 'recorded' }), context())).status).toBe(422);
  expect((await PATCH(json('PATCH', { evidenceId: unsourced.item.id, state: 'source_supported' }), context())).status).toBe(422);

  const confirmed = await (await PATCH(json('PATCH', { evidenceId: created.item.id, state: 'source_supported', state_set_by: 'system' }), context())).json();
  expect(confirmed.item).toEqual(expect.objectContaining({ state: 'source_supported', state_set_by: 'researcher' }));

  // Editing the text withdraws the earlier judgement.
  const edited = await (await PATCH(json('PATCH', { evidenceId: created.item.id, content: 'Reworded point.' }), context())).json();
  expect(edited.item).toEqual(expect.objectContaining({ state: 'needs_review', state_set_by: 'system', content: 'Reworded point.' }));
});

test('evidence linked to a claim is not deleted', async () => {
  const created = await (await POST(json('POST', { projectReferenceId: discovered.id, evidenceType: 'finding', content: 'Linked evidence.' }), context())).json();
  mockDb.constraints.set('evidence_items', (_row, kind) => kind === 'delete' ? '23503' : null);
  const response = await DELETE(json('DELETE', undefined, `?evidenceId=${created.item.id}`), context());
  expect(response.status).toBe(409);
  expect(mockDb.rows('evidence_items')).toHaveLength(1);
});

test('unauthenticated requests are refused before any read', async () => {
  auth.mockResolvedValue(null);
  expect((await GET(json('GET', undefined), context())).status).toBe(401);
  expect((await POST(json('POST', { evidenceType: 'finding', content: 'x' }), context())).status).toBe(401);
  expect(owns).not.toHaveBeenCalled();
});
