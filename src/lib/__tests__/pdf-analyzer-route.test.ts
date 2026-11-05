// pdf-analyzer stores the uploaded PDF text first and treats AI analysis as
// best-effort, so a provider failure cannot block deterministic citation
// extraction. The real generateStructured runs with fetch mocked per test.
type SourceRow = { id: string; project_id: string; raw_text: string; confidence: string | null; parsed_citation_apa?: string | null; parsed_citation_ieee?: string | null };

const store: { sources: SourceRow[] } = { sources: [] };
const sourceWrites: Array<{ kind: 'insert' | 'update'; row: Record<string, unknown> }> = [];
const documents: Array<Record<string, unknown>> = [];
const documentsTable = {
  insert: async (row: Record<string, unknown>) => { documents.push(row); return { error: null }; },
  select: () => {
    const filters: Record<string, unknown> = {};
    const q = { eq: (key: string, value: unknown) => { filters[key] = value; return q; }, maybeSingle: async () => ({ data: documents.find((row) => Object.entries(filters).every(([key, value]) => row[key] === value)) || null, error: null }), limit: async () => ({ data: documents.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)), error: null }) }; return q;
  },
};

// In-memory stand-in for the `sources` table used by both routes. Writes go
// through the server (service-role) client; the session client only reads, and
// any write through it fails the test.
const sourcesTable = {
  insert: (row: SourceRow) => {
    sourceWrites.push({ kind: 'insert', row });
    const saved = { ...row };
    store.sources.push(saved);
    return { select: () => ({ single: async () => ({ data: { id: saved.id }, error: null }) }) };
  },
  update: (patch: Partial<SourceRow>) => {
    const filters: Record<string, string> = {};
    const query = {
      eq: (column: string, value: string) => { filters[column] = value; return query; },
      then: (resolve: (value: unknown) => unknown) => {
        sourceWrites.push({ kind: 'update', row: patch });
        const target = store.sources.find((row) => row.id === filters.id && (!filters.project_id || row.project_id === filters.project_id));
        if (target) Object.assign(target, patch);
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return query;
  },
};

const sessionWrites: string[] = [];
const sessionClient = {
  from: (table: string) => {
    if (table === 'documents') return documentsTable;
    if (table !== 'sources') throw new Error(`unexpected table ${table}`);
    return {
      insert: () => { sessionWrites.push('insert'); throw new Error('sources must not be written with the session client'); },
      update: () => { sessionWrites.push('update'); throw new Error('sources must not be written with the session client'); },
      select: () => {
        const filters: Record<string, string> = {};
        const q = { eq: (column: string, value: string) => { filters[column] = value; return q; }, maybeSingle: async () => ({ data: store.sources.find((row) => Object.entries(filters).every(([key, value]) => row[key as keyof SourceRow] === value)) || null, error: null }) };
        return q;
      },
    };
  },
};

const requireAuthenticatedUser = jest.fn();
const ownsProject = jest.fn();
jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
  ownsProject: (...args: unknown[]) => ownsProject(...args),
  ownedSource: async (id: string) => {
    const row = store.sources.find((source) => source.id === id);
    return row ? { id: row.id, project_id: row.project_id } : null;
  },
}));
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: (table: string) => table === 'sources' ? sourcesTable : table === 'documents' ? documentsTable : { insert: async () => ({ error: null }) } }),
}));
const citeAs = jest.fn();
jest.mock('@/lib/language/CiteAsService', () => ({ CiteAsService: { citations: (...args: unknown[]) => citeAs(...args) } }));

import { POST as analyze, GET as restoreAnalysis } from '@/app/api/academic/pdf-analyzer/route';
import { POST as cite } from '@/app/api/academic/citations/route';

const PDF_TEXT = `PLOS ONE RESEARCH ARTICLE\nhttps://doi.org/10.1371/journal.pone.0298037\n${'Body text of the article. '.repeat(200)}`;
const originalFetch = global.fetch;
const providerKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY'] as const;
const originalKeys = Object.fromEntries(providerKeys.map((key) => [key, process.env[key]]));

function post(url: string, body: unknown) {
  return new Request(url, { method: 'POST', body: JSON.stringify(body) });
}

function providersFail() {
  process.env.GEMINI_API_KEY = 'gemini-test';
  process.env.OPENAI_API_KEY = 'openai-test';
  process.env.GROQ_API_KEY = 'groq-test';
  global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 503 }));
}

beforeEach(() => {
  store.sources = [];
  documents.length = 0;
  sourceWrites.length = 0;
  sessionWrites.length = 0;
  jest.clearAllMocks();
  requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, supabase: sessionClient });
  ownsProject.mockResolvedValue(true);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  // Every test: sources was never written with the browser's session.
  expect(sessionWrites).toEqual([]);
  global.fetch = originalFetch;
  for (const key of providerKeys) {
    if (originalKeys[key] === undefined) delete process.env[key];
    else process.env[key] = originalKeys[key];
  }
  jest.restoreAllMocks();
});

test('rejects unauthenticated requests and projects the user does not own, before storing anything', async () => {
  requireAuthenticatedUser.mockResolvedValueOnce(null);
  expect((await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'p', text: PDF_TEXT }))).status).toBe(401);

  ownsProject.mockResolvedValueOnce(false);
  expect((await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'other-user-project', text: PDF_TEXT }))).status).toBe(404);

  expect(store.sources).toHaveLength(0);
});

test('AI success: the source is stored once and sourceId is returned with the analysis', async () => {
  process.env.GEMINI_API_KEY = 'gemini-test';
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Key insights.' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const response = await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'project-a', text: PDF_TEXT }));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toEqual(expect.objectContaining({ success: true, sourceId: expect.any(String), analysis: 'Key insights.', analysisStatus: 'completed' }));
  expect(store.sources).toHaveLength(1);
  expect(store.sources[0]).toEqual({ id: body.sourceId, project_id: 'project-a', raw_text: PDF_TEXT, confidence: 'not_assessed' });
});

test('all AI providers fail: the upload still succeeds with one stored source and analysis unavailable', async () => {
  providersFail();

  const response = await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'project-a', text: PDF_TEXT }));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toEqual(expect.objectContaining({ success: true, sourceId: expect.any(String), analysis: null, analysisStatus: 'unavailable' }));
  expect(global.fetch).toHaveBeenCalled();
  expect(sourceWrites.filter((write) => write.kind === 'insert')).toHaveLength(1);
  expect(store.sources[0].confidence).toBe('not_assessed');
});

test('retry after provider failure uses the same source without another insert', async () => {
  providersFail();
  const first = await (await analyze(post('http://x', { projectId: 'project-a', text: PDF_TEXT }))).json();
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Retry insights.' }] } }] }), { status: 200 }));
  const retry = await (await analyze(post('http://x', { projectId: 'project-a', text: PDF_TEXT }))).json();
  expect(retry.sourceId).toBe(first.sourceId); expect(retry.analysisStatus).toBe('completed');
  expect(store.sources).toHaveLength(1); expect(sourceWrites.filter((write) => write.kind === 'insert')).toHaveLength(1);
});

test('pdf-analyzer writes no citation fields or verification state, whatever the model returns', async () => {
  process.env.GEMINI_API_KEY = 'gemini-test';
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'APA: Smith, J. (2031). Invented study. IEEE: [1] J. Smith.' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'project-a', text: PDF_TEXT }));

  expect(sourceWrites).toEqual([{ kind: 'insert', row: { id: expect.any(String), project_id: 'project-a', raw_text: PDF_TEXT, confidence: 'not_assessed' } }]);
});

test('PDF analysis persists server output, restores it and identical retry is cached', async () => {
  process.env.GEMINI_API_KEY = 'gemini-test';
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ملخص اختبار يحفظ الرقم 42، من النص المتاح فقط.' }] } }] }), { status: 200 }));
  const first = await (await analyze(post('http://x', { projectId: 'project-a', text: PDF_TEXT, output: 'forged', saved: true }))).json();
  expect(first.saved).toBe(true); expect(first.output).not.toBe('forged');
  expect(documents[0].type).toBe('journey:pdf_analysis');
  expect(JSON.parse(documents[0].content as string).sourceId).toBe(first.sourceId);
  const calls = (global.fetch as jest.Mock).mock.calls.length;
  const retry = await (await analyze(post('http://x', { projectId: 'project-a', text: PDF_TEXT }))).json();
  expect(retry.cached).toBe(true); expect(retry.output).toBe(first.output);
  expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls); expect(documents).toHaveLength(1);
  const response = await restoreAnalysis(new Request('http://x?projectId=project-a'));
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect((await response.json()).analyses[0].output).toBe(first.output);
});

test('failed analysis save never claims persistence; raw text stays available for retry', async () => {
  process.env.GEMINI_API_KEY = 'gemini-test';
  global.fetch = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Unsaved fixture analysis.' }] } }] }), { status: 200 }));
  jest.spyOn(documentsTable, 'insert').mockResolvedValueOnce({ error: { code: 'fixture' } } as never);
  const response = await analyze(post('http://x', { projectId: 'project-a', text: PDF_TEXT }));
  expect(response.status).toBe(503); const body = await response.json(); expect(body.saved).toBe(false); expect(body.output).toBe('Unsaved fixture analysis.');
  expect(store.sources).toHaveLength(1); expect(documents).toHaveLength(0);
  const retry = await (await analyze(post('http://x', { projectId: 'project-a', text: PDF_TEXT }))).json();
  expect(retry.saved).toBe(true); expect(store.sources).toHaveLength(1); expect(documents).toHaveLength(1);
});

test('restore requires authentication and ownership, never service reads or writes', async () => {
  requireAuthenticatedUser.mockResolvedValueOnce(null);
  expect((await restoreAnalysis(new Request('http://x?projectId=project-a'))).status).toBe(401);
  ownsProject.mockResolvedValueOnce(false);
  expect((await restoreAnalysis(new Request('http://x?projectId=other'))).status).toBe(404);
  expect((await restoreAnalysis(new Request('http://x'))).status).toBe(400);
  expect(documents).toHaveLength(0); expect(store.sources).toHaveLength(0);
});

describe('upload flow: parsed PDF text -> source -> AI unavailable -> citation step', () => {
  test('a real DOI in the stored text still reaches the deterministic citation step', async () => {
    providersFail();
    citeAs.mockResolvedValue([{ style: 'apa', styleName: 'APA', citation: 'Author, A. (2024). Real PLOS study. PLOS ONE.' }]);

    const analyzed = await (await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'project-a', text: PDF_TEXT }))).json();
    const cited = await (await cite(post('http://x/api/academic/citations', { sourceId: analyzed.sourceId }))).json();

    expect(analyzed.analysisStatus).toBe('unavailable');
    expect(cited).toEqual(expect.objectContaining({ status: 'formatted_from_doi', doi: '10.1371/journal.pone.0298037', verificationStatus: 'unverified' }));
    expect(citeAs).toHaveBeenCalledWith('10.1371/journal.pone.0298037');
    expect(store.sources).toHaveLength(1);
    expect(store.sources[0]).toEqual(expect.objectContaining({ parsed_citation_apa: 'Author, A. (2024). Real PLOS study. PLOS ONE.', confidence: 'unverified_external_formatter' }));
  });

  test('text without a DOI reaches the citation step and stores no citation', async () => {
    providersFail();

    const analyzed = await (await analyze(post('http://x/api/academic/pdf-analyzer', { projectId: 'project-a', text: 'Smith, J. (2031). An invented landmark study. Journal of Imaginary Results.' }))).json();
    const cited = await (await cite(post('http://x/api/academic/citations', { sourceId: analyzed.sourceId }))).json();

    expect(cited).toEqual(expect.objectContaining({ citation: null, status: 'no_identifier' }));
    expect(citeAs).not.toHaveBeenCalled();
    expect(sourceWrites.filter((write) => write.kind === 'update')).toHaveLength(0);
    expect(store.sources[0].parsed_citation_apa).toBeUndefined();
  });
});
