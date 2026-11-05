import { parseWritingDraft, readSavedWriting, type SavedWritingDraft, type WritingDraft } from '@/lib/evidence-writing';
import { isUuid } from '@/lib/research-evidence';

export type WritingVersion = SavedWritingDraft & { documentId: string; savedAt: string };
export type WritingRecovery = WritingDraft & { baseDocumentId: string | null };
export type RecoveryStorage = { read: () => string | null; write: (raw: string) => void; clear: () => void };
const MAX_RECOVERY = 524288;
const validTime = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && value.length <= 64 && Number.isFinite(Date.parse(value));

export function readWritingRecovery(raw: string | null): WritingRecovery | null {
  try {
    if (!raw || raw.length > MAX_RECOVERY) return null;
    const value = JSON.parse(raw), draft = parseWritingDraft(value);
    if (!draft || !(value.baseDocumentId === null || isUuid(value.baseDocumentId))) return null;
    return { ...draft, baseDocumentId: value.baseDocumentId };
  } catch { return null; }
}
export function persistWritingRecovery(storage: RecoveryStorage | null, draft: WritingDraft, baseDocumentId: string | null) {
  if (!storage) return false;
  try {
    const raw = JSON.stringify({ ...draft, baseDocumentId });
    if (raw.length > MAX_RECOVERY) return false;
    storage.write(raw);
    return storage.read() === raw;
  } catch { return false; }
}
function sameDraft(a: WritingDraft, b: WritingDraft) {
  return JSON.stringify(parseWritingDraft(a)) === JSON.stringify(parseWritingDraft(b));
}
export function readWritingVersion(value: unknown): WritingVersion | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>, draft = readSavedWriting(row);
  return draft && isUuid(row.documentId) && validTime(row.savedAt) ? { ...draft, documentId: row.documentId, savedAt: row.savedAt } : null;
}
/** A valid but unrelated response never acknowledges this draft. */
export function readWritingSaveReceipt(value: unknown, requested: WritingDraft): WritingVersion | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.saved !== true) return null;
  const version = readWritingVersion({ ...(row.draft as object), documentId: row.documentId, savedAt: row.savedAt });
  return version && sameDraft(version, requested) ? version : null;
}
/** Late responses from an unmounted editor cannot erase newer local edits. */
export function clearMatchingWritingRecovery(storage: RecoveryStorage | null, requested: WritingDraft, baseDocumentId: string | null) {
  try {
    const current = storage && readWritingRecovery(storage.read());
    if (current && current.baseDocumentId === baseDocumentId && sameDraft(current, requested)) storage!.clear();
  } catch { /* A confirmed project save still succeeded if local cleanup fails. */ }
}
export async function restoreWritingWorkspace(url: string, storage: RecoveryStorage | null, request: typeof fetch = fetch) {
  let local: WritingRecovery | null = null;
  try { local = readWritingRecovery(storage?.read() || null); } catch { /* Server restore remains available. */ }
  let denied = false;
  try {
    const response = await request(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    // Expired/revoked sessions and inaccessible projects do not reveal cached
    // text via this fallback, and never cause its local copy to be deleted.
    if (!response.ok) { denied = response.status < 500 && response.status !== 429; throw new Error('restore_failed'); }
    const data = await response.json();
    if (!Array.isArray(data?.versions)) throw new Error('invalid_versions');
    const versions = data.versions.map(readWritingVersion);
    if (versions.some((version: WritingVersion | null) => !version)) throw new Error('invalid_version');
    return { versions: versions as WritingVersion[], local, serverUnavailable: false };
  } catch (error) {
    if (!local || denied) throw error;
    return { versions: [] as WritingVersion[], local, serverUnavailable: true };
  }
}
