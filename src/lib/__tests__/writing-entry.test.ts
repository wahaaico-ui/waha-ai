jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockDb.service }));
import { GET, POST } from '@/app/api/projects/[projectId]/writing/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createTableFake } from '@/lib/test-support/table-fake';
import { saveWritingEntry, writingEntryStorageKey } from '@/lib/writing-entry';
import { createHash, randomUUID } from 'node:crypto';
import { DISCOVERY_PROVIDER, SERVER_DISCOVERED_METADATA } from '@/lib/research-search-results';
import { buildProjectExportModel } from '@/lib/project-export';
import { translateUiText } from '@/lib/i18n/ui-text';
import { plainWritingDocument, writingRichText } from '@/lib/writing-rich-text';

const mockDb = createTableFake({ strictQuery: true });
const projectId = '56cca03a-078a-4d81-b19a-8547664136d8';
const context = { params: Promise.resolve({ projectId }) };
const requestText = 'A new paragraph whose save response was lost.';
const originalText = 'Existing researcher writing must remain intact.';
const routeRequest = jest.fn(async (_url, init) => {
  const incoming = new Request('http://localhost', init);
  return init?.method === 'POST' ? POST(incoming, context) : GET(incoming, context);
});
function memoryStorage() {
  let value: string | null = null;
  return { read: () => value, write: (next: string) => { value = next; }, clear: () => { value = null; } };
}
const options = () => ({ projectId, userId: 'owner', requestText, storage: memoryStorage(), request: routeRequest as unknown as typeof fetch });
const write = (text: string, baseDocumentId: string | null = null) => POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text, citations: [], baseDocumentId }) }), context);

test('a new entry preserves saved rich formatting through a lost response and retry', async () => {
  const richText = plainWritingDocument(originalText); richText.content[0].type = 'heading'; richText.content[0].attrs = { level: 2 };
  await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text: originalText, richText, citations: [], baseDocumentId: null }) }), context);
  jest.advanceTimersByTime(1000); const input = options();
  const lost = jest.fn(async (url, init) => { const response = await routeRequest(url, init); if (init?.method === 'POST') throw new Error('Lost response'); return response; }) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request: lost })).rejects.toThrow();
  await saveWritingEntry(input);
  const latest = (await (await GET(new Request('http://localhost'), context)).json()).versions[0];
  expect(latest.richText.content[0]).toEqual(richText.content[0]);
  expect(writingRichText(latest.richText)).toBe(originalText + '\n\n' + requestText); expect(mockDb.rows('documents')).toHaveLength(2);
});

test('appending through the entry preserves the saved citation style across a lost response and retry', async () => {
  await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text: originalText, citations: [], citationStyle: 'ieee', baseDocumentId: null }) }), context);
  jest.advanceTimersByTime(1000);
  const input = options();
  const lost = jest.fn(async (url, init) => { const response = await routeRequest(url, init); if (init?.method === 'POST') throw new Error('Lost response'); return response; }) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request: lost })).rejects.toThrow('تعذر تأكيد حفظ النص');
  await saveWritingEntry(input);
  const latest = (await (await GET(new Request('http://localhost'), context)).json()).versions[0];
  expect(latest.citationStyle).toBe('ieee'); expect(latest.text).toBe(originalText + '\n\n' + requestText);
  expect(mockDb.rows('documents')).toHaveLength(2);
});

beforeEach(() => {
  jest.clearAllMocks(); mockDb.reset(); jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z') });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: mockDb.session });
  (ownsProject as jest.Mock).mockResolvedValue(true);
  mockDb.constraints.set('documents', row => mockDb.rows('documents').some(item => item.id === row.id) ? '23505' : null);
});

test('an acknowledged earlier save opens the newer project without appending twice', async () => {
  const input = options();
  const ambiguousRequest = jest.fn(async (url, init) => {
    const result = await routeRequest(url, init);
    if (init?.method === 'POST') throw new Error('Connection lost after commit.');
    return result;
  }) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request: ambiguousRequest })).rejects.toThrow('تعذر تأكيد حفظ النص');
  const first = (await (await GET(new Request('http://localhost'), context)).json()).versions[0];
  jest.advanceTimersByTime(1000);
  const laterText = first.text + '\nA later researcher revision.';
  await write(laterText, first.documentId);
  const receipt = await saveWritingEntry(input);
  expect(receipt.newerVersion).toBe(true);
  expect(mockDb.rows('documents')).toHaveLength(2);
  expect((await (await GET(new Request('http://localhost'), context)).json()).versions[0].text).toBe(laterText);
  expect(input.storage.read()).toBeNull();
});

test('a genuinely stale attempt leaves the newer writing untouched and retains the pending text', async () => {
  const initial = await (await write(originalText)).json();
  jest.advanceTimersByTime(1000);
  const input = options();
  const notDelivered = jest.fn(async (url, init) => {
    if (init?.method === 'POST') throw new Error('Request never reached the server.');
    return routeRequest(url, init);
  }) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request: notDelivered })).rejects.toThrow('تعذر تأكيد حفظ النص');
  await write('A newer researcher revision.', initial.documentId);
  await expect(saveWritingEntry(input)).rejects.toThrow('توجد نسخة أحدث');
  expect(mockDb.rows('documents')).toHaveLength(2);
  expect(input.storage.read()).toContain(requestText);
  expect((await (await GET(new Request('http://localhost'), context)).json()).versions[0].text).toBe('A newer researcher revision.');
});

test.each(['read', 'write', 'silent-write'] as const)('does not send a write when browser storage rejects %s', async failure => {
  const input = options();
  const storage = { ...input.storage, read: () => { if (failure === 'read') throw new Error('Browser internal details.'); return input.storage.read(); }, write: () => { if (failure === 'write') throw new Error('QuotaExceededError internal details.'); } };
  await expect(saveWritingEntry({ ...input, storage })).rejects.toThrow('تعذر الاحتفاظ بمحاولة الحفظ');
  expect(routeRequest.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  expect(mockDb.writes).toHaveLength(0);
});

test('validates both the owner and project of a persisted attempt before making requests', async () => {
  const input = options();
  input.storage.write(JSON.stringify({ version: 1, userId: 'someone-else', projectId, requestText, payload: { text: requestText, citations: [], baseDocumentId: null } }));
  await expect(saveWritingEntry(input)).rejects.toThrow('تعذر الاحتفاظ بمحاولة الحفظ');
  input.storage.write(JSON.stringify({ version: 1, userId: 'owner', projectId: randomUUID(), requestText, payload: { text: requestText, citations: [], baseDocumentId: null } }));
  await expect(saveWritingEntry(input)).rejects.toThrow('تعذر الاحتفاظ بمحاولة الحفظ');
  expect(routeRequest).not.toHaveBeenCalled();
  expect(writingEntryStorageKey('owner', projectId)).not.toBe(writingEntryStorageKey('other-owner', projectId));
  expect(writingEntryStorageKey('owner', projectId)).not.toBe(writingEntryStorageKey('owner', randomUUID()));
});

test.each([{ label: 'null', raw: 'null' }, { label: 'array', raw: '[]' }, { label: 'invalid JSON', raw: '{broken' }, { label: 'oversized', raw: 'x'.repeat(524_289) }])('does not overwrite an unreadable pending attempt ($label)', ({ raw }) => {
  const input = options(); input.storage.write(raw);
  return expect(saveWritingEntry(input)).rejects.toThrow('تعذر الاحتفاظ بمحاولة الحفظ');
});

test.each([null, {}, { saved: true, documentId: 'bad' }, { saved: true, documentId: '56cca03a-078a-4d81-b19a-8547664136d8', draft: { text: 'Different writing.', citations: [] } }])('only accepts a confirmed matching save receipt (%s)', async receipt => {
  const input = options();
  const request = jest.fn(async (url, init) => init?.method === 'POST' ? Response.json(receipt) : routeRequest(url, init)) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request })).rejects.toThrow('تعذر تأكيد حفظ النص');
  expect(input.storage.read()).toContain(requestText);
});

test('a failed project read does not turn an existing draft into an empty replacement', async () => {
  const input = options();
  const request = jest.fn(async () => Response.json({ versions: [] }, { status: 503 })) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request })).rejects.toThrow('تعذر استرجاع الكتابة');
  expect(mockDb.writes).toHaveLength(0);
  expect(input.storage.read()).toBeNull();
});

test('preserves fifty existing evidence links during entry, lost-response recovery and export', async () => {
  const passage = 'The fixture study reports a bounded result.';
  const citations = Array.from({ length: 50 }, (_, index) => {
    const sourceId = randomUUID();
    mockDb.seed('project_references', { id: sourceId, project_id: projectId, user_id: 'owner', provider: DISCOVERY_PROVIDER, external_item_key: `entry-fixture-${index}`, title: `Fixture source ${index + 1}`, authors: ['Fixture Author'], publication_year: 2024, publication_title: 'Fixture journal', doi: null, url: null, citation_data: { metadataOrigin: SERVER_DISCOVERED_METADATA, discovery: { resultId: `saved-fixture-${index}` }, discoveredPaper: { abstract: passage } } });
    return { id: randomUUID(), claimStart: 0, claimEnd: originalText.length, claimText: originalText, sourceKind: 'reference', sourceId, sourceHash: createHash('sha256').update(passage).digest('hex'), quoteStart: 0, quoteEnd: passage.length, quoteText: passage, relation: 'contextual', note: `Researcher note ${index + 1}` };
  });
  const initial = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text: originalText, citations, baseDocumentId: null }) }), context);
  expect(initial.status).toBe(200); jest.advanceTimersByTime(1000);
  const input = options();
  const ambiguous = jest.fn(async (url, init) => {
    const result = await routeRequest(url, init);
    if (init?.method === 'POST') throw new Error('Response lost after committing all evidence.');
    return result;
  }) as unknown as typeof fetch;
  await expect(saveWritingEntry({ ...input, request: ambiguous })).rejects.toThrow();
  jest.advanceTimersByTime(1000); await saveWritingEntry(input);
  const latest = (await (await GET(new Request('http://localhost'), context)).json()).versions[0];
  expect(latest.text).toBe(`${originalText}\n\n${requestText}`);
  expect(latest.citations.map((c: { id: string }) => c.id)).toEqual(citations.map(c => c.id));
  expect(latest.citations.map((c: { note: string }) => c.note)).toEqual(citations.map(c => c.note));
  const docs = mockDb.rows('documents') as Array<{ type: string; content: string; version: number; created_at: string }>;
  const model = buildProjectExportModel({ title: 'Entry recovery fixture', university_policy: null }, docs, [], [], undefined, 'en');
  expect(model.sections.filter(section => /^Evidence \d+ — /.test(section.title))).toHaveLength(50);
  expect(model.sections.find(section => section.title === 'Draft')?.paragraphs.join('\n').split(requestText)).toHaveLength(2);
  expect(mockDb.rows('documents')).toHaveLength(2);
  expect(mockDb.writes.every(entry => entry.client === 'service')).toBe(true);
});

test.each([
  'تعذر استرجاع الكتابة. نصك باقٍ؛ أعد المحاولة.',
  'تعذر الاحتفاظ بمحاولة الحفظ في هذا المتصفح. احتفظ بنصك وافتح محرر المشروع للمتابعة.',
  'تعذر إضافة النص إلى المسودة. افتح محرر المشروع لمراجعة النص وإضافته.',
  'تعذر تأكيد حفظ النص. أعد المحاولة؛ سنراجع محاولة الحفظ نفسها.',
  'توجد نسخة أحدث في المشروع. نصك باقٍ؛ افتح محرر المشروع لمراجعتها.',
  'افتح المشروع المحفوظ',
  'تعذر الاحتفاظ بالنص في هذا المتصفح. انسخه قبل المتابعة.',
])('customer recovery copy is translated: %s', message => {
  expect(translateUiText(message, 'en')).not.toMatch(/[\u0600-\u06ff]/);
});
afterEach(() => jest.useRealTimers());

test('retrying after a lost save response keeps one appended paragraph, including after a reload', async () => {
  await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text: originalText, citations: [], baseDocumentId: null }) }), context);
  jest.advanceTimersByTime(1000);
  let stored: string | null = null;
  const storage = { read: () => stored, write: (value: string) => { stored = value; }, clear: () => { stored = null; } };
  let dropResponse = true;
  const request = jest.fn(async (_url, init) => {
    const incoming = new Request('http://localhost', init);
    const result = init?.method === 'POST' ? await POST(incoming, context) : await GET(incoming, context);
    if (init?.method === 'POST' && dropResponse && result.ok) { dropResponse = false; throw new TypeError('Network connection closed after the server committed.'); }
    return result;
  }) as unknown as typeof fetch;
  await expect(saveWritingEntry({ projectId, userId: 'owner', requestText, storage, request })).rejects.toThrow('تعذر تأكيد حفظ النص');
  expect(mockDb.rows('documents')).toHaveLength(2);
  jest.advanceTimersByTime(1000);
  // A new invocation has only persisted state, as after leaving/reloading home.
  await saveWritingEntry({ projectId, userId: 'owner', requestText, storage, request });
  const restored = await (await GET(new Request('http://localhost'), context)).json();
  expect(restored.versions[0].text).toBe(`${originalText}\n\n${requestText}`);
  expect(mockDb.rows('documents')).toHaveLength(2);
  expect(stored).toBeNull();
  expect((request as jest.Mock).mock.calls.filter(([, init]) => init?.method !== 'POST')).toHaveLength(1);
});
