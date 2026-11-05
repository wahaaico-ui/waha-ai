import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PDF_BUCKET, PDF_FILE_TYPE, readPdfFileRecord, type PdfFileRecord } from '@/lib/pdf-evidence';
import { isUuid } from '@/lib/research-evidence';

export const pdfDigest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function stableId(value: string) { const h = pdfDigest(value); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }
export const pdfSourceId = (projectId: string, fileHash: string) => stableId(JSON.stringify([PDF_FILE_TYPE, projectId, fileHash]));
export const pdfRecordId = (projectId: string, sourceId: string) => stableId(JSON.stringify([PDF_FILE_TYPE, projectId, sourceId]));
export const pdfStoragePath = (r: Pick<PdfFileRecord, 'ownerId' | 'projectId' | 'sourceId' | 'fileHash'>) => `${r.ownerId}/${r.projectId}/${r.sourceId}/${r.fileHash}.pdf`;

export async function readPdfRecord(db: SupabaseClient, projectId: string, sourceId: string) {
  const result = await db.from('documents').select('content').eq('project_id', projectId).eq('type', PDF_FILE_TYPE).eq('id', pdfRecordId(projectId, sourceId)).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const record = readPdfFileRecord(result.data.content);
  if (!record || record.projectId !== projectId || record.sourceId !== sourceId) throw new Error('invalid_pdf_record');
  return record;
}
export async function persistPdfFile(db: SupabaseClient, service: SupabaseClient, record: PdfFileRecord, text: string, bytes: Buffer) {
  const path = pdfStoragePath(record);
  const stored = await service.storage.from(PDF_BUCKET).upload(path, bytes, { upsert: false, contentType: 'application/pdf', cacheControl: '0' });
  if (stored.error) {
    if (!['409', 'Duplicate'].includes(String(stored.error.statusCode)) && !/already exists/i.test(stored.error.message)) throw stored.error;
    const existing = await service.storage.from(PDF_BUCKET).download(path);
    if (existing.error || !existing.data || pdfDigest(new Uint8Array(await existing.data.arrayBuffer())) !== record.fileHash) throw new Error('file_conflict');
  }
  const source = await db.from('sources').select('id, raw_text').eq('project_id', record.projectId).eq('id', record.sourceId).maybeSingle();
  if (source.error) throw source.error;
  if (source.data && source.data.raw_text !== text) throw new Error('source_conflict');
  if (!source.data) {
    const result = await service.from('sources').insert({ id: record.sourceId, project_id: record.projectId, raw_text: text, confidence: 'not_assessed' });
    if (result.error && result.error.code !== '23505') throw result.error;
  }
  const content = JSON.stringify(record), id = pdfRecordId(record.projectId, record.sourceId);
  const result = await service.from('documents').insert({ id, project_id: record.projectId, type: PDF_FILE_TYPE, version: 1, content });
  if (result.error && result.error.code !== '23505') throw result.error;
  const saved = await readPdfRecord(db, record.projectId, record.sourceId);
  const confirmed = await db.from('sources').select('raw_text').eq('project_id', record.projectId).eq('id', record.sourceId).maybeSingle();
  if (!saved || saved.fileHash !== record.fileHash || saved.textHash !== record.textHash || confirmed.error || confirmed.data?.raw_text !== text) throw new Error('save_not_confirmed');
  return saved;
}

/** Account deletion must remove binaries, including an interrupted upload that
 * never obtained a manifest. Folder names derive from the authenticated UUID. */
export async function deleteAccountPdfFiles(service: SupabaseClient, userId: string) {
  if (!isUuid(userId)) throw new Error('invalid_pdf_owner');
  const bucket = await service.storage.getBucket(PDF_BUCKET);
  if (bucket.error) { if (String(bucket.error.statusCode) === '404' || /not found/i.test(bucket.error.message)) return; throw bucket.error; }
  async function removeFolder(prefix: string, depth: number) {
    if (depth > 3) throw new Error('unexpected_pdf_folder');
    // Delete each page before listing again; an advancing offset would skip
    // objects that shifted after the previous deletion.
    while (true) {
      const result = await service.storage.from(PDF_BUCKET).list(prefix, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } });
      if (result.error) throw result.error; if (!result.data?.length) return;
      const files: string[] = [];
      for (const item of result.data) {
        if (!item.name || item.name.includes('/') || item.name === '.' || item.name === '..') throw new Error('invalid_pdf_path');
        const path = `${prefix}/${item.name}`;
        if (item.id) files.push(path); else await removeFolder(path, depth + 1);
      }
      if (files.length) { const removed = await service.storage.from(PDF_BUCKET).remove(files); if (removed.error) throw removed.error; }
    }
  }
  await removeFolder(userId, 0);
}
