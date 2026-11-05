import { clearMatchingWritingRecovery, persistWritingRecovery, readWritingRecovery, readWritingSaveReceipt, restoreWritingWorkspace, type RecoveryStorage } from '@/lib/writing-recovery';
import { plainWritingDocument } from '@/lib/writing-rich-text';
const documentId = 'faddfe2c-78f0-4e15-a24d-df151c43f7aa';
const draft = { text: 'Researcher writing with 42 participants.', citations: [], citationStyle: 'ieee' as const };
const recovery = { ...draft, baseDocumentId: documentId };
const receipt = { saved: true, documentId, savedAt: '2026-10-21T09:00:00.000Z', draft };
const memory = () => { let raw: string | null = JSON.stringify(recovery); return { read: () => raw, write: (value: string) => { raw = value; }, clear: () => { raw = null; } }; };
const respond = (body: unknown, status = 200) => jest.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;

test.each([500, 503, 429])('recovers exact local writing and base when the server is unavailable (%i)', async status => {
  const restored = await restoreWritingWorkspace('/fixture', memory(), respond({}, status));
  expect(restored).toEqual({ versions: [], local: recovery, serverUnavailable: true });
});
test('recovers after a network timeout without inventing a server save', async () => {
  const request = jest.fn().mockRejectedValue(new TypeError('offline'));
  expect((await restoreWritingWorkspace('/fixture', memory(), request)).serverUnavailable).toBe(true);
});
test.each([401, 403, 404, 422])('does not expose or erase the cached writing after access denial (%i)', async status => {
  const storage = memory(), before = storage.read();
  await expect(restoreWritingWorkspace('/fixture', storage, respond({}, status))).rejects.toThrow();
  expect(storage.read()).toBe(before);
});
test('server restore works when local browser storage is blocked', async () => {
  const storage: RecoveryStorage = { read: () => { throw Error('blocked'); }, write: () => { throw Error('blocked'); }, clear: () => {} };
  const result = await restoreWritingWorkspace('/fixture', storage, respond({ versions: [{ ...draft, documentId, savedAt: receipt.savedAt }] }));
  expect(result.versions[0].text).toBe(draft.text); expect(result.local).toBeNull();
  expect(persistWritingRecovery(storage, draft, documentId)).toBe(false);
});
test('retains local formatting and the citation style when newer server data exists', async () => {
  const storage = memory(), richText = plainWritingDocument(draft.text);
  richText.content[0].content![0].marks = [{ type: 'bold' }];
  expect(persistWritingRecovery(storage, { ...draft, richText }, documentId)).toBe(true);
  const result = await restoreWritingWorkspace('/fixture', storage, respond({ versions: [{ ...draft, text: 'Newer server text.', documentId, savedAt: receipt.savedAt }] }));
  expect(result.local?.richText).toEqual(richText); expect(result.local?.citationStyle).toBe('ieee'); expect(result.local?.baseDocumentId).toBe(documentId);
});
test.each([null,'bad','{"text":"valid","citations":[],"baseDocumentId":"bad"}',JSON.stringify({ text: 'x'.repeat(120001), citations: [], baseDocumentId: null })])('rejects invalid recovery data', raw => { expect(readWritingRecovery(raw)).toBeNull(); });
test('requires round-trip browser persistence; no silently declined write is accepted', () => {
  const storage = memory(); storage.write = () => {};
  expect(persistWritingRecovery(storage, { ...draft, text: 'Different text.' }, documentId)).toBe(false);
});
test('accepts only the exact confirmed save including rich content and style', () => {
  expect(readWritingSaveReceipt(receipt, draft)?.documentId).toBe(documentId);
  for (const wrong of [{ ...receipt, saved: false }, { ...receipt, documentId: 'bad' }, { ...receipt, savedAt: 'not-time' }, { ...receipt, draft: { ...draft, text: 'Unrelated response.' } }, { ...receipt, draft: { ...draft, citationStyle: 'apa-7' } }]) expect(readWritingSaveReceipt(wrong, draft)).toBeNull();
  const rich = plainWritingDocument(draft.text);
  expect(readWritingSaveReceipt(receipt, { ...draft, richText: rich })).toBeNull();
});
test('a late acknowledgement never deletes a newer local draft or base', () => {
  const storage = memory(); persistWritingRecovery(storage, { ...draft, text: 'New local edit.' }, documentId);
  clearMatchingWritingRecovery(storage, draft, documentId); expect(storage.read()).not.toBeNull();
  persistWritingRecovery(storage, draft, null); clearMatchingWritingRecovery(storage, draft, documentId); expect(storage.read()).not.toBeNull();
  clearMatchingWritingRecovery(storage, draft, null); expect(storage.read()).toBeNull();
});
test('without a valid local copy the failure stays visible rather than creating an empty replacement', async () => {
  const storage = memory(); storage.clear();
  await expect(restoreWritingWorkspace('/fixture', storage, respond({},503))).rejects.toThrow();
});
