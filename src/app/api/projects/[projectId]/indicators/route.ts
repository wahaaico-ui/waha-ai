import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { readSavedWriting, WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { readSavedGuide, type SavedGuide } from '@/lib/guide-workflow';
import { IDEA_SELECTION_TYPE, parseConstraints } from '@/lib/idea-selection/questions';
import { JOURNAL_TEMPLATE_TYPE, parseJournalTemplate } from '@/lib/journal-template';
import { journeyOutputs } from '@/lib/journey-outputs';
import { guideIndicator, publicationAbstract, publicationIndicator, timeIndicator } from '@/lib/project-indicators';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';
import { stageComplete, WORKFLOW_STAGES } from '@/lib/research-workflow';

const headers = { 'Cache-Control': 'private, no-store' };
const STAGE_TYPES = new Set(WORKFLOW_STAGES.map(stage => `journey:${stage}`));

function parseJson(content: unknown): Record<string, unknown> | null {
  try {
    const value = typeof content === 'string' ? JSON.parse(content) : content;
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

/** Guide, time and publishability indicators of the owner's project (DOC-38-01). */
export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) return auth.response;
    const db = auth.access.supabase;
    const [project, stages, others, references] = await Promise.all([
      db.from('projects').select('university_policy').eq('id', auth.projectId).maybeSingle(),
      db.from('documents').select('id, project_id, type, content, version, created_at').eq('project_id', auth.projectId).like('type', 'journey:%')
        .order('version', { ascending: false }).order('created_at', { ascending: false }),
      db.from('documents').select('type, content, created_at').eq('project_id', auth.projectId).in('type', [WRITING_DOCUMENT_TYPE, JOURNAL_TEMPLATE_TYPE, IDEA_SELECTION_TYPE])
        .order('created_at', { ascending: false }),
      db.from('project_references').select('id', { count: 'exact', head: true }).eq('project_id', auth.projectId).eq('user_id', auth.access.user.id),
    ]);
    for (const result of [project, stages, others, references]) if (result.error) throw result.error;

    let guide: SavedGuide | null = null;
    let guideUnreadable = false;
    try { guide = readSavedGuide(project.data?.university_policy ?? null); } catch { guideUnreadable = true; }

    const stageDocuments = ((stages.data || []) as JourneyDocumentSnapshot[]).filter(document => STAGE_TYPES.has(String(document.type)));
    const outputs = journeyOutputs(stageDocuments);
    const startedAt = stageDocuments.map(document => document.created_at).filter((time): time is string => Boolean(time)).sort()[0] ?? null;
    const latest = (type: string) => (others.data || []).find(row => row.type === type)?.content;
    const writing = readSavedWriting(latest(WRITING_DOCUMENT_TYPE));
    const template = parseJournalTemplate(parseJson(latest(JOURNAL_TEMPLATE_TYPE)));
    const constraints = parseConstraints(parseJson(latest(IDEA_SELECTION_TYPE))?.constraints) ?? {};

    const indicators = [
      guideIndicator({
        guide, guideUnreadable,
        draft: writing ? { text: writing.text, citationStyle: writing.citationStyle ?? null } : null,
        abstractText: publicationAbstract(outputs),
      }),
      timeIndicator({
        time: constraints.time ?? null,
        completed: WORKFLOW_STAGES.filter(stage => stageComplete(stage, outputs[stage])).length,
        total: WORKFLOW_STAGES.length,
        startedAt,
        now: new Date(),
      }),
      publicationIndicator({ template, outputs, referenceCount: references.count ?? 0 }),
    ];
    return NextResponse.json({ indicators }, { headers });
  } catch {
    return NextResponse.json({ error: 'تعذر حساب مؤشرات المشروع الآن. أعد المحاولة.' }, { status: 503, headers });
  }
}
