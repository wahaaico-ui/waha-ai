jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));
import { createHash, randomUUID } from 'node:crypto';
import { GET, POST } from '@/app/api/projects/[projectId]/writing/route';
import { GET as sources } from '@/app/api/projects/[projectId]/writing/sources/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { buildProjectExportModel, buildProjectMarkdown } from '@/lib/project-export';
import { readSavedWriting, WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { DISCOVERY_PROVIDER, SERVER_DISCOVERED_METADATA } from '@/lib/research-search-results';
import { plainWritingDocument } from '@/lib/writing-rich-text';

const mockDb = createTableFake({ strictQuery: true });
const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const referenceId = 'ba13fcdb-69a7-41aa-a2c9-c495917bcfa3';
const context = { params: Promise.resolve({ projectId }) };
const abstract = 'Public fixture abstract. A limited improvement was observed. It does not establish causation.';
const quote = 'A limited improvement was observed.';
const body = () => ({ text: 'تشير الدراسة إلى تحسن محدود فقط.', citations: [{ id: 'faddfe2c-78f0-4e15-a24d-df151c43f7aa', claimStart: 0, claimEnd: 'تشير الدراسة إلى تحسن محدود فقط.'.length, claimText: 'تشير الدراسة إلى تحسن محدود فقط.', sourceKind: 'reference', sourceId: referenceId, sourceHash: createHash('sha256').update(abstract).digest('hex'), quoteStart: abstract.indexOf(quote), quoteEnd: abstract.indexOf(quote) + quote.length, quoteText: quote, relation: 'supports', note: 'Manual review of local fixture.' }], baseDocumentId: null as string | null });
const request = (payload: unknown) => new Request('http://localhost', { method: 'POST', body: JSON.stringify(payload) });
const sourceRequest = (kind: string, id?: string, offset = 0) => new Request(`http://localhost?kind=${kind}&${id ? `sourceId=${id}` : `offset=${offset}`}`);
beforeEach(() => {
  jest.clearAllMocks(); mockDb.reset(); jest.useFakeTimers({ now: new Date('2026-10-14T12:00:00Z') });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: mockDb.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  mockDb.constraints.set('documents', row => mockDb.rows('documents').some(item => item.id === row.id) ? '23505' : null);
  mockDb.seed('project_references', { id: referenceId, project_id: projectId, user_id: 'owner', provider: DISCOVERY_PROVIDER, external_item_key: 'fixture-1', title: 'Fixture source — not real research', authors: ['Fixture Author'], publication_year: 2024, publication_title: 'Fixture journal', doi: null, url: 'https://example.test/study', citation_data: { metadataOrigin: SERVER_DISCOVERED_METADATA, discovery: { resultId: 'saved-fixture' }, discoveredPaper: { abstract } } });
});
afterEach(() => jest.useRealTimers());

test('accepts only one of two simultaneous edits from the same base revision', async () => {
  const responses = await Promise.all(['First concurrent draft.', 'Second concurrent draft.'].map(text => POST(request({ text, citations: [], baseDocumentId: null }), context)));
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  expect(mockDb.rows('documents')).toHaveLength(1);
});

test('saves and reopens formatting with the same source coordinates; invalid rich text never writes', async () => {
  const input = body(); const richText = plainWritingDocument(input.text);
  richText.content[0].content![0].marks = [{ type: 'bold' }];
  const payload = { ...input, richText };
  const first = await (await POST(request(payload), context)).json();
  expect(first.saved).toBe(true); expect(first.draft.richText).toEqual(richText);
  expect((await POST(request(payload), context)).status).toBe(200); expect(mockDb.rows('documents')).toHaveLength(1);
  const latest = (await (await GET(new Request('http://localhost'), context)).json()).versions[0];
  expect(latest.richText).toEqual(richText); expect(latest.citations[0].claimStart).toBe(0);
  expect(latest.citations[0].quoteText).toBe(quote);
  const result = await POST(request({ ...payload, text: 'The structured and plain documents disagree.' }), context);
  expect(result.status).toBe(422); expect(mockDb.rows('documents')).toHaveLength(1);
});

test('persists the selected style and authoritative author metadata, ignoring forged bibliography snapshots', async () => {
  mockDb.rows('project_references')[0].authors = [{ family: 'أبو علوش', given: 'محمد' }];
  const input = body();
  const receipt = await (await POST(request({ ...input, citationStyle: 'ieee', citations: [{ ...input.citations[0], source: { bibliography: { authors: [{ literal: 'Forged author' }] } } }] }), context)).json();
  expect(receipt.draft.citationStyle).toBe('ieee');
  expect(receipt.draft.citations[0].source.bibliography.authors).toEqual([{ family: 'أبو علوش', given: 'محمد' }]);
  expect(JSON.stringify(receipt)).not.toContain('Forged author');
  const restored = await (await GET(new Request('http://localhost'), context)).json();
  expect(restored.versions[0].citationStyle).toBe('ieee');
  expect(restored.versions[0].citations[0].source.bibliography).toEqual(receipt.draft.citations[0].source.bibliography);
  expect((await POST(request({ ...input, citationStyle: 'ieee' }), context)).status).toBe(200);
  expect(mockDb.rows('documents')).toHaveLength(1);
  jest.advanceTimersByTime(1000);
  const changed = await (await POST(request({ ...input, baseDocumentId: receipt.documentId, citationStyle: 'apa-7' }), context)).json();
  expect(changed.draft.citationStyle).toBe('apa-7'); expect(mockDb.rows('documents')).toHaveLength(2);
  expect((await POST(request({ ...input, citationStyle: 'unknown' }), context)).status).toBe(422);
});

test('saves an exact source passage once, restores it, and ignores forged trust or title fields', async () => {
  const input = body();
  const result = await POST(request({ ...input, project_id: 'foreign', verified: true, citations: [{ ...input.citations[0], source: { title: 'Forged source' }, verified: true }] }), context);
  expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('no-store');
  const receipt = await result.json();
  expect((await POST(request(input), context)).status).toBe(200);
  expect(mockDb.rows('documents')).toHaveLength(1);
  expect(mockDb.writes.every(write => write.client === 'service')).toBe(true);
  const restored = await (await GET(new Request('http://localhost'), context)).json();
  expect(restored.versions[0].documentId).toBe(receipt.documentId);
  expect(restored.versions[0].citations[0]).toMatchObject({ quoteText: quote, source: { title: 'Fixture source — not real research', kind: 'reference' } });
  expect(JSON.stringify(restored)).not.toContain('Forged source');
});

test('rejects invented quote text, changed source context and foreign references without writes', async () => {
  const input = body(); input.citations[0].quoteText = 'Invented source passage.'; input.citations[0].quoteEnd = input.citations[0].quoteStart + input.citations[0].quoteText.length;
  expect((await POST(request(input), context)).status).toBe(409);
  (mockDb.rows('project_references')[0].citation_data as Record<string, unknown>).discoveredPaper = { abstract: abstract + ' Changed context.' };
  expect((await POST(request(body()), context)).status).toBe(409);
  mockDb.rows('project_references')[0].project_id = 'different-project';
  expect((await POST(request(body()), context)).status).toBe(404);
  expect((await sources(sourceRequest('reference', referenceId), context)).status).toBe(404);
  expect(mockDb.writes).toHaveLength(0);
});

test('rejects unauthenticated or foreign project access for drafts and source reading', async () => {
  (requireAuthenticatedUser as jest.Mock).mockResolvedValueOnce(null);
  const unauthorized = await POST(request(body()), context); expect(unauthorized.status).toBe(401); expect(unauthorized.headers.get('cache-control')).toContain('no-store');
  (ownsProject as jest.Mock).mockResolvedValue(false);
  expect((await GET(new Request('http://localhost'), context)).status).toBe(404);
  expect((await sources(sourceRequest('reference', referenceId), context)).status).toBe(404);
  expect(mockDb.writes).toHaveLength(0);
});

test('keeps immutable revisions, rejects stale edits and makes an intentional revert the latest export', async () => {
  const initial = body(); const first = await (await POST(request(initial), context)).json();
  jest.advanceTimersByTime(1000);
  const changed = { ...initial, text: initial.text + ' فقرة ثانية.', baseDocumentId: first.documentId };
  const second = await (await POST(request(changed), context)).json(); expect(second.saved).toBe(true);
  expect((await POST(request({ ...changed, text: changed.text + ' تعديل من نسخة قديمة.' }), context)).status).toBe(409);
  jest.advanceTimersByTime(1000);
  const reverted = await POST(request({ ...initial, baseDocumentId: second.documentId }), context); expect(reverted.status).toBe(200);
  expect(mockDb.rows('documents')).toHaveLength(3);
  const stored = await (await GET(new Request('http://localhost'), context)).json(); expect(stored.versions[0].text).toBe(initial.text);
  const docs = mockDb.rows('documents') as Array<{ type: string; content: string; version: number; created_at: string }>;
  const model = buildProjectExportModel({ title: 'Fixture project', university_policy: null }, docs, [], [], undefined, 'en');
  expect(model.sections.find(section => section.title === 'Draft')?.paragraphs.join('\n')).toContain(initial.text.slice(0, -1) + ' (Fixture Author, 2024).');
  expect(model.sections.flatMap(s => s.paragraphs).join('\n')).not.toContain('فقرة ثانية.');
  const markdown = buildProjectMarkdown({ title: 'Fixture project', university_policy: null }, docs, []);
  expect(markdown).toContain('الكتابة المرتبطة بالدليل'); expect(markdown).not.toContain(initial.citations[0].sourceHash);
});

test('reads the next reference batch without treating 50 results as a library limit', async () => {
  for (let i = 1; i < 65; i++) mockDb.seed('project_references', { id: randomUUID(), project_id: projectId, title: `Fixture reference ${i}` });
  const first = await (await sources(sourceRequest('reference'), context)).json();
  const second = await (await sources(sourceRequest('reference', undefined, first.nextOffset), context)).json();
  expect(first.items).toHaveLength(50); expect(second.items).toHaveLength(15); expect(second.nextOffset).toBeNull();
  expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(65);
});

test('preserves more than one reference query batch without dropping citation IDs or their order', async () => {
  const template = body(); const references = [];
  for (let i = 0; i < 125; i++) {
    const id = randomUUID(); references.push(id);
    mockDb.seed('project_references', { ...mockDb.rows('project_references')[0], id, external_item_key: `batch-fixture-${i}`, title: `Batch fixture ${i}` });
  }
  const citations = references.reverse().map(sourceId => ({ ...template.citations[0], id: randomUUID(), sourceId }));
  const response = await POST(request({ ...template, citations }), context); expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.draft.citations.map((c: { sourceId: string }) => c.sourceId)).toEqual(references);
  expect(saved.draft.citations).toHaveLength(125);
});

test('validates extracted files over several bounded batches', async () => {
  const template = body(); const citations = [];
  for (let i = 0; i < 25; i++) {
    const sourceId = randomUUID(); const raw = `File ${i}\n${quote}`;
    mockDb.seed('sources', { id: sourceId, project_id: projectId, raw_text: raw, parsed_citation_apa: null });
    const start = raw.indexOf(quote);
    citations.push({ ...template.citations[0], id: randomUUID(), sourceKind: 'pdf', sourceId, sourceHash: createHash('sha256').update(raw).digest('hex'), quoteStart: start, quoteEnd: start + quote.length });
  }
  const response = await POST(request({ ...template, citations }), context); expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.draft.citations).toHaveLength(25);
  expect(saved.draft.citations.every((c: { firstLine: number; lastLine: number }) => c.firstLine === 2 && c.lastLine === 2)).toBe(true);
});

test('normalizes extracted line endings for textarea offsets and rejects forged body sizes', async () => {
  const pdfId = randomUUID(); mockDb.seed('sources', { id: pdfId, project_id: projectId, raw_text: 'Heading\r\nFirst line.\rSecond line.', parsed_citation_apa: null });
  const parsed = await (await sources(sourceRequest('pdf', pdfId), context)).json(); expect(parsed.source.text).toBe('Heading\nFirst line.\nSecond line.');
  const huge = new Request('http://localhost', { method: 'POST', headers: { 'content-length': '1' }, body: JSON.stringify({ text: 'x'.repeat(600000), citations: [] }) });
  expect((await POST(huge, context)).status).toBe(413); expect(mockDb.writes).toHaveLength(0);
});

test('reports a storage failure rather than showing unsaved text as a completed save', async () => {
  mockDb.constraints.set('documents', () => 'storage_unavailable');
  expect((await POST(request(body()), context)).status).toBe(503);
  expect(mockDb.rows('documents')).toHaveLength(0);
  expect(readSavedWriting({ text: 'valid plain text', citations: [] })).toEqual({ text: 'valid plain text', citations: [] });
  expect(WRITING_DOCUMENT_TYPE).toBe('evidence-writing:v1');
});
