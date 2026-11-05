import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { parseSupervisorReview, readSupervisorReview, SUPERVISOR_DOCUMENT_TYPE } from '@/lib/supervisor-review';

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const result = await auth.access.supabase.from('documents').select('id, content, created_at').eq('project_id', auth.projectId).eq('type', SUPERVISOR_DOCUMENT_TYPE).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
    if (result.error) throw result.error;
    const reviews = (result.data || []).flatMap((row) => { const review = readSupervisorReview(row.content); return review ? [{ ...review, documentId: row.id, savedAt: row.created_at }] : []; });
    return NextResponse.json({ reviews }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'تعذر استرجاع المراجعات. أعد المحاولة.' }, { status: 503 }); }
}

export async function POST(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const review = parseSupervisorReview(await request.json().catch(() => null));
    if (!review) return NextResponse.json({ error: 'أدخل نصًا من 20–12000 حرف، وملاحظات صالحة. عند تسجيل تعديل أو تأجيل، أضف ردك؛ وعند التعديل يجب أن يختلف النص المعدّل.' }, { status: 400 });
    // Immutable snapshots. An identical retry has the same server-owned ID.
    const hash = createHash('sha256').update(JSON.stringify([SUPERVISOR_DOCUMENT_TYPE, auth.projectId, review])).digest('hex');
    const documentId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const saved = await createServiceClient().from('documents').insert({ id: documentId, project_id: auth.projectId, type: SUPERVISOR_DOCUMENT_TYPE, content: JSON.stringify(review), version: 1 });
    if (saved.error && saved.error.code !== '23505') throw saved.error;
    if (saved.error) {
      const existing = await auth.access.supabase.from('documents').select('content').eq('id', documentId).eq('project_id', auth.projectId).eq('type', SUPERVISOR_DOCUMENT_TYPE).maybeSingle();
      if (existing.error || !readSupervisorReview(existing.data?.content)) throw new Error('Saved review unavailable');
    }
    return NextResponse.json({ saved: true, documentId }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'تعذر حفظ المراجعة. النص الحالي باقٍ في المحرر؛ أعد المحاولة.' }, { status: 503 }); }
}
