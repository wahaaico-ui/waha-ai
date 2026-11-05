jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db.service }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: jest.fn() }));
import { createHash, randomUUID } from 'node:crypto';
import { GET } from '@/app/api/projects/[projectId]/writing/comparison/route';
import { POST as saveWriting, GET as readWriting } from '@/app/api/projects/[projectId]/writing/route';
import { POST as exportProject } from '@/app/api/academic/export/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { generateStructured } from '@/lib/ai/geminiClient';
import { createTableFake } from '@/lib/test-support/table-fake';
import { writingSourceFromReference, writingSourceFromPdf, type WritingReferenceRow } from '@/lib/evidence-writing-server';
import { EXTRACTION_FIELDS, parseExtractionOutput, WRITING_ANALYSIS_TYPE, extractionIntoDraft, type StudyExtraction } from '@/lib/writing-analysis';
import { writingAnalysisId } from '@/lib/writing-analysis-id';
import { DISCOVERY_PROVIDER, SERVER_DISCOVERED_METADATA } from '@/lib/research-search-results';
import { PDF_FILE_TYPE } from '@/lib/pdf-evidence';
import { pdfDigest, pdfRecordId } from '@/lib/pdf-evidence-server';
import type { StudyComparisonPage } from '@/lib/study-comparison';

const db = createTableFake({ strictQuery: true });
const projectId = randomUUID(), ownerId = randomUUID(); const context = { params: Promise.resolve({ projectId }) };
const text = 'A synthetic study.\nThe study included 20 students.\nNo causal claim is established.';
const query = (params: Record<string, string> = {}) => new Request(`http://localhost?${new URLSearchParams({ kind: 'reference', language: 'en', ...params })}`);
function study(index = 0) {
  const row: WritingReferenceRow & { user_id: string } = { id: randomUUID(), project_id: projectId, user_id: ownerId, provider: DISCOVERY_PROVIDER, external_item_key: `fixture-${index}`, title: `Synthetic study ${index}`, authors: ['Example, Researcher'], publication_year: 2024, publication_title: null, doi: null, url: null, citation_data: { metadataOrigin: SERVER_DISCOVERED_METADATA, discovery: { resultId: 'fixture' }, discoveredPaper: { abstract: text } } };
  db.seed('project_references', { ...row, created_at: new Date(Date.UTC(2026, 9, 18, 0, 0, index)).toISOString() });
  return writingSourceFromReference(row);
}
function saveExtraction(source: ReturnType<typeof study>, language: 'ar' | 'en' = 'en') {
  const record = parseExtractionOutput(JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: '20 students', quote: 'The study included 20 students.' } : null])) }), source, language)!;
  db.seed('documents', { id: writingAnalysisId(projectId, 'extraction', language, source), project_id: projectId, type: WRITING_ANALYSIS_TYPE, content: JSON.stringify(record), version: 1 });
  return record;
}
beforeEach(() => {
  jest.clearAllMocks(); db.reset();
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: ownerId }, supabase: db.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  db.seed('projects', { id: projectId, user_id: ownerId, title: 'Synthetic comparison fixture', university_policy: null });
});
afterEach(() => { jest.restoreAllMocks(); expect(generateStructured).not.toHaveBeenCalled(); });

test('retains the exact pre-existing cache ID so comparison and extraction share saved records', () => {
  const source = study();
  const digest = createHash('sha256').update(JSON.stringify([WRITING_ANALYSIS_TYPE, projectId, 'extraction', 'en', source.id, source.kind, source.hash, null])).digest('hex');
  expect(writingAnalysisId(projectId, 'extraction', 'en', source)).toBe(`${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`);
});
test('paginates 50 saved studies without losing a row, issuing writes, or invoking a model', async () => {
  for (let i = 0; i < 50; i++) saveExtraction(study(i));
  const seen = new Set<string>(); let offset: number | null = 0; const sizes = [];
  while (offset !== null) {
    const response = await GET(query({ offset: String(offset) }), context); expect(response.status).toBe(200);
    const page: StudyComparisonPage = await response.json(); sizes.push(page.items.length); expect(page.total).toBe(50);
    for (const row of page.items) { expect(seen.has(row.source.id)).toBe(false); seen.add(row.source.id); expect(row.status).toBe('ready'); expect(row.record?.fields.sample?.value).toBe('20 students'); expect(row.locations.sample).toEqual({ firstLine: 2, lastLine: 2 }); }
    offset = page.nextOffset;
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
  expect(sizes).toEqual([20, 20, 10]); expect(seen.size).toBe(50); expect(db.writes).toHaveLength(0);
});
test('uses the same record to add evidence, save, reopen and export a draft through the actual route handlers', async () => {
  saveExtraction(study());
  const page = await (await GET(query(), context)).json();
  const record = page.items[0].record as StudyExtraction;
  const draft = extractionIntoDraft({ text: '', citations: [] }, record, 'sample')!;
  const saved = await saveWriting(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...draft, baseDocumentId: null }) }), context);
  expect(saved.status).toBe(200);
  const reopened = await (await readWriting(new Request('http://localhost'), context)).json();
  expect(reopened.versions[0].citations[0].quoteText).toBe(record.fields.sample?.quoteText);
  expect(reopened.versions[0].text).toBe('20 students');
  const output = await exportProject(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ projectId, format: 'markdown', language: 'en' }) }));
  expect(output.status).toBe(200); expect((await output.text()).replace(/\\/g, '')).toContain('The study included 20 students.');
  expect(db.writes.every(write => write.client === 'service')).toBe(true);
});
test('distinguishes not extracted, no text and a ready extraction with unreported fields', async () => {
  study(0); const missing = study(1); db.rows('project_references').find(row => row.id === missing.id)!.citation_data = {};
  saveExtraction(study(2));
  const page: StudyComparisonPage = await (await GET(query(), context)).json();
  expect(page.items.map(item => item.status)).toEqual(['not_extracted', 'text_unavailable', 'ready']);
  expect(page.items[2].record?.fields.findings).toBeNull(); expect(page.items[0].record).toBeNull();
});
test('prefers the requested saved language and explicitly retains the fallback record language', async () => {
  const source = study(); saveExtraction(source, 'en');
  let page = await (await GET(query({ language: 'ar' }), context)).json(); expect(page.items[0].record.language).toBe('en');
  saveExtraction(source, 'ar');
  page = await (await GET(query({ language: 'ar' }), context)).json(); expect(page.items[0].record.language).toBe('ar');
});
test.each(['quote', 'metadata', 'numbers', 'numerical-unit'])('does not expose invalid %s from a cached extraction', async change => {
  const source = study(); saveExtraction(source);
  const row = db.rows('documents')[0]; const record = JSON.parse(String(row.content));
  if (change === 'quote') { record.fields.sample.quoteText = 'invented SECRET passage'; record.fields.sample.quoteEnd = record.fields.sample.quoteStart + record.fields.sample.quoteText.length; }
  if (change === 'metadata') record.source.title = 'OUTDATED SECRET TITLE';
  if (change === 'numbers') record.fields.sample.value = '99999 students';
  if (change === 'numerical-unit') record.fields.sample.value = '20% participated';
  row.content = JSON.stringify(record);
  const response = await GET(query(), context); const page = await response.json();
  expect(page.items[0].status).toBe('needs_review'); expect(page.items[0].record).toBeNull();
  expect(JSON.stringify(page)).not.toMatch(/SECRET|99999|20%/);
});
test('never returns an old extraction when the source text changed', async () => {
  const source = study(); saveExtraction(source);
  db.rows('project_references')[0].citation_data = { metadataOrigin: SERVER_DISCOVERED_METADATA, discovery: { resultId: 'fixture' }, discoveredPaper: { abstract: 'A different available text.' } };
  const page = await (await GET(query(), context)).json(); expect(page.items[0].status).toBe('not_extracted'); expect(page.items[0].record).toBeNull();
});
test('hides other owners, projects and foreign cached records even when IDs are supplied', async () => {
  const source = study(); saveExtraction(source);
  db.rows('documents')[0].project_id = randomUUID();
  const second = study(1); db.rows('project_references').find(row => row.id === second.id)!.user_id = randomUUID();
  const third = study(2); db.rows('project_references').find(row => row.id === third.id)!.project_id = randomUUID();
  const page = await (await GET(query({ sourceId: second.id }), context)).json();
  expect(page.items).toHaveLength(1); expect(page.items[0].source.id).toBe(source.id); expect(page.items[0].status).toBe('not_extracted');
  (ownsProject as jest.Mock).mockResolvedValue(false); expect((await GET(query(), context)).status).toBe(404);
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue(null); expect((await GET(query(), context)).status).toBe(401);
});
test.each([['offset', '-1'], ['offset', 'NaN'], ['offset', '1e2'], ['offset', '99999999999999999'], ['language', 'xx'], ['kind', 'documents']])('rejects malformed collection parameters %s=%s', async (key, value) => {
  expect((await GET(query({ [key]: value }), context)).status).toBe(400);
});
test('verifies PDF manifests and adds real page locations without sending the full source text', async () => {
  const id = randomUUID(); const pdfRow = { id, project_id: projectId, raw_text: text, parsed_citation_apa: 'Synthetic.pdf' };
  const file = { sourceId: id, projectId, ownerId, fileName: 'Synthetic.pdf', fileHash: 'a'.repeat(64), textHash: pdfDigest(text), bytes: 200, totalPages: 1, pages: [{ number: 1, start: 0, end: text.length }] };
  db.seed('sources', pdfRow); const manifestId = pdfRecordId(projectId, id);
  db.seed('documents', { id: manifestId, project_id: projectId, type: PDF_FILE_TYPE, content: JSON.stringify(file), version: 1 });
  saveExtraction(writingSourceFromPdf(pdfRow, file));
  let page = await (await GET(query({ kind: 'pdf' }), context)).json();
  expect(page.items[0].status).toBe('ready'); expect(page.items[0].locations.sample.pages).toEqual({ first: 1, last: 1 });
  expect(page.items[0].source.text).toBeUndefined();
  db.rows('documents').find(row => row.id === manifestId)!.content = JSON.stringify({ ...file, textHash: 'b'.repeat(64) });
  page = await (await GET(query({ kind: 'pdf' }), context)).json(); expect(page.items[0].status).toBe('needs_review'); expect(page.items[0].record).toBeNull();
});
test('a capped backend analysis response fails explicitly instead of labelling hidden analyses as missing', async () => {
  const limited = createTableFake({ strictQuery: true, serverRowLimit: 1 });
  const source = study(); saveExtraction(source, 'ar'); saveExtraction(source, 'en');
  for (const row of db.rows('project_references')) limited.seed('project_references', row);
  for (const row of db.rows('documents')) limited.seed('documents', row);
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: ownerId }, supabase: limited.session });
  const response = await GET(query(), context); expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: 'comparison_unavailable' });
});
