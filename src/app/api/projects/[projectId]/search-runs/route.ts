import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';

// Read-only list of the searches recorded for a project (research_search_runs,
// Slice 6), shown as the recorded search scope. Ownership is checked first and
// the read uses the caller's session, so RLS also limits it to the caller's
// own searches. There is no write route: search runs are recorded only by the
// server when a search runs.

const COLUMNS = 'id, context, query, domain, providers, providers_attempted, providers_available, candidate_count, result_count, limitations, executed_at';
const MAX_RUNS = 50;

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const { data, error } = await auth.access.supabase.from('research_search_runs').select(COLUMNS)
      .eq('project_id', auth.projectId).eq('user_id', auth.access.user.id).order('executed_at', { ascending: false }).limit(MAX_RUNS);
    if (error) throw error;
    return NextResponse.json({ success: true, runs: data || [] });
  } catch { return NextResponse.json({ error: 'Unable to load the recorded search scope' }, { status: 500 }); }
}
