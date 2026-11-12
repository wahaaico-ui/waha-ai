import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFENSE_PLAN_TYPE, parseDefensePlan, type SavedDefensePlan } from '@/lib/defense-plan';

/** The latest saved defense plan of a project, read with whichever client the caller is allowed to use. */
export async function readDefensePlan(db: Pick<SupabaseClient, 'from'>, projectId: string): Promise<SavedDefensePlan | null> {
  const result = await db.from('documents').select('content').eq('project_id', projectId).eq('type', DEFENSE_PLAN_TYPE)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  try { return result.data ? parseDefensePlan(JSON.parse(String(result.data.content))) : null; } catch { return null; }
}
