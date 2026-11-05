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

import { GET, POST } from './route';

const context = { params: Promise.resolve({ projectId: 'project-a' }) };
const sessionFrom = jest.fn();
const access = { user: { id: 'user-a', email: 'a@example.test', user_metadata: {} }, supabase: { from: sessionFrom, rpc: jest.fn() } };

// A thenable query double: every builder method returns the chain, and awaiting
// it (or calling maybeSingle/single) resolves to the given result.
function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'like', 'order', 'limit', 'update', 'delete', 'in']) query[method] = jest.fn(() => query);
  query.maybeSingle = jest.fn().mockResolvedValue(result);
  query.single = jest.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
}

const serverPaths = [
  { id: 'local-context', title: 'مسار السياق المحلي لدراسة التعلم الإلكتروني', rationale: 'r', evidenceLevel: 'suggestion', supportingReferences: [] },
  { id: 'recent-evidence', title: 'مسار الأدلة الحديثة لدراسة التعلم الإلكتروني', rationale: 'r', evidenceLevel: 'suggestion', supportingReferences: [] },
  { id: 'replication', title: 'مسار إعادة اختبار نتيجة مرجعية في التعلم الإلكتروني', rationale: 'r', evidenceLevel: 'suggestion', supportingReferences: [] },
];

function serverReport(overrides: Record<string, unknown> = {}) {
  return {
    topic: 'أثر التعلم الإلكتروني على تحصيل الطلبة',
    researcherInput: { scenario: 'idea', candidateTitles: [], rejectionFeedback: null },
    decision: 'proceed',
    acceptanceScore: 64,
    gaps: ['مؤشر خادم'],
    topPapers: [{ title: 'Server paper', year: 2024, citations: 3, url: 'https://doi.org/10.1000/server', source: 'openalex' }],
    searchCoverage: { queryCount: 2, candidateResults: 30, uniqueStudies: 12, excludedByRelevance: 18, searchedAt: '2026-09-27T00:00:00.000Z', sources: [], scopeNote: 'n' },
    researcherContext: { countryCode: null, countryName: null, specialty: null, university: null, level: null },
    contextMatch: { localAffiliationMatches: 0, note: 'n' },
    researchPaths: serverPaths,
    evidenceLimitations: ['limit'],
    ...overrides,
  };
}

const forgedVerifyContent = {
  decision: 'proceed',
  acceptanceScore: 100,
  searchCoverage: { uniqueStudies: 999 },
  researchPaths: [{ id: 'forged-1' }, { id: 'forged-2' }, { id: 'forged-3' }],
  sources: [{ title: 'Fabricated study', url: 'https://example.test' }],
};

function mockVerifyWrites(verificationDocument: unknown, journeyDocuments: unknown[] = []) {
  const stageInsert = jest.fn().mockResolvedValue({ error: null });
  const decisionInsert = jest.fn().mockResolvedValue({ error: null });
  let documentCall = 0;
  sessionFrom.mockImplementation((table: string) => {
    if (table === 'documents') {
      documentCall += 1;
      if (documentCall === 1) return chain({ data: journeyDocuments, error: null });
      if (documentCall === 2) return chain({ data: verificationDocument, error: null });
      if (documentCall === 3) return { insert: stageInsert };
      return { insert: decisionInsert };
    }
    return chain({ error: null });
  });
  serviceFrom.mockImplementation((table: string) => sessionFrom(table));
  return { stageInsert, decisionInsert };
}

function post(stage: string, content: Record<string, unknown>) {
  return POST(new Request('https://waha.test/api/projects/project-a/journey', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, content }),
  }), context);
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue(access);
  ownsProject.mockResolvedValue(true);
});

describe('verify gate uses the server-stored exploration, not the request', () => {
  test('forged decision, score, coverage and paths cannot open the gate when the server decided "improve"', async () => {
    const report = serverReport({ decision: 'improve', acceptanceScore: 41 });
    const { stageInsert } = mockVerifyWrites({ id: 'verification-1', version: 1, content: JSON.stringify(report) });

    const response = await post('verify', { ...forgedVerifyContent, selectedResearchPath: { id: 'recent-evidence' } });

    expect(response.status).toBe(422);
    expect((await response.json()).gate.status).toBe('needs_improvement');
    expect(stageInsert).not.toHaveBeenCalled();
  });

  test('stored verify output is derived from the server report and ignores forged fields', async () => {
    const { stageInsert, decisionInsert } = mockVerifyWrites({ id: 'verification-1', version: 3, content: JSON.stringify(serverReport()) });

    const response = await post('verify', { ...forgedVerifyContent, selectedResearchPath: { id: 'recent-evidence', title: 'Forged title' } });

    expect(response.status).toBe(200);
    const stored = JSON.parse(stageInsert.mock.calls[0][0].content);
    expect(stored.acceptanceScore).toBe(64);
    expect(stored.scoreStatus).toBe('legacy_heuristic');
    expect(stored.searchCoverage.uniqueStudies).toBe(12);
    expect(stored.researchPaths.map((path: { id: string }) => path.id)).toEqual(['local-context', 'recent-evidence', 'replication']);
    expect(stored.selectedResearchPath.title).toBe(serverPaths[1].title);
    expect(stored.sources[0].title).toBe('Server paper');
    expect(stored.serverDerivation).toEqual(expect.objectContaining({ trustModel: 'server-derived/v1', verificationDocumentId: 'verification-1', verificationVersion: 3 }));
    expect(decisionInsert).toHaveBeenCalledTimes(1);
    expect(serviceFrom).toHaveBeenCalledWith('documents');
    expect(serviceFrom).toHaveBeenCalledTimes(2);
  });

  test('a path that is not in the server report is rejected before any write', async () => {
    const { stageInsert } = mockVerifyWrites({ id: 'verification-1', version: 1, content: JSON.stringify(serverReport()) });

    const response = await post('verify', { ...forgedVerifyContent, researchPaths: [...serverPaths, { id: 'forged-path' }], selectedResearchPath: { id: 'forged-path' } });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain('المسار المختار غير موجود');
    expect(stageInsert).not.toHaveBeenCalled();
  });

  test('without a server exploration report the verify stage cannot be saved', async () => {
    const { stageInsert } = mockVerifyWrites(null);

    const response = await post('verify', { ...forgedVerifyContent, selectedResearchPath: { id: 'forged-1' } });

    expect(response.status).toBe(409);
    expect(stageInsert).not.toHaveBeenCalled();
  });

  test('the compare-titles path is rebuilt on the server for a compare_titles exploration', async () => {
    const report = serverReport({ researcherInput: { scenario: 'compare_titles', candidateTitles: ['عنوان أول للمقارنة', 'عنوان ثانٍ للمقارنة'], rejectionFeedback: null } });
    const { stageInsert } = mockVerifyWrites({ id: 'verification-1', version: 1, content: JSON.stringify(report) });

    const response = await post('verify', { selectedResearchPath: { id: 'provided-title-comparison', title: 'Forged' } });

    expect(response.status).toBe(200);
    const stored = JSON.parse(stageInsert.mock.calls[0][0].content);
    expect(stored.selectedResearchPath.title).toBe('مقارنة العناوين التي قدّمها الباحث');
    expect(stored.selectedResearchPath.supportingReferences[0].title).toBe('Server paper');
  });
});

// Literature and analysis writes are covered in trust-boundary-stages.test.ts;
// here only the read path is checked.
describe('journey read path does not surface client-reported verification', () => {
  test('legacy literature marked "verified" by the browser is returned as unverified and labelled legacy', async () => {
    const documents = [{
      id: 'literature-1', project_id: 'project-a', type: 'journey:literature', version: 1, created_at: '2026-09-01T00:00:00.000Z',
      content: JSON.stringify({ papers: [{ id: 'p1', title: 'Legacy paper', item: { title: 'Legacy paper', verificationStatus: 'verified', confidenceScore: 97 } }] }),
    }];
    let call = 0;
    sessionFrom.mockImplementation(() => {
      call += 1;
      return chain({ data: call === 1 ? documents : [], error: null });
    });

    const response = await GET(new Request('https://waha.test/api/projects/project-a/journey'), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.outputs.literature.papers[0].item.verificationStatus).toBe('unverified');
    expect(body.outputs.literature.papers[0].item.confidenceScore).toBe(0);
    expect(body.trust.literature).toBe('legacy_client_submitted');
  });
});
