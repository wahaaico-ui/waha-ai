// Slice 6: conservative gap intelligence. A gap is evidence-backed only within
// a recorded search scope and with enough source-grounded, researcher-confirmed
// support; contradictions and limitations are always kept; the browser cannot
// set the classification; there is no verified classification.
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));

import { GET, PATCH, POST } from '@/app/api/projects/[projectId]/gaps/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { assessGap, GAP_CLASSIFICATIONS, type GapLink, type GapSearchRun } from '@/lib/research-gaps';
import { searchLimitations } from '@/lib/research-search-results';
import { createTableFake } from '@/lib/test-support/table-fake';

const mockDb = createTableFake();
const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const PROJECT_A = '10000000-0000-4000-8000-00000000000a';
const PROJECT_B = '10000000-0000-4000-8000-00000000000b';
const context = (projectId = PROJECT_A) => ({ params: Promise.resolve({ projectId }) });
const json = (method: string, body?: unknown) => new Request('http://localhost/x', { method, body: body === undefined ? undefined : JSON.stringify(body) });

let n = 0;
function link(relation: GapLink['relation'], evidence: Partial<NonNullable<GapLink['evidence']>> = {}, overrides: Partial<GapLink> = {}): GapLink {
  n += 1;
  return { id: `link-${n}`, relation, origin: 'researcher', confirmation: 'confirmed', evidence: { id: `evidence-${n}`, state: 'recorded', project_reference_id: `ref-${n}`, work_id: `work-${n}`, source_kind: 'server_discovered', ...evidence }, ...overrides };
}
const run: GapSearchRun = { id: 'run-1', query: 'AI postgraduate Arab universities', executed_at: '2026-10-06T00:00:00.000Z', providers_attempted: 3, providers_available: 2, result_count: 18, limitations: ['generic', 'Unavailable during this search: core.'] };

describe('gap rules', () => {
  test('without confirmed support the result is only a signal', () => {
    const result = assessGap([link('supports', {}, { origin: 'system', confirmation: 'suggested' })], [run]);
    expect(result.classification).toBe('SIGNAL');
    expect(result.basis.excludedSuggestions).toBe(1);
    expect(result.limitations.join(' ')).toMatch(/not confirmed by the researcher were not counted/);
  });

  test('it cannot become evidence-backed without a recorded search scope', () => {
    const result = assessGap([link('supports'), link('supports')], []);
    expect(result.classification).toBe('POTENTIAL_GAP');
    expect(result.searchRunIds).toEqual([]);
    expect(result.limitations).toEqual(expect.arrayContaining(['No recorded search with an available provider exists for this project.']));
  });

  test('it cannot become evidence-backed with only one source, user-asserted support, or unavailable providers', () => {
    const shared = { work_id: 'same-work', project_reference_id: 'same-ref' };
    expect(assessGap([link('supports', shared), link('supports', shared)], [run]).classification).toBe('POTENTIAL_GAP');
    expect(assessGap([link('supports', { state: 'user_asserted' }), link('supports', { state: 'user_asserted' })], [run]).classification).toBe('POTENTIAL_GAP');
    expect(assessGap([link('supports'), link('supports')], [{ ...run, providers_available: 0 }]).classification).toBe('POTENTIAL_GAP');
  });

  test('two researcher-confirmed source-supported items from two sources within a recorded scope are evidence-backed within that scope only', () => {
    const result = assessGap([link('supports', { state: 'source_supported' }), link('supports', { state: 'source_supported' })], [run]);
    expect(result.classification).toBe('EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE');
    expect(result.basis.qualifyingSupportingEvidence).toHaveLength(2);
    expect(result.searchRunIds).toEqual(['run-1']);
    expect(result.limitations[0]).toMatch(/not an exhaustive review/);
    expect(result.limitations).toContain('Unavailable during this search: core.');
  });

  test('evidence the researcher has not confirmed as present in its source never qualifies, however many links there are', () => {
    // A confirmed link (claim_supports.confirmation) is not enough: the evidence item itself must be source_supported.
    for (const state of ['recorded', 'needs_review', 'user_asserted']) {
      const many = assessGap(Array.from({ length: 6 }, () => link('supports', { state })), [run]);
      expect(many.classification).toBe('POTENTIAL_GAP');
      expect(many.basis.groundedSupportingEvidence).toBe(0);
      expect(many.basis.qualifyingSupportingEvidence).toEqual([]);
      expect(many.basis.supportingEvidence).toHaveLength(6);
      expect(many.limitations.join(' ')).toMatch(/6 supporting item\(s\) have not been confirmed by the researcher as present in their source/);
    }
    const single = assessGap([link('supports')], [run]);
    expect(single.classification).toBe('POTENTIAL_GAP');
    expect(single.rationale[0]).toMatch(/^Supporting evidence is limited: 0 item\(s\) confirmed by the researcher as source-supported/);
  });

  test('one confirmed item plus unconfirmed ones from other sources is still not evidence-backed', () => {
    const confirmed = link('supports', { state: 'source_supported' });
    const result = assessGap([confirmed, link('supports'), link('supports', { state: 'needs_review' })], [run]);
    expect(result.classification).toBe('POTENTIAL_GAP');
    expect(result.basis.qualifyingSupportingEvidence).toEqual([confirmed.evidence?.id]);
    expect(result.basis.distinctSupportingSources).toBe(1);
  });

  test('contradicting evidence is retained, and dominant contradiction means more evidence is needed', () => {
    const contested = assessGap([link('supports'), link('contradicts'), link('contradicts')], [run]);
    expect(contested.classification).toBe('NEEDS_MORE_EVIDENCE');
    expect(contested.basis.contradictingEvidence).toHaveLength(2);
    const outweighed = assessGap([link('supports', { state: 'source_supported' }), link('supports', { state: 'source_supported' }), link('supports'), link('contradicts')], [run]);
    expect(outweighed.classification).toBe('EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE');
    expect(outweighed.basis.contradictingEvidence).toHaveLength(1);
    expect(outweighed.limitations.join(' ')).toMatch(/1 contradicting evidence item/);
  });

  test('every result carries limitations, and no classification is a verified gap', () => {
    expect(GAP_CLASSIFICATIONS).not.toContain('VERIFIED_GAP');
    for (const links of [[], [link('supports')], [link('supports'), link('supports')]]) {
      const result = assessGap(links, [run]);
      expect(result.limitations.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toMatch(/verified|proven/i);
    }
  });

  test('every recorded search states that it is not exhaustive and names unavailable providers', () => {
    const limitations = searchLimitations({ domain: 'general', candidateCount: 30, providers: [{ provider: 'openalex', available: true, papers: [], durationMs: 1 }, { provider: 'core', available: false, papers: [], durationMs: 1 }] }, 20);
    expect(limitations[0]).toMatch(/not an exhaustive review/);
    expect(limitations).toEqual(expect.arrayContaining(['Unavailable during this search: core.', '10 retrieved record(s) were not kept after relevance filtering.']));
  });
});

describe('gap assessment route', () => {
  let claim: Record<string, unknown>;
  let one: Record<string, unknown>;
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.reset();
    auth.mockResolvedValue({ user: { id: 'user-a' }, supabase: mockDb.session });
    owns.mockImplementation(async (projectId: string) => projectId === PROJECT_A);
    claim = mockDb.seed('claims', { project_id: PROJECT_A, claim_type: 'gap', status: 'active' });
    one = mockDb.seed('evidence_items', { project_id: PROJECT_A, state: 'recorded', project_reference_id: 'r1', work_id: 'w1', source_kind: 'server_discovered' });
    const two = mockDb.seed('evidence_items', { project_id: PROJECT_A, state: 'source_supported', project_reference_id: 'r2', work_id: 'w2', source_kind: 'server_discovered' });
    const against = mockDb.seed('evidence_items', { project_id: PROJECT_A, state: 'recorded', project_reference_id: 'r3', work_id: 'w3', source_kind: 'server_discovered' });
    for (const [evidence, relation] of [[one, 'supports'], [two, 'supports'], [against, 'contradicts']] as const) {
      mockDb.seed('claim_supports', { project_id: PROJECT_A, claim_id: claim.id, evidence_item_id: evidence.id, relation, origin: 'researcher', confirmation: 'confirmed' });
    }
  });

  test('the server classifies from the recorded scope and ignores a classification sent by the browser', async () => {
    const withoutScope = await (await POST(json('POST', { claimId: claim.id, classification: 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE', basis: { groundedSupportingEvidence: 99 } }), context())).json();
    expect(withoutScope.assessment).toEqual(expect.objectContaining({ classification: 'POTENTIAL_GAP', origin: 'system', researcher_confirmation: 'unreviewed', search_run_ids: [] }));

    mockDb.seed('research_search_runs', { project_id: PROJECT_A, query: 'q', executed_at: '2026-10-06T00:00:00.000Z', providers_attempted: 2, providers_available: 1, result_count: 10, limitations: ['generic'] });
    // One supporting item is only recorded from a discovered source, not confirmed by the researcher.
    const unconfirmed = await (await POST(json('POST', { claimId: claim.id }), context())).json();
    expect(unconfirmed.assessment.classification).toBe('POTENTIAL_GAP');
    expect(unconfirmed.assessment.basis.qualifyingSupportingEvidence).toEqual([expect.any(String)]);
    expect(unconfirmed.assessment.method_version).toBe('gap-rules-v2');

    one.state = 'source_supported';
    const withScope = await (await POST(json('POST', { claimId: claim.id }), context())).json();
    expect(withScope.assessment.classification).toBe('EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE');
    expect(withScope.assessment.basis.qualifyingSupportingEvidence).toHaveLength(2);
    expect(withScope.assessment.basis.contradictingEvidence).toHaveLength(1);
    expect(withScope.assessment.limitations.length).toBeGreaterThan(1);
    expect(mockDb.writes.filter((write) => write.table === 'gap_assessments').every((write) => write.client === 'service')).toBe(true);
  });

  test('accepting records only the researcher decision; the classification cannot be changed', async () => {
    const created = await (await POST(json('POST', { claimId: claim.id }), context())).json();
    const decided = await (await PATCH(json('PATCH', { assessmentId: created.assessment.id, decision: 'accept', classification: 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE' }), context())).json();
    expect(decided.assessment).toEqual(expect.objectContaining({ researcher_confirmation: 'accepted', classification: created.assessment.classification }));
    const update = mockDb.writes.find((write) => write.table === 'gap_assessments' && write.kind === 'update');
    expect(Object.keys(update?.row || {}).sort()).toEqual(['confirmed_at', 'confirmed_by', 'id', 'researcher_confirmation']);
  });

  test('only active gap claims of this project are assessed, and other projects are refused', async () => {
    const problem = mockDb.seed('claims', { project_id: PROJECT_A, claim_type: 'problem', status: 'active' });
    expect((await POST(json('POST', { claimId: problem.id }), context())).status).toBe(422);
    const foreign = mockDb.seed('claims', { project_id: PROJECT_B, claim_type: 'gap', status: 'active' });
    expect((await POST(json('POST', { claimId: foreign.id }), context())).status).toBe(404);
    expect((await GET(json('GET'), context(PROJECT_B))).status).toBe(404);
    expect(mockDb.rows('gap_assessments')).toHaveLength(0);
  });
});
