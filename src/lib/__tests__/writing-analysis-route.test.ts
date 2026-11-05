jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: jest.fn() }));
import { randomUUID } from 'node:crypto';
import { GET, POST } from '@/app/api/projects/[projectId]/writing/analysis/route';
import { GET as readWriting, POST as saveWriting } from '@/app/api/projects/[projectId]/writing/route';
import { generateStructured } from '@/lib/ai/geminiClient';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { extractionIntoDraft, WRITING_ANALYSIS_TYPE, EXTRACTION_FIELDS, type StudyExtraction } from '@/lib/writing-analysis';
import { buildProjectExportModel, buildProjectMarkdown } from '@/lib/project-export';
import { DISCOVERY_PROVIDER, SERVER_DISCOVERED_METADATA } from '@/lib/research-search-results';

const mockDb = createTableFake({ strictQuery: true });
const projectId = randomUUID(); const sourceId = randomUUID(); const context = { params: Promise.resolve({ projectId }) };
const text = 'Twenty students participated. An association was observed. This does not establish causation.';
const input = { operation: 'extraction', sourceKind: 'reference', sourceId, language: 'en' };
const extractionOutput = () => JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: 'Twenty students participated.', quote: 'Twenty students participated.' } : null])) });
const request = (b: unknown) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(b) });
const query = (b: Record<string, string>) => new Request(`http://localhost?${new URLSearchParams(b)}`);
beforeEach(() => {
  jest.clearAllMocks(); mockDb.reset();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: mockDb.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  (generateStructured as jest.Mock).mockResolvedValue({ output: extractionOutput() });
  mockDb.constraints.set('documents', (row, kind) => kind === 'insert' && mockDb.rows('documents').some(item => item.id === row.id) ? '23505' : null);
  mockDb.seed('project_references', { id: sourceId, project_id: projectId, user_id: 'owner', provider: DISCOVERY_PROVIDER, external_item_key: 'synthetic', title: 'Synthetic study for contract tests', publication_year: 2024, authors: [], url: null, doi: null, citation_data: { metadataOrigin: SERVER_DISCOVERED_METADATA, discovery: { resultId: 'fixture' }, discoveredPaper: { abstract: text } } });
});
test('GET restores only saved analysis; POST persists a source-grounded result and retries reuse it', async () => {
  const before = await GET(query(input), context); expect(before.status).toBe(200); expect((await before.json()).record).toBeNull(); expect(generateStructured).not.toHaveBeenCalled();
  const response = await POST(request({ ...input, title: 'forged title', text: 'forged text' }), context); expect(response.status).toBe(200);
  const result = await response.json(); expect(result.saved).toBe(true); expect(result.record.source.title).toContain('Synthetic study');
  expect((await POST(request(input), context)).status).toBe(200); expect(generateStructured).toHaveBeenCalledTimes(1);
  const restored = await (await GET(query(input), context)).json(); expect(restored.record).toEqual(result.record);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(mockDb.rows('documents')).toHaveLength(1); expect(mockDb.writes.every(w => w.client === 'service')).toBe(true);
});
test('does not call a provider or write for foreign projects, absent text or foreign sources', async () => {
  (ownsProject as jest.Mock).mockResolvedValueOnce(false); expect((await POST(request(input), context)).status).toBe(404);
  mockDb.rows('project_references')[0].project_id = randomUUID(); expect((await POST(request(input), context)).status).toBe(404);
  mockDb.rows('project_references')[0].project_id = projectId; mockDb.rows('project_references')[0].citation_data = {};
  expect((await POST(request(input), context)).status).toBe(409); expect(generateStructured).not.toHaveBeenCalled(); expect(mockDb.writes).toHaveLength(0);
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue(null); expect((await GET(query(input), context)).status).toBe(401);
});
test('rejects invented evidence, provider failure, changed source during generation, and failed storage', async () => {
  (generateStructured as jest.Mock).mockResolvedValueOnce({ output: extractionOutput().replace('Twenty students participated.","quote":"Twenty students participated.', 'Twenty students participated.","quote":"Made up source text.') });
  expect((await POST(request(input), context)).status).toBe(422); expect(mockDb.rows('documents')).toHaveLength(0);
  (generateStructured as jest.Mock).mockRejectedValueOnce(new Error('provider unreachable'));
  expect((await POST(request(input), context)).status).toBe(503); expect(mockDb.rows('documents')).toHaveLength(0);
  (generateStructured as jest.Mock).mockImplementationOnce(async () => { const row = mockDb.rows('project_references')[0]; (row.citation_data as Record<string, unknown>).discoveredPaper = { abstract: text + ' Changed source.' }; return { output: extractionOutput() }; });
  expect((await POST(request(input), context)).status).toBe(409); expect(mockDb.rows('documents')).toHaveLength(0);
  mockDb.constraints.set('documents', () => 'unavailable');
  expect((await POST(request(input), context)).status).toBe(503); expect(mockDb.rows('documents')).toHaveLength(0);
});
test('completes extraction, evidence-linked writing, citation review, researcher decision, restoration and export', async () => {
  const extracted = await (await POST(request(input), context)).json();
  const draft = extractionIntoDraft({ text: '', citations: [] }, extracted.record, 'sample')!;
  const written = await (await saveWriting(request({ ...draft, baseDocumentId: null }), context)).json(); expect(written.saved).toBe(true);
  const assessmentInput = { operation: 'citation', language: 'en', documentId: written.documentId, citationId: draft.citations[0].id };
  const judgement = { relation: 'supports', rationale: 'The passage explicitly describes this sample.', limitation: 'This evaluates only the provided passage, not study quality.', quote: 'Twenty students participated.' };
  (generateStructured as jest.Mock).mockResolvedValue({ output: JSON.stringify(judgement) });
  const assessed = await (await POST(request(assessmentInput), context)).json(); expect(assessed.record.relation).toBe('supports'); expect(assessed.saved).toBe(true);
  const beforeDecision = await (await readWriting(new Request('http://localhost'), context)).json(); expect(beforeDecision.versions[0].citations[0].relation).toBe('contextual');
  const decided = { ...draft, citations: draft.citations.map(c => ({ ...c, relation: assessed.record.relation, note: 'Researcher reviewed suggestion.' })), baseDocumentId: written.documentId };
  const savedDecision = await saveWriting(request(decided), context); expect(savedDecision.status).toBe(200);
  const decisionReceipt = await savedDecision.json();
  const afterDecision = await (await GET(query({ ...assessmentInput, documentId: decisionReceipt.documentId }), context)).json();
  expect(afterDecision.cached).toBe(true); expect(afterDecision.record.rationale).toBe(judgement.rationale);
  expect(generateStructured).toHaveBeenCalledTimes(2);
  const documents = mockDb.rows('documents') as Array<{ type: string; content: string; version: number; created_at: string }>;
  for (const language of ['ar', 'en'] as const) {
    const model = buildProjectExportModel({ title: 'Fixture project', university_policy: null }, documents, [], [], undefined, language);
    const all = model.sections.flatMap(s => s.paragraphs).join('\n'); expect(all).toContain(judgement.rationale); expect(all).toContain('Twenty students participated.'); expect(all).not.toContain(extracted.record.sourceHash); expect(all).not.toContain(written.documentId);
    expect(buildProjectMarkdown({ title: 'Fixture', university_policy: null }, documents, [], [], undefined, language)).not.toContain(WRITING_ANALYSIS_TYPE);
  }
  const source = mockDb.rows('project_references')[0]; (source.citation_data as Record<string, unknown>).discoveredPaper = { abstract: text + ' changed.' };
  expect((await POST(request(assessmentInput), context)).status).toBe(409);
});
test('preserves a 50-study extraction collection and evidence-linked draft without a project reference cap', async () => {
  let draft = { text: '', citations: [] } as NonNullable<ReturnType<typeof extractionIntoDraft>>;
  for (let i = 0; i < 50; i++) {
    const id = randomUUID(); mockDb.seed('project_references', { ...mockDb.rows('project_references')[0], id, external_item_key: `fixture-${i}`, title: `Synthetic study ${i}` });
    const result = await (await POST(request({ ...input, sourceId: id }), context)).json(); expect(result.saved).toBe(true);
    draft = extractionIntoDraft(draft, result.record as StudyExtraction, 'sample')!;
  }
  const response = await saveWriting(request({ ...draft, baseDocumentId: null }), context); expect(response.status).toBe(200);
  const restored = await (await readWriting(new Request('http://localhost'), context)).json(); expect(restored.versions[0].citations).toHaveLength(50);
  const docs = mockDb.rows('documents') as Array<{ type: string; content: string; version: number; created_at: string }>;
  const exportModel = buildProjectExportModel({ title: 'Fifty fixture studies', university_policy: null }, docs, [], [], undefined, 'en');
  expect(exportModel.sections.filter(s => s.title.startsWith('Study information'))).toHaveLength(50);
  expect(generateStructured).toHaveBeenCalledTimes(50); // Mock only; no provider/network/cost.
});

test('does not restore a saved extraction with an invented passage, and a retry repairs only that analysis', async () => {
  const initial = await (await POST(request(input), context)).json();
  const row = mockDb.rows('documents').find(row => row.id === initial.documentId)!;
  const damaged = JSON.parse(String(row.content));
  damaged.fields.sample.quoteText = 'Invented passage';
  damaged.fields.sample.quoteEnd = damaged.fields.sample.quoteText.length;
  row.content = JSON.stringify(damaged);
  const writesBefore = mockDb.writes.length;
  const read = await GET(query(input), context);
  expect(read.status).toBe(422); expect((await read.json()).code).toBe('unsupported_output');
  expect(mockDb.writes).toHaveLength(writesBefore); expect(generateStructured).toHaveBeenCalledTimes(1);
  (generateStructured as jest.Mock).mockRejectedValueOnce(new Error('provider unreachable'));
  expect((await POST(request(input), context)).status).toBe(503);
  expect(mockDb.writes).toHaveLength(writesBefore); expect(mockDb.rows('documents')[0].content).toBe(JSON.stringify(damaged));
  const retried = await POST(request(input), context);
  expect(retried.status).toBe(200);
  expect((await retried.json()).record.fields.sample.quoteText).toBe('Twenty students participated.');
  expect(generateStructured).toHaveBeenCalledTimes(3);
  expect(mockDb.rows('documents')).toHaveLength(1);
  expect(mockDb.writes.every(write => write.client === 'service')).toBe(true);
});

test('rebuilds an analysis snapshot after publication details change even when its text hash stays the same', async () => {
  const initial = await (await POST(request(input), context)).json();
  mockDb.rows('project_references')[0].title = 'Updated synthetic study title';
  expect((await GET(query(input), context)).status).toBe(422);
  const response = await POST(request(input), context); expect(response.status).toBe(200);
  const updated = await response.json();
  expect(updated.record.source.title).toBe('Updated synthetic study title');
  expect(updated.record.sourceHash).toBe(initial.record.sourceHash);
  expect(generateStructured).toHaveBeenCalledTimes(2);
  expect(mockDb.rows('documents')).toHaveLength(1);
});

test('rejects numbers outside the supplied PDF context without saving an assessment', async () => {
  const pdfId = randomUUID();
  const pdfText = text + ' background'.repeat(1000) + ' An unrelated experiment enrolled 80 participants.';
  mockDb.seed('sources', { id: pdfId, project_id: projectId, raw_text: pdfText, parsed_citation_apa: 'Synthetic PDF text for contract tests' });
  const extracted = await (await POST(request({ ...input, sourceKind: 'pdf', sourceId: pdfId }), context)).json();
  const draft = extractionIntoDraft({ text: '', citations: [] }, extracted.record, 'sample')!;
  const written = await (await saveWriting(request({ ...draft, baseDocumentId: null }), context)).json();
  const assessmentInput = { operation: 'citation', language: 'en', documentId: written.documentId, citationId: draft.citations[0].id };
  const output = { relation: 'supports', rationale: 'The supplied context reports 80 participants.', limitation: 'Only this passage was assessed.', quote: 'Twenty students participated.' };
  (generateStructured as jest.Mock).mockResolvedValueOnce({ output: JSON.stringify(output) });
  const response = await POST(request(assessmentInput), context);
  expect(response.status).toBe(422);
  expect(mockDb.rows('documents').filter(row => row.type === WRITING_ANALYSIS_TYPE)).toHaveLength(1);
  const prompt = (generateStructured as jest.Mock).mock.calls.at(-1)![0].prompt as string;
  const supplied = JSON.parse(prompt.slice(prompt.indexOf('SOURCE=') + 'SOURCE='.length));
  expect(supplied.context).toContain('Twenty students participated.');
  expect(supplied.context).not.toContain('80');
});

test.each([
  ['The correlation was r = -0.42.', 'The correlation was r = +0.42.'],
  ['The response rate was 25%.', 'There were 25 participants.'],
  ['The difference was p < .001.', 'The difference was p = .001.'],
] as const)('never saves a numerical distortion of %s and retries with the exact evidence', async (quote, value) => {
  (mockDb.rows('project_references')[0].citation_data as Record<string, unknown>).discoveredPaper = { abstract: quote };
  const result = (summary: string) => JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'findings' ? { value: summary, quote } : null])) });
  (generateStructured as jest.Mock).mockResolvedValueOnce({ output: result(value) });
  const rejected = await POST(request(input), context);
  expect(rejected.status).toBe(422); expect(mockDb.writes).toHaveLength(0);
  (generateStructured as jest.Mock).mockResolvedValue({ output: result(quote) });
  const response = await POST(request(input), context); expect(response.status).toBe(200);
  const receipt = await response.json(); expect(receipt.record.fields.findings.value).toBe(quote);
  const stored = mockDb.rows('documents').find(row => row.id === receipt.documentId)!;
  const damaged = JSON.parse(String(stored.content)); damaged.fields.findings.value = value; stored.content = JSON.stringify(damaged);
  expect((await GET(query(input), context)).status).toBe(422);
  const restored = await POST(request(input), context); expect(restored.status).toBe(200);
  expect((await restored.json()).record.fields.findings.value).toBe(quote);
  expect(mockDb.rows('documents')).toHaveLength(1);
});
