import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { JOURNAL_REVIEW_TYPE, parseJournalReview } from '@/lib/journal-review';

const headers = { 'Cache-Control': 'private, no-store' };

/** Saved review rounds, newest first. */
export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const result = await auth.access.supabase.from('documents').select('id, content, created_at').eq('project_id', auth.projectId).eq('type', JOURNAL_REVIEW_TYPE)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (result.error) throw result.error;
    const reviews = (result.data || []).flatMap(row => {
      try { const review = parseJournalReview(JSON.parse(String(row.content))); return review ? [{ ...review, documentId: row.id, savedAt: row.created_at }] : []; } catch { return []; }
    });
    return NextResponse.json({ reviews }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر استرجاع ملاحظات المحكمين. أعد المحاولة.' }, { status: 503, headers }); }
}

/** Saves an immutable snapshot of a review round; an identical retry has the same ID. */
export async function POST(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const review = parseJournalReview(await request.json().catch(() => null));
    if (!review) return NextResponse.json({ error: 'أضف ملاحظة واحدة على الأقل، واختر قرار المجلة. الملاحظة المعالجة أو غير المعدّلة تحتاج ردك.' }, { status: 400, headers });
    const hash = createHash('sha256').update(JSON.stringify([JOURNAL_REVIEW_TYPE, auth.projectId, review])).digest('hex');
    const documentId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const saved = await createServiceClient().from('documents').insert({ id: documentId, project_id: auth.projectId, type: JOURNAL_REVIEW_TYPE, content: JSON.stringify(review), version: 1 });
    if (saved.error && saved.error.code !== '23505') throw saved.error;
    return NextResponse.json({ saved: true, documentId }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر حفظ ملاحظات المحكمين. ما أدخلته باقٍ في الصفحة؛ أعد المحاولة.' }, { status: 503, headers }); }
}
