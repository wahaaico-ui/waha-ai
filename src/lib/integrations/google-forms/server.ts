import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStoredQuestionnaire } from '@/lib/integrations/google-forms/client';
import { stageComplete } from '@/lib/research-workflow';

export async function readApprovedQuestionnaire(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('documents')
    .select('content, version')
    .eq('project_id', projectId)
    .eq('type', 'journey:instrument')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const questionnaire = parseStoredQuestionnaire(data?.content ?? null);
  if (!questionnaire || !stageComplete('instrument', questionnaire as unknown as Record<string, unknown>)) return null;
  return questionnaire;
}
