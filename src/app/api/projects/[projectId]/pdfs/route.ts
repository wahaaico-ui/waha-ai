import type { PDFParse } from 'pdf-parse';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { canonicalPdfPages, PDF_MAX_BYTES, PDF_MAX_PAGES, type PdfFileRecord } from '@/lib/pdf-evidence';
import { pdfDigest, pdfSourceId, persistPdfFile } from '@/lib/pdf-evidence-server';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

export async function POST(request: Request, context: ProjectRouteContext) {
  let parser: PDFParse | undefined;
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const limit = PDF_MAX_BYTES + 64 * 1024;
    if (Number(request.headers.get('content-length')) > limit || !request.body) return json({ error: 'اختر ملف PDF حتى 4 ميجابايت.' }, 413);
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > limit) { await reader.cancel(); return json({ error: 'اختر ملف PDF حتى 4 ميجابايت.' }, 413); } chunks.push(part.value); } } finally { reader.releaseLock(); }
    const form = await new Request('http://upload.local', { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') || '' }, body: Buffer.concat(chunks) }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.type !== 'application/pdf' || !file.size || file.size > PDF_MAX_BYTES) return json({ error: 'اختر ملف PDF حتى 4 ميجابايت.' }, 422);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString() !== '%PDF-') return json({ error: 'تعذر فتح الملف كملف PDF.' }, 422);
    const { PDFParse } = await import('pdf-parse'); parser = new PDFParse({ data: new Uint8Array(bytes) });
    const info = await parser.getInfo();
    if (info.total < 1 || info.total > PDF_MAX_PAGES) return json({ error: 'اختر ملفًا يحتوي حتى 50 صفحة.' }, 422);
    const result = await parser.getText({ pageJoiner: '' }); const canonical = canonicalPdfPages(result.pages, info.total);
    const fileHash = pdfDigest(bytes), sourceId = pdfSourceId(auth.projectId, fileHash);
    const record: PdfFileRecord = { sourceId, projectId: auth.projectId, ownerId: auth.access.user.id, fileName: (file.name.replace(/[\u0000-\u001f\u007f]/g, '').trim() || 'document.pdf').slice(0, 255), fileHash, textHash: pdfDigest(canonical.text), bytes: bytes.length, totalPages: info.total, pages: canonical.pages };
    const saved = await persistPdfFile(auth.access.supabase, createServiceClient(), record, canonical.text, bytes);
    return json({ saved: true, sourceId, fileName: saved.fileName, totalPages: saved.totalPages, hasText: canonical.text.trim().length > 0 });
  } catch { return json({ error: 'تعذر تأكيد حفظ الملف. أعد المحاولة بالملف نفسه.' }, 503); }
  finally { await parser?.destroy(); }
}
