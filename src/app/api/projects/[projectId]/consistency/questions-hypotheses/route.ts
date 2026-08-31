import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createResearchObjectView, evaluateQuestionsHypothesesConsistency } from '@/lib/research-objects';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await access.supabase.from('documents')
      .select('id, project_id, type, content, version, created_at')
      .eq('project_id', projectId)
      .in('type', ['journey:questions', 'journey:hypotheses'])
      .order('version', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    const documents = (data || []) as JourneyDocumentSnapshot[];
    const hypothesisDocument = documents.find((item) => item.type === 'journey:hypotheses');
    let settings: Record<string, unknown> = {};
    try { settings = typeof hypothesisDocument?.content === 'string' ? JSON.parse(hypothesisDocument.content) : hypothesisDocument?.content || {}; } catch { settings = {}; }
    const view = createResearchObjectView(projectId, documents);
    const report = evaluateQuestionsHypothesesConsistency(view, {
      mode: settings.mode === 'not_applicable' ? 'not_applicable' : 'required',
      rationale: typeof settings.rationale === 'string' ? settings.rationale : '',
    });
    return NextResponse.json({ report, inputWarnings: view.warnings });
  } catch {
    return NextResponse.json({ error: 'Unable to evaluate project consistency' }, { status: 500 });
  }
}
