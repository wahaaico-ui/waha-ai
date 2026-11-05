import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { isUuid } from '@/lib/research-evidence';
import { readWritingSource } from '@/lib/evidence-writing-server';
import { PDF_FILE_TYPE, readPdfFileRecord } from '@/lib/pdf-evidence';
import { pdfRecordId } from '@/lib/pdf-evidence-server';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) { auth.response.headers.set('Cache-Control', 'private, no-store'); return auth.response; }
    const query = new URL(request.url).searchParams;
    const kind = query.get('kind');
    if (kind !== 'reference' && kind !== 'pdf') return json({ error: 'اختر نوع المصدر.' }, 400);
    const id = query.get('sourceId');
    if (id !== null) {
      if (!isUuid(id)) return json({ error: 'اختر مصدرًا محفوظًا.' }, 400);
      const source = await readWritingSource(auth.access.supabase, auth.projectId, kind, id);
      return source ? json({ source }) : json({ error: 'المصدر غير موجود في هذا المشروع.' }, 404);
    }
    const offset = Number(query.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10_000_000) return json({ error: 'تعذر فتح قائمة المصادر.' }, 400);
    const result = kind === 'reference'
      ? await auth.access.supabase.from('project_references').select('id, title, publication_year', { count: 'exact' }).eq('project_id', auth.projectId).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 49)
      : await auth.access.supabase.from('sources').select('id, parsed_citation_apa', { count: 'exact' }).eq('project_id', auth.projectId).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 49);
    if (result.error) throw result.error;
    const names = new Map<string, string>();
    if (kind === 'pdf' && result.data?.length) {
      const files = await auth.access.supabase.from('documents').select('content').eq('project_id', auth.projectId).eq('type', PDF_FILE_TYPE).in('id', result.data.map(row => pdfRecordId(auth.projectId, row.id)));
      if (files.error) throw files.error;
      for (const file of files.data || []) { const record = readPdfFileRecord(file.content); if (record?.projectId === auth.projectId && record.ownerId === auth.access.user.id) names.set(record.sourceId, record.fileName); }
    }
    const items = (result.data || []).map((row, i) => ({ id: row.id, kind, title: 'title' in row ? row.title : row.parsed_citation_apa || names.get(row.id) || `PDF ${offset + i + 1}`, year: 'publication_year' in row ? row.publication_year : null }));
    const total = result.count;
    return json({ items, nextOffset: total !== null && offset + items.length < total ? offset + items.length : null });
  } catch { return json({ error: 'تعذر فتح المصادر. أعد المحاولة.' }, 503); }
}
