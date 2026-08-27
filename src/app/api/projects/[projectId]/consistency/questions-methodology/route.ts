import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import {
  createResearchObjectView,
  evaluateQuestionsMethodologyConsistency,
  type JourneyDocumentSnapshot,
} from '@/lib/research-objects';

const REQUIRED_DOCUMENT_TYPES = ['journey:questions', 'journey:methodology'];
const PRIVATE_RESPONSE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0' };

async function readConsistencyInputs(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, project_id, type, content, version, created_at')
    .eq('project_id', projectId)
    .in('type', REQUIRED_DOCUMENT_TYPES)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as JourneyDocumentSnapshot[];
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_RESPONSE_HEADERS });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return privateJson({ error: 'Unauthorized' }, 401);
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) {
      return privateJson({ error: 'Project not found' }, 404);
    }

    const documents = await readConsistencyInputs(projectId, access.supabase);
    const objectView = createResearchObjectView(projectId, documents);
    const report = evaluateQuestionsMethodologyConsistency(objectView);
    return privateJson({
      projectId,
      report,
      inputWarnings: objectView.warnings,
      evaluatedDocuments: documents.map((document) => ({
        id: document.id,
        type: document.type,
        version: document.version,
        createdAt: document.created_at,
      })),
    });
  } catch {
    return privateJson({ error: 'Unable to evaluate project consistency' }, 500);
  }
}
