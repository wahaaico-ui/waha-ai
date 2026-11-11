import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { evaluateConsistencyMap } from '@/lib/research-objects/consistency-map';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';

const MAP_DOCUMENT_TYPES = ['journey:problem', 'journey:objectives', 'journey:questions', 'journey:hypotheses', 'journey:methodology'];
const PRIVATE_RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

/** The whole consistency map of the owner's saved journey stages (DOC-26-01). */
export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_RESPONSE_HEADERS });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: PRIVATE_RESPONSE_HEADERS });

    const { data, error } = await access.supabase.from('documents')
      .select('id, project_id, type, content, version, created_at')
      .eq('project_id', projectId)
      .in('type', MAP_DOCUMENT_TYPES)
      .order('version', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;

    const map = evaluateConsistencyMap(projectId, (data || []) as JourneyDocumentSnapshot[]);
    return NextResponse.json({ map }, { headers: PRIVATE_RESPONSE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'تعذر بناء خريطة الاتساق الآن. أعد المحاولة.' }, { status: 500, headers: PRIVATE_RESPONSE_HEADERS });
  }
}
