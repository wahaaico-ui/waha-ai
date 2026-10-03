// Slice 1: discovered sources are selected by a server-issued result id and
// rehydrated from the server-held record for the same user and project. The
// browser may choose a server-known result but may not define one.
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => table === 'research_search_results' ? mockResults.client.from(table) : mockServiceFrom(table),
    rpc: (name: string, args: Record<string, unknown>) => mockResults.client.rpc(name, args),
  }),
}));
jest.mock('@/lib/academic/services/UnifiedResearchEngine', () => ({ UnifiedResearchEngine: { searchDetailed: jest.fn() } }));
jest.mock('@/lib/research-workflow', () => {
  const actual = jest.requireActual('@/lib/research-workflow');
  return { ...actual, evaluateGate: (stage: string) => ({ status: 'open', stage, reason: 'test gate', nextStage: null }) };
});

import { randomUUID } from 'node:crypto';
import { POST as journeyPost } from '@/app/api/projects/[projectId]/journey/route';
import { POST as libraryPost } from '@/app/api/research/library/route';
import { POST as citationPost } from '@/app/api/research/citations/route';
import { POST as searchPost } from '@/app/api/academic/search/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import { WORKFLOW_STAGES } from '@/lib/research-workflow';
import { createSearchResultsFake, discoveredMetadata } from '@/lib/test-support/search-results-fake';

const mockResults = createSearchResultsFake();
const mockServiceFrom = jest.fn();

const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const search = UnifiedResearchEngine.searchDetailed as jest.Mock;

function chain(result: unknown, captured?: { insert?: unknown }) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'like', 'order', 'limit', 'update', 'delete', 'in']) query[method] = jest.fn(() => query);
  query.insert = jest.fn((row: unknown) => { if (captured) captured.insert = row; return query; });
  query.maybeSingle = jest.fn().mockResolvedValue(result);
  query.single = jest.fn().mockResolvedValue(result);
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function signIn(userId: string, from: jest.Mock = jest.fn(() => chain({ data: null, error: null }))) {
  auth.mockResolvedValue({ user: { id: userId, email: `${userId}@example.test`, user_metadata: {} }, supabase: { from, rpc: jest.fn() } });
  owns.mockResolvedValue(true);
  return from;
}

const seed = (overrides: Partial<Parameters<typeof mockResults.seed>[0]> = {}) =>
  mockResults.seed({ user_id: 'user-a', project_id: 'project-a', metadata: discoveredMetadata(), ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
  mockResults.rows.splice(0);
  mockResults.rpcCalls.splice(0);
  mockResults.setResolve(null);
});

// ---- Journey literature stage -------------------------------------------------

function priorDocuments(literature?: Record<string, unknown>) {
  const stages = WORKFLOW_STAGES.slice(0, WORKFLOW_STAGES.indexOf('literature'));
  const documents = stages.map((stage, index) => ({
    id: `${stage}-1`, project_id: 'project-a', type: `journey:${stage}`, version: 1, created_at: `2026-09-0${(index % 9) + 1}T00:00:00.000Z`,
    content: JSON.stringify({ placeholder: true }),
  }));
  if (literature) documents.push({ id: 'literature-1', project_id: 'project-a', type: 'journey:literature', version: 1, created_at: '2026-09-09T00:00:00.000Z', content: JSON.stringify(literature) });
  return documents;
}

function journey(userId: string, content: Record<string, unknown>, literature?: Record<string, unknown>) {
  const documents = priorDocuments(literature);
  signIn(userId, jest.fn((table: string) => table === 'documents' ? chain({ data: documents, error: null }) : chain({ error: null })));
  const inserts: Array<{ type: string; content: string }> = [];
  mockServiceFrom.mockImplementation(() => ({ insert: jest.fn((row: { type: string; content: string }) => { inserts.push(row); return Promise.resolve({ error: null }); }) }));
  const response = journeyPost(new Request('https://waha.test/api/projects/project-a/journey', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'literature', content }),
  }), { params: Promise.resolve({ projectId: 'project-a' }) });
  const stored = () => {
    const row = inserts.find((insert) => insert.type === 'journey:literature');
    return row ? JSON.parse(row.content) : undefined;
  };
  return { response, stored };
}

describe('journey literature selection', () => {
  test('a valid result id stores the server-held metadata as discovered and unverified', async () => {
    const rows = [seed(), seed({ metadata: discoveredMetadata({ id: '10.1000/two', doi: '10.1000/two', title: 'Second server study' }) }), seed({ metadata: discoveredMetadata({ id: '10.1000/three', doi: '10.1000/three', title: 'Third server study' }) })];
    const { response, stored } = journey('user-a', { resultIds: rows.map((row) => row.id) });

    expect((await response).status).toBe(200);
    const saved = stored();
    expect(saved.papers.map((paper: { title: string }) => paper.title)).toEqual(['Server-held study title', 'Second server study', 'Third server study']);
    expect(saved.papers[0]).toEqual(expect.objectContaining({
      id: '10.1371/journal.pone.0298037', metadataOrigin: 'server_discovered',
      discovery: expect.objectContaining({ resultId: rows[0].id, searchRunId: rows[0].search_run_id, providers: ['openalex', 'crossref'] }),
    }));
    expect(saved.papers[0].item).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0 }));
    expect(saved.query).toBe('seeded query');
  });

  test('title, DOI, authors and provider sent alongside the id are ignored', async () => {
    const row = seed();
    const { response, stored } = journey('user-a', {
      resultIds: [row.id],
      papers: [{ id: row.id, resultId: row.id, title: 'Forged title', doi: '10.9999/forged', authors: 'Forged Author', item: { provenance: ['forged-provider'], verificationStatus: 'verified', confidenceScore: 99 } }],
      searchCoverage: { candidateResults: 999 },
    });

    expect((await response).status).toBe(200);
    const saved = stored();
    expect(saved.papers).toHaveLength(1);
    const text = JSON.stringify(saved);
    for (const forged of ['Forged title', '10.9999/forged', 'Forged Author', 'forged-provider', '"verified"', 'candidateResults']) expect(text).not.toContain(forged);
    expect(saved.papers[0].title).toBe('Server-held study title');
  });

  test.each([
    ['a fabricated id', () => randomUUID()],
    ['a malformed id', () => 'paper-ai-learning'],
    ['an id from another user', () => seed({ user_id: 'user-b' }).id],
    ['an id from another project of the same user', () => seed({ project_id: 'project-b' }).id],
    ['an expired id', () => seed({ expires_at: new Date(Date.now() - 1_000).toISOString() }).id],
  ])('%s is rejected without writing', async (_label, makeId) => {
    const valid = seed();
    const { response, stored } = journey('user-a', { resultIds: [valid.id, makeId()] });
    const result = await response;

    expect(result.status).toBe(422);
    expect((await result.json()).error).toContain('غير موجودة');
    expect(stored()).toBeUndefined();
  });

  test('a request that only sends paper objects is refused', async () => {
    const { response, stored } = journey('user-a', { papers: [{ id: 'p1', title: 'Client paper' }, { id: 'p2', title: 'Client paper 2' }, { id: 'p3', title: 'Client paper 3' }] });
    expect((await response).status).toBe(409);
    expect(stored()).toBeUndefined();
  });

  test('kept papers are copied from the saved stage, and legacy ones stay labelled client-submitted', async () => {
    const row = seed();
    const literature = { query: 'old query', papers: [
      { id: 'legacy-1', title: 'Legacy saved study', year: 2020, item: { verificationStatus: 'verified', confidenceScore: 95 } },
      { id: 'legacy-2', title: 'Second legacy study', year: 2021 },
    ] };
    const { response, stored } = journey('user-a', { resultIds: [row.id], keepPaperIds: ['legacy-1'], papers: [{ id: 'legacy-1', title: 'Renamed by client' }] }, literature);

    expect((await response).status).toBe(200);
    const saved = stored();
    expect(saved.papers.map((paper: { id: string }) => paper.id)).toEqual(['10.1371/journal.pone.0298037', 'legacy-1']);
    expect(saved.papers[1]).toEqual(expect.objectContaining({ title: 'Legacy saved study', metadataOrigin: 'client_submitted' }));
    expect(JSON.stringify(saved)).not.toContain('Renamed by client');
    expect(JSON.stringify(saved.papers[1])).not.toContain('"verified"');
  });

  test('a kept id that is not in the saved stage is rejected', async () => {
    const { response, stored } = journey('user-a', { keepPaperIds: ['never-saved'] }, { papers: [{ id: 'legacy-1', title: 'Legacy saved study' }] });
    expect((await response).status).toBe(422);
    expect(stored()).toBeUndefined();
  });
});

// ---- Project library ----------------------------------------------------------

function libraryRequest(body: Record<string, unknown>) {
  return libraryPost(new Request('http://localhost/api/research/library', { method: 'POST', body: JSON.stringify(body) }));
}

function libraryUser(userId: string) {
  const captured: { insert?: Record<string, unknown>; sessionInsert?: unknown } = {};
  // The session client only reads (existing-reference lookup) and must never
  // insert: project_references is written by the server client.
  const sessionLookup = chain({ data: null, error: null });
  sessionLookup.insert = jest.fn((row: unknown) => { captured.sessionInsert = row; return sessionLookup; });
  signIn(userId, jest.fn(() => sessionLookup));
  mockServiceFrom.mockImplementation((table: string) => {
    if (table !== 'project_references') throw new Error(`unexpected server write to ${table}`);
    const insert = chain({ data: null, error: null }, captured);
    // The saved row echoes what was inserted.
    insert.single = jest.fn(async () => ({ data: { id: 'ref-1', ...(captured.insert || {}) }, error: null }));
    return insert;
  });
  return captured;
}

describe('project library', () => {
  test('a valid result id stores server metadata and ignores forged fields', async () => {
    const row = seed();
    const captured = libraryUser('user-a');
    const response = await libraryRequest({ projectId: 'project-a', resultId: row.id, title: 'Forged title', doi: '10.9999/forged', authors: ['Forged'], provider: 'zotero' });
    const body = await response.json();

    expect(response.status).toBe(200);
    const inserted = captured.insert as Record<string, unknown>;
    expect(inserted).toEqual(expect.objectContaining({ provider: 'waha_discovery', title: 'Server-held study title', doi: '10.1371/journal.pone.0298037' }));
    expect(inserted.citation_data).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0, metadataOrigin: 'server_discovered', discovery: expect.objectContaining({ resultId: row.id }) }));
    expect(JSON.stringify(inserted)).not.toMatch(/Forged|10\.9999|zotero/);
    expect(body.item.origin).toBe('server_discovered');
    expect(captured.sessionInsert).toBeUndefined();
  });

  test.each([
    ['a fabricated id', () => randomUUID()],
    ['an id from another user', () => seed({ user_id: 'user-b' }).id],
    ['an id from another project', () => seed({ project_id: 'project-b' }).id],
  ])('%s is rejected without writing', async (_label, makeId) => {
    const captured = libraryUser('user-a');
    const response = await libraryRequest({ projectId: 'project-a', resultId: makeId() });
    expect(response.status).toBe(404);
    expect(captured.insert).toBeUndefined();
  });

  test('a manual reference is stored as user-asserted, never as discovered', async () => {
    const captured = libraryUser('user-a');
    const response = await libraryRequest({ projectId: 'project-a', item: { title: 'Manually entered study', doi: '10.1000/manual', authors: ['R. Searcher'], year: 2020, verificationStatus: 'verified', provenance: ['crossref'] } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(captured.insert).toEqual(expect.objectContaining({ provider: 'user_asserted', title: 'Manually entered study' }));
    expect((captured.insert as Record<string, unknown>).citation_data).toEqual(expect.objectContaining({ metadataOrigin: 'user_asserted', verificationStatus: 'unverified', provenance: [] }));
    expect(body.item.origin).toBe('user_asserted');
    expect(captured.sessionInsert).toBeUndefined();
  });

  test('sending both a result id and a reference is refused', async () => {
    const captured = libraryUser('user-a');
    const response = await libraryRequest({ projectId: 'project-a', resultId: seed().id, item: { title: 'Manual study' } });
    expect(response.status).toBe(400);
    expect(captured.insert).toBeUndefined();
  });
});

// ---- Citations ----------------------------------------------------------------

function citationRequest(body: Record<string, unknown>) {
  return citationPost(new Request('http://localhost/api/research/citations', { method: 'POST', body: JSON.stringify({ projectId: 'project-a', style: 'apa-7', ...body }) }));
}

describe('citations', () => {
  test('a valid result id is formatted from server metadata only', async () => {
    signIn('user-a');
    const row = seed();
    const response = await citationRequest({ resultId: row.id, item: { title: 'Forged title', verificationStatus: 'verified' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.origin).toBe('server_discovered');
    expect(body.item).toEqual(expect.objectContaining({ title: 'Server-held study title', verificationStatus: 'unverified', confidenceScore: 0 }));
    expect(JSON.stringify(body)).not.toContain('Forged title');
  });

  test.each([
    ['a fabricated id', () => randomUUID()],
    ['an id from another user', () => seed({ user_id: 'user-b' }).id],
    ['an id from another project', () => seed({ project_id: 'project-b' }).id],
  ])('%s is rejected', async (_label, makeId) => {
    signIn('user-a');
    const response = await citationRequest({ resultId: makeId() });
    expect(response.status).toBe(404);
  });

  test('a manual source is formatted as user-asserted and unverified', async () => {
    signIn('user-a');
    const response = await citationRequest({ item: { title: 'Manually entered study', authors: ['R. Searcher'], year: 2020, verificationStatus: 'verified', confidenceScore: 99 } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.origin).toBe('user_asserted');
    expect(body.item).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0 }));
  });
});

// ---- Evidence-panel search ----------------------------------------------------

describe('evidence-panel search', () => {
  const paper = { id: 'openalex:W1', title: 'Discovered study', abstract: 'Abstract', year: 2024, citationCount: 2, authors: ['A. Author'], doi: '10.1000/found', pdfUrl: null, url: 'https://doi.org/10.1000/found', source: 'openalex', sources: ['openalex', 'crossref'], subjects: [], publicationType: 'article', openAccess: true, relevanceScore: 70 };

  test('returns server-issued result ids for rows held for this user and project, with unverified items', async () => {
    signIn('user-a');
    search.mockResolvedValue({ domain: 'social-humanities', providers: [{ provider: 'openalex', available: true, papers: [paper], durationMs: 5 }], papers: [paper] });
    const response = await searchPost(new Request('http://localhost/api/academic/search', { method: 'POST', body: JSON.stringify({ query: 'discovered study', projectId: 'project-a' }) }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].resultId).toBe(mockResults.rows[0].id);
    expect(mockResults.rows[0]).toEqual(expect.objectContaining({ user_id: 'user-a', project_id: 'project-a', context: 'evidence_panel' }));
    expect(body.data[0].item).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0 }));
  });

  test('requires a project the caller owns', async () => {
    signIn('user-a');
    owns.mockResolvedValue(false);
    const response = await searchPost(new Request('http://localhost/api/academic/search', { method: 'POST', body: JSON.stringify({ query: 'discovered study', projectId: 'project-b' }) }));
    expect(response.status).toBe(404);
    expect(search).not.toHaveBeenCalled();
    expect(mockResults.rows).toHaveLength(0);
  });
});

// ---- Slice 2A: canonical works ------------------------------------------------

describe('canonical scholarly works', () => {
  const found = { id: 'https://openalex.org/W77', title: 'Discovered study about canonical identity', abstract: 'Provider abstract text', year: 2024, citationCount: 2, authors: ['A. Author'], doi: '10.1000/found', pdfUrl: null, url: 'https://doi.org/10.1000/found', source: 'openalex', sources: ['openalex'], subjects: [], publicationType: 'article', openAccess: true, relevanceScore: 70, providerIds: { openalex: 'https://openalex.org/W77' } };

  function runSearch() {
    search.mockResolvedValue({ domain: 'general', providers: [{ provider: 'openalex', available: true, papers: [found], durationMs: 5 }], papers: [found] });
    return searchPost(new Request('http://localhost/api/academic/search', { method: 'POST', body: JSON.stringify({ query: 'canonical identity study', projectId: 'project-a' }) }));
  }

  test('a search links each stored result to a canonical work resolved on the server, without storing the abstract canonically', async () => {
    signIn('user-a');
    const response = await runSearch();

    expect(response.status).toBe(200);
    expect(mockResults.rows[0].work_id).toEqual(expect.any(String));
    const [call] = mockResults.rpcCalls;
    expect(call.name).toBe('resolve_scholarly_works');
    expect(call.args.p_records).toEqual([expect.objectContaining({ identifiers: { doi: '10.1000/found', openalex: 'W77' } })]);
    expect(JSON.stringify(call.args)).not.toContain('Provider abstract text');
    // The browser receives the result id, not the work id.
    expect(JSON.stringify(await response.json())).not.toContain(String(mockResults.rows[0].work_id));
  });

  test('if canonical resolution fails the search still succeeds and results have no work', async () => {
    signIn('user-a');
    mockResults.setResolve(() => ({ data: null, error: { message: 'unavailable' } }));
    const response = await runSearch();

    expect(response.status).toBe(200);
    expect(mockResults.rows[0]).toEqual(expect.objectContaining({ work_id: null, user_id: 'user-a' }));
  });

  test('a work id sent by the browser is not accepted in place of a result id', async () => {
    const captured = libraryUser('user-a');
    const response = await libraryRequest({ projectId: 'project-a', workId: '6f1c7a52-2d1e-4c0b-9a51-0b7f1f1f2a10' });
    expect(response.status).toBe(400);
    expect(captured.insert).toBeUndefined();
  });

  test('a work id sent with a literature selection is ignored', async () => {
    const rows = [seed({ work_id: 'work-a' }), seed({ metadata: discoveredMetadata({ id: '10.1000/two', doi: '10.1000/two', title: 'Second server study' }) })];
    const { response, stored } = journey('user-a', { resultIds: rows.map((row) => row.id), workIds: ['forged-work'] });
    expect((await response).status).toBe(200);
    expect(JSON.stringify(stored())).not.toContain('forged-work');
  });

  test('a result linked to the same canonical work is still isolated to its own user and project', async () => {
    const otherUser = seed({ user_id: 'user-b', work_id: 'shared-work' });
    const otherProject = seed({ project_id: 'project-b', work_id: 'shared-work' });
    seed({ work_id: 'shared-work' });
    for (const row of [otherUser, otherProject]) {
      libraryUser('user-a');
      expect((await libraryRequest({ projectId: 'project-a', resultId: row.id })).status).toBe(404);
    }
  });
});
