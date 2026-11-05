import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { literaturePaperFromReference } from '@/lib/research-search-results';
import { referenceOrigin } from '@/lib/research-references';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';
import { safeWritingUrl, type WritingSource, type WritingSourceKind, type WritingCitation } from '@/lib/evidence-writing';
import { PDF_FILE_TYPE, readPdfFileRecord, type PdfFileRecord } from '@/lib/pdf-evidence';
import { pdfRecordId, readPdfRecord } from '@/lib/pdf-evidence-server';

const REFERENCE_COLUMNS = 'id, project_id, provider, external_item_key, title, authors, publication_year, publication_title, doi, url, citation_data';
export type WritingReferenceRow = { id: string; project_id: string; provider: string; external_item_key: string; title: string; authors: unknown; publication_year: number | null; publication_title: string | null; doi: string | null; url: string | null; citation_data: unknown };
export type WritingPdfRow = { id: string; raw_text: string | null; parsed_citation_apa: string | null };
export function writingSourceFromReference(row: WritingReferenceRow): WritingSource {
  const text = cleanSourceText(literaturePaperFromReference(row).abstract || '');
  return { id: row.id, kind: 'reference', title: row.title.slice(0, 1000), text, hash: hashSource(text), origin: referenceOrigin(row), url: safeWritingUrl(row.url), year: row.publication_year, bibliography: bibliographyFromReference(row) };
}
export function writingSourceFromPdf(row: WritingPdfRow, record?: PdfFileRecord | null): WritingSource {
  const text = cleanSourceText(row.raw_text || '');
  if (record && (record.sourceId !== row.id || record.textHash !== hashSource(text) || record.pages.at(-1)?.end !== text.length)) throw new Error('pdf_source_changed');
  const pdf = record ? { fileName: record.fileName, fileHash: record.fileHash, textHash: record.textHash, bytes: record.bytes, totalPages: record.totalPages, pages: record.pages } : undefined;
  return { id: row.id, kind: 'pdf', title: (row.parsed_citation_apa || record?.fileName || text.split('\n').find(line => line.trim()) || 'PDF').slice(0, 1000), text, hash: hashSource(text), origin: 'uploaded_text', url: null, year: null, ...(pdf ? { pdf } : {}) };
}

export async function readWritingSource(db: SupabaseClient, projectId: string, kind: WritingSourceKind, id: string): Promise<WritingSource | null> {
  if (kind === 'reference') {
    const result = await db.from('project_references').select(REFERENCE_COLUMNS)
      .eq('project_id', projectId).eq('id', id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    return writingSourceFromReference(result.data);
  }
  const result = await db.from('sources').select('id, raw_text, parsed_citation_apa').eq('project_id', projectId).eq('id', id).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  return writingSourceFromPdf(result.data, await readPdfRecord(db, projectId, id));
}

/** Read in batches rather than issuing one request per cited study. */
export async function* readWritingSources(db: SupabaseClient, projectId: string, citations: WritingCitation[]) {
  for (const kind of ['reference', 'pdf'] as const) {
    const ids = [...new Set(citations.filter(c => c.sourceKind === kind).map(c => c.sourceId))];
    const batchSize = kind === 'pdf' ? 20 : 100;
    for (let start = 0; start < ids.length; start += batchSize) {
      const batch = ids.slice(start, start + batchSize);
      const sources = new Map<string, WritingSource>();
      const result = await db.from(kind === 'reference' ? 'project_references' : 'sources').select(kind === 'reference' ? REFERENCE_COLUMNS : 'id, raw_text, parsed_citation_apa').eq('project_id', projectId).in('id', batch);
      if (result.error) throw result.error;
      const records = new Map<string, PdfFileRecord>();
      if (kind === 'pdf') {
        const metadata = await db.from('documents').select('content').eq('project_id', projectId).eq('type', PDF_FILE_TYPE).in('id', batch.map(id => pdfRecordId(projectId, id)));
        if (metadata.error) throw metadata.error;
        for (const item of metadata.data || []) { const record = readPdfFileRecord(item.content); if (!record || record.projectId !== projectId) throw new Error('invalid_pdf_record'); records.set(record.sourceId, record); }
      }
      for (const row of result.data || []) {
        const source = kind === 'reference' ? writingSourceFromReference(row as unknown as WritingReferenceRow) : writingSourceFromPdf(row as unknown as WritingPdfRow, records.get((row as unknown as WritingPdfRow).id));
        sources.set(`${kind}:${source.id}`, source);
      }
      yield { keys: new Set(batch.map(id => `${kind}:${id}`)), sources };
    }
  }
}
function cleanSourceText(value: string) { return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''); }
function hashSource(value: string) { return createHash('sha256').update(value).digest('hex'); }

/** Bounded JSON parsing, including requests with a forged Content-Length. */
export async function readWritingRequest(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const limit = 512 * 1024;
  if (Number(request.headers.get('content-length')) > limit) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder(); let bytes = 0; let text = '';
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) { await reader.cancel(); return { ok: false, status: 413 }; }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, body: JSON.parse(text) };
  } catch { return { ok: false, status: 400 }; }
  finally { reader.releaseLock(); }
}
