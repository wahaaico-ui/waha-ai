import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function PATCH(request: Request) {
  try {
    const { projectId, universityPolicy } = await request.json();
    if (!projectId || !universityPolicy) {
      return NextResponse.json({ error: 'Missing projectId or universityPolicy' }, { status: 400 });
    }

    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { error } = await access.supabase
      .from('projects')
      .update({ university_policy: universityPolicy })
      .eq('id', projectId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update policy' }, { status: 500 });
  }
}
