import { authoriseProject } from '@/lib/research-project-access';
import { isUuid } from '@/lib/research-evidence';
import { createServiceClient } from '@/lib/supabase/service';
import { PDF_BUCKET } from '@/lib/pdf-evidence';
import { pdfDigest, pdfStoragePath, readPdfRecord } from '@/lib/pdf-evidence-server';

type Context = { params: Promise<{ projectId: string; sourceId: string }> };
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export async function GET(_request: Request, context: Context) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const { sourceId } = await context.params; if (!isUuid(sourceId)) return Response.json({ error: 'File not found' }, { status: 404, headers });
    const record = await readPdfRecord(auth.access.supabase, auth.projectId, sourceId);
    if (!record || record.ownerId !== auth.access.user.id) return Response.json({ error: 'File not found' }, { status: 404, headers });
    const downloaded = await createServiceClient().storage.from(PDF_BUCKET).download(pdfStoragePath(record));
    if (downloaded.error || !downloaded.data || downloaded.data.size !== record.bytes) throw new Error('file_unavailable');
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (pdfDigest(bytes) !== record.fileHash) throw new Error('file_changed');
    return new Response(bytes, { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.length), 'Content-Disposition': `inline; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(record.fileName).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`, 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch { return Response.json({ error: 'تعذر فتح الملف الأصلي. أعد المحاولة.' }, { status: 503, headers }); }
}
