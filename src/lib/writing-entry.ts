import { parseWritingDraft, readSavedWriting, type WritingDraft } from '@/lib/evidence-writing';
import { isUuid } from '@/lib/research-evidence';
import { appendWritingRichText } from '@/lib/writing-rich-text';

type Payload = WritingDraft & { baseDocumentId: string | null };
type PendingEntry = { version: 1; projectId: string; userId: string; requestText: string; payload: Payload };
const MAX_CACHED_ENTRY = 524_288;
const MESSAGES = {
  restore: 'تعذر استرجاع الكتابة. نصك باقٍ؛ أعد المحاولة.',
  storage: 'تعذر الاحتفاظ بمحاولة الحفظ في هذا المتصفح. احتفظ بنصك وافتح محرر المشروع للمتابعة.',
  input: 'تعذر إضافة النص إلى المسودة. افتح محرر المشروع لمراجعة النص وإضافته.',
  save: 'تعذر تأكيد حفظ النص. أعد المحاولة؛ سنراجع محاولة الحفظ نفسها.',
  conflict: 'توجد نسخة أحدث في المشروع. نصك باقٍ؛ افتح محرر المشروع لمراجعتها.',
} as const;

export type WritingEntryOptions = {
  projectId: string;
  userId: string;
  requestText: string;
  storage: { read: () => string | null; write: (value: string) => void; clear: () => void };
  request?: typeof fetch;
};

export function writingEntryStorageKey(userId: string, projectId: string) {
  return `waha-writing-entry:v1:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;
}

function readPending(raw: string): PendingEntry {
  try {
    if (raw.length > MAX_CACHED_ENTRY) throw new Error();
    const entry = JSON.parse(raw);
    const draft = parseWritingDraft(entry?.payload);
    const base = entry?.payload?.baseDocumentId;
    if (entry?.version !== 1 || !isUuid(entry.projectId) || typeof entry.userId !== 'string' || !entry.userId
      || typeof entry.requestText !== 'string' || !entry.requestText.trim() || entry.requestText.length > 12000
      || !draft || !draft.text.endsWith(entry.requestText) || !(base === null || isUuid(base))) throw new Error();
    return { version: 1, projectId: entry.projectId, userId: entry.userId, requestText: entry.requestText, payload: { ...draft, baseDocumentId: base } };
  } catch { throw new Error(MESSAGES.storage); }
}

/** Persist the exact write before sending it. A lost response must never rebuild
 * the append from the now-updated server draft; the route already deduplicates
 * identical payloads and their base revision. No AI or privileged client here. */
export async function saveWritingEntry({ projectId, userId, requestText, storage, request = fetch }: WritingEntryOptions) {
  if (!isUuid(projectId) || !userId || !requestText.trim() || requestText.length > 12000) throw new Error(MESSAGES.input);
  const url = `/api/projects/${encodeURIComponent(projectId)}/writing`;
  let raw: string | null;
  try { raw = storage.read(); } catch { throw new Error(MESSAGES.storage); }
  const pending = raw === null ? null : readPending(raw);
  if (pending && (pending.projectId !== projectId || pending.userId !== userId)) throw new Error(MESSAGES.storage);
  let payload = pending?.requestText === requestText ? pending.payload : null;
  if (!payload) {
    let stored;
    try {
      const response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      stored = await response.json();
      if (!response.ok || !Array.isArray(stored.versions)) throw new Error();
    } catch { throw new Error(MESSAGES.restore); }
    const latest = stored.versions[0];
    const restored = latest ? readSavedWriting(latest) : null;
    if (latest && (!restored || !isUuid(latest.documentId))) throw new Error(MESSAGES.restore);
    const richText = appendWritingRichText(restored?.richText, restored?.text || '', requestText);
    const draft = parseWritingDraft({ ...restored, text: restored?.text ? `${restored.text}\n\n${requestText}` : requestText, citations: restored?.citations || [], ...(richText ? { richText } : {}) });
    if (!draft) throw new Error(MESSAGES.input);
    payload = { ...draft, baseDocumentId: latest?.documentId || null };
    const entry: PendingEntry = { version: 1, projectId, userId, requestText, payload };
    const serialized = JSON.stringify(entry);
    try {
      if (serialized.length > MAX_CACHED_ENTRY) throw new Error();
      storage.write(serialized);
      // Do not submit if a browser silently declines persistence.
      if (storage.read() !== serialized) throw new Error();
    } catch { throw new Error(MESSAGES.storage); }
  }
  let response: Response;
  let receipt;
  try {
    response = await request(url, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    receipt = await response.json();
  } catch { throw new Error(MESSAGES.save); }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error(MESSAGES.save);
  // The first attempt was saved, but another revision followed it. Retrying
  // must open the project, not append the same entry to that newer revision.
  const savedBeforeNewerRevision = response.status === 409 && receipt.saved === true && receipt.code === 'version_conflict';
  if (!response.ok && !savedBeforeNewerRevision) throw new Error(response.status === 409 && receipt.code === 'version_conflict' ? MESSAGES.conflict : [413, 422].includes(response.status) || ['source_changed', 'source_missing'].includes(receipt.code) ? MESSAGES.input : MESSAGES.save);
  const restored = readSavedWriting(receipt.draft);
  if (receipt.saved !== true || !isUuid(receipt.documentId) || (!savedBeforeNewerRevision && (!restored || JSON.stringify(parseWritingDraft(restored)) !== JSON.stringify(parseWritingDraft(payload))))) throw new Error(MESSAGES.save);
  try { storage.clear(); } catch { /* The verified save succeeded; a retained retry remains idempotent. */ }
  return { documentId: receipt.documentId as string, newerVersion: savedBeforeNewerRevision };
}
