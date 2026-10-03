import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { isUuid } from '@/lib/research-evidence';

export type ProjectRouteContext = { params: Promise<{ projectId: string }> };

/** Authenticates the caller and verifies the project is theirs, before any read or write. */
export async function authoriseProject(context: ProjectRouteContext) {
  const { projectId } = await context.params;
  const access = await requireAuthenticatedUser();
  if (!access) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isUuid(projectId) || !(await ownsProject(projectId, access.user.id, access.supabase))) return { ok: false as const, response: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  return { ok: true as const, access, projectId };
}
