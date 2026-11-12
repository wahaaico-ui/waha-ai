import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { loadProjectSummaries } from '@/lib/project-summaries-data';

const headers = { 'Cache-Control': 'private, no-store' };

/** The journal and decision-maker summaries of the owner's project, from its saved outputs (DOC-39-04). */
export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    return NextResponse.json(await loadProjectSummaries(auth.access.supabase, auth.projectId), { headers });
  } catch (error) {
    console.error('Project summaries failed', error);
    return NextResponse.json({ error: 'تعذر إعداد الملخصين الآن. أعد المحاولة.' }, { status: 503, headers });
  }
}
