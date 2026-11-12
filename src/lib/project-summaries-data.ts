/** Server side: the saved stage outputs and journal template both summaries are built from. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { JOURNAL_TEMPLATE_TYPE, parseJournalTemplate } from '@/lib/journal-template';
import { journeyOutputs } from '@/lib/journey-outputs';
import { decisionSummary, journalSummary } from '@/lib/project-summaries';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';

const STAGES = ['journey:title', 'journey:problem', 'journey:results', 'journey:conclusions', 'journey:recommendations', 'journey:publication'];

export async function loadProjectSummaries(db: SupabaseClient, projectId: string) {
  const [stages, template] = await Promise.all([
    db.from('documents').select('id, project_id, type, content, version, created_at').eq('project_id', projectId).in('type', STAGES)
      .order('version', { ascending: false }).order('created_at', { ascending: false }),
    db.from('documents').select('content').eq('project_id', projectId).eq('type', JOURNAL_TEMPLATE_TYPE)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (stages.error) throw stages.error;
  if (template.error) throw template.error;
  const outputs = journeyOutputs((stages.data || []) as JourneyDocumentSnapshot[]);
  let saved: unknown = template.data?.content ?? null;
  if (typeof saved === 'string') { try { saved = JSON.parse(saved); } catch { saved = null; } }
  return { journal: journalSummary(outputs, parseJournalTemplate(saved)), decision: decisionSummary(outputs) };
}
