import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { IDEA_SELECTION_TYPE, parseAnswers, parseConstraints } from '@/lib/idea-selection/questions';
import { parseRatings } from '@/lib/idea-selection/matrix';

const headers = { 'Cache-Control': 'private, no-store' };

function readSelection(content: unknown) {
  try {
    const value = JSON.parse(String(content)) as Record<string, unknown>;
    const answers = parseAnswers(value.answers), ratings = parseRatings(value.ratings);
    // Snapshots saved before the quick answers existed read as unanswered.
    const constraints = parseConstraints(value.constraints) ?? {};
    return answers && ratings ? { answers, constraints, ratings, savedAt: typeof value.savedAt === 'string' ? value.savedAt : null } : null;
  } catch { return null; }
}

/** The researcher's latest answers to the five questions, quick answers and path ratings. */
export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const result = await auth.access.supabase.from('documents').select('content').eq('project_id', auth.projectId).eq('type', IDEA_SELECTION_TYPE)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw result.error;
    const saved = result.data ? readSelection(result.data.content) : null;
    return NextResponse.json(saved ?? { answers: {}, constraints: {}, ratings: [], savedAt: null }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر استرجاع إجاباتك. أعد المحاولة.' }, { status: 503, headers }); }
}

/** Saves an immutable snapshot; an identical retry maps to the same server-owned ID. */
export async function PUT(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const answers = parseAnswers(body?.answers), ratings = parseRatings(body?.ratings), constraints = parseConstraints(body?.constraints);
    if (!answers || !ratings || !constraints) return NextResponse.json({ error: 'الإجابات حتى 1000 حرف، والتقييم من 1 إلى 5 لكل مسار، والإجابات السريعة من الخيارات المعروضة.' }, { status: 400, headers });
    const savedAt = new Date().toISOString();
    const hash = createHash('sha256').update(JSON.stringify([IDEA_SELECTION_TYPE, auth.projectId, answers, constraints, ratings])).digest('hex');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const saved = await createServiceClient().from('documents').insert({ id, project_id: auth.projectId, type: IDEA_SELECTION_TYPE, content: JSON.stringify({ answers, constraints, ratings, savedAt }), version: 1 });
    if (saved.error && saved.error.code !== '23505') throw saved.error;
    return NextResponse.json({ saved: true, savedAt }, { headers });
  } catch { return NextResponse.json({ error: 'تعذر حفظ إجاباتك. ما كتبته باقٍ في الصفحة؛ أعد المحاولة.' }, { status: 503, headers }); }
}
