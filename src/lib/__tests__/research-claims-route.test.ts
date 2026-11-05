// Slice 5: claims and claim support. A link joins a claim and evidence of the
// same project; a system suggestion stays distinguishable from a researcher's
// link; a contradiction is kept as recorded.
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));

import { GET as listClaims, POST as createClaim, PATCH as updateClaim } from '@/app/api/projects/[projectId]/claims/route';
import { DELETE as removeSupport, PATCH as decideSupport, POST as linkSupport } from '@/app/api/projects/[projectId]/claims/supports/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { recordSuggestedSupport } from '@/lib/research-claims';
import { createTableFake } from '@/lib/test-support/table-fake';

const mockDb = createTableFake();
const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const PROJECT_A = '10000000-0000-4000-8000-00000000000a';
const PROJECT_B = '10000000-0000-4000-8000-00000000000b';
const context = (projectId = PROJECT_A) => ({ params: Promise.resolve({ projectId }) });
const json = (method: string, body?: unknown, query = '') => new Request(`http://localhost/x${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

let evidenceA: Record<string, unknown>;
let evidenceB: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.reset();
  auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: mockDb.session });
  owns.mockImplementation(async (projectId: string) => projectId === PROJECT_A);
  evidenceA = mockDb.seed('evidence_items', { project_id: PROJECT_A, state: 'recorded' });
  evidenceB = mockDb.seed('evidence_items', { project_id: PROJECT_B, state: 'recorded' });
});

async function newClaim(statement = 'Few studies examine AI use among Arab postgraduate students.') {
  const response = await createClaim(json('POST', { statement, claimType: 'gap', origin: 'system', status: 'draft', created_by: 'someone-else' }), context());
  return (await response.json()).claim as Record<string, unknown>;
}

test('a researcher claim is the researcher\'s and active, whatever origin the browser sends', async () => {
  const claim = await newClaim();
  expect(claim).toEqual(expect.objectContaining({ project_id: PROJECT_A, origin: 'researcher', status: 'active' }));
  expect(mockDb.rows('claims')[0].created_by).toBe('user-a');
});

test('claim support cannot reference evidence from another project', async () => {
  const claim = await newClaim();
  const response = await linkSupport(json('POST', { claimId: claim.id, evidenceItemId: evidenceB.id, relation: 'supports' }), context());
  expect(response.status).toBe(404);
  expect(mockDb.rows('claim_supports')).toHaveLength(0);
});

test('a system-suggested link is distinguishable from a researcher-confirmed one, before and after the decision', async () => {
  const claim = await newClaim();
  const evidenceTwo = mockDb.seed('evidence_items', { project_id: PROJECT_A, state: 'recorded' });
  const researcher = await (await linkSupport(json('POST', { claimId: claim.id, evidenceItemId: evidenceA.id, relation: 'supports', origin: 'system', confirmation: 'suggested' }), context())).json();
  expect(researcher.support).toEqual(expect.objectContaining({ origin: 'researcher', confirmation: 'confirmed' }));

  const suggestedId = await recordSuggestedSupport(mockDb.service as never, { projectId: PROJECT_A, claimId: claim.id as string, evidenceItemId: evidenceTwo.id as string, relation: 'supports', rationale: 'model rationale', provenance: { model: 'test' } });
  const listed = await (await listClaims(json('GET'), context())).json();
  const links = listed.claims[0].supports as Array<Record<string, unknown>>;
  expect(links.find((link) => link.id === suggestedId)).toEqual(expect.objectContaining({ origin: 'system', confirmation: 'suggested' }));

  const confirmed = await (await decideSupport(json('PATCH', { supportId: suggestedId, decision: 'confirm' }), context())).json();
  expect(confirmed.support).toEqual(expect.objectContaining({ origin: 'system', confirmation: 'confirmed' }));
  expect(mockDb.rows('claim_supports').find((link) => link.id === suggestedId)?.decided_by).toBe('user-a');
  // A researcher's own link is not a suggestion and cannot be "confirmed" again.
  expect((await decideSupport(json('PATCH', { supportId: researcher.support.id, decision: 'reject' }), context())).status).toBe(409);
});

test('a contradiction is kept: the relation is not changed in place and a second relation for the same pair is refused', async () => {
  const claim = await newClaim();
  const link = await (await linkSupport(json('POST', { claimId: claim.id, evidenceItemId: evidenceA.id, relation: 'contradicts', rationale: 'The study reports the opposite.' }), context())).json();
  expect(link.support).toEqual(expect.objectContaining({ relation: 'contradicts' }));
  mockDb.constraints.set('claim_supports', (row, kind) => kind === 'insert' && mockDb.rows('claim_supports').some((existing) => existing.claim_id === row.claim_id && existing.evidence_item_id === row.evidence_item_id) ? '23505' : null);
  expect((await linkSupport(json('POST', { claimId: claim.id, evidenceItemId: evidenceA.id, relation: 'supports' }), context())).status).toBe(409);
  // PATCH only records a decision on a suggestion; a relation in the body is ignored.
  await decideSupport(json('PATCH', { supportId: link.support.id, decision: 'confirm', relation: 'supports' }), context());
  expect(mockDb.rows('claim_supports')[0].relation).toBe('contradicts');
  const audit = mockDb.rows('research_integrity_events').filter((event) => event.entity_type === 'claim_support');
  expect(audit).toEqual([expect.objectContaining({ action: 'created', details: expect.objectContaining({ relation: 'contradicts' }) })]);
});

test('activating a system-proposed claim records the researcher confirmation', async () => {
  const proposed = mockDb.seed('claims', { project_id: PROJECT_A, origin: 'system', status: 'draft', confirmed_at: null, statement: 'Proposed gap.' });
  const updated = await (await updateClaim(json('PATCH', { claimId: proposed.id, status: 'active', origin: 'researcher' }), context())).json();
  expect(updated.claim).toEqual(expect.objectContaining({ origin: 'system', status: 'active' }));
  expect(mockDb.rows('claims')[0]).toEqual(expect.objectContaining({ confirmed_by: 'user-a' }));
});

test('another project\'s claims and links cannot be read or changed', async () => {
  const foreignClaim = mockDb.seed('claims', { project_id: PROJECT_B, origin: 'researcher', status: 'active', statement: 'B claim' });
  const foreignLink = mockDb.seed('claim_supports', { project_id: PROJECT_B, claim_id: foreignClaim.id, evidence_item_id: evidenceB.id, relation: 'contradicts', origin: 'system', confirmation: 'suggested' });
  expect((await listClaims(json('GET'), context(PROJECT_B))).status).toBe(404);
  expect((await updateClaim(json('PATCH', { claimId: foreignClaim.id, status: 'retired' }), context())).status).toBe(404);
  expect((await decideSupport(json('PATCH', { supportId: foreignLink.id, decision: 'confirm' }), context())).status).toBe(404);
  expect((await removeSupport(json('DELETE', undefined, `?supportId=${foreignLink.id}`), context())).status).toBe(404);
  expect(mockDb.rows('claim_supports')[0]).toEqual(expect.objectContaining({ confirmation: 'suggested', relation: 'contradicts' }));
});
