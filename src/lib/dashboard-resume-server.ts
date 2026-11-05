import type { SupabaseClient } from '@supabase/supabase-js';
import { DASHBOARD_DOCUMENT_TYPES, latestDashboardDocuments, type DashboardJourneyDocument, type DashboardStageDraft } from '@/lib/dashboard-resume';

/** Read every authorized page; a PostgREST row cap must not silently discard a
 * project or its last save. Offset advances by the actual returned row count. */
export async function readDashboardPages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 200): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const result = await query(rows.length, rows.length + pageSize - 1);
    if (result.error) throw new Error('dashboard_read_failed');
    if (!result.data?.length) return rows;
    rows.push(...result.data);
  }
}

export async function readDashboardWork(db: SupabaseClient, projectIds: string[]) {
  const documents: DashboardJourneyDocument[] = [];
  const drafts: DashboardStageDraft[] = [];
  for (let start = 0; start < projectIds.length; start += 50) {
    const batch = projectIds.slice(start, start + 50);
    // Retrieve small metadata first, then only the canonical revision payloads.
    // Never read every historical 120,000-character manuscript into a dashboard.
    const metadata = await readDashboardPages<Omit<DashboardJourneyDocument, 'content'>>((from, to) => db.from('documents')
      .select('id, project_id, type, version, created_at').in('project_id', batch).in('type', DASHBOARD_DOCUMENT_TYPES)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to));
    const latest = latestDashboardDocuments(metadata);
    for (let offset = 0; offset < latest.length; offset += 20) {
      const ids = latest.slice(offset, offset + 20).map(row => row.id!);
      const page = await readDashboardPages<DashboardJourneyDocument>((from, to) => db.from('documents')
        .select('id, project_id, type, content, version, created_at').in('project_id', batch).in('id', ids)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to), 20);
      if (page.length !== ids.length) throw new Error('dashboard_changed_during_read');
      documents.push(...page);
    }
    drafts.push(...await readDashboardPages<DashboardStageDraft>((from, to) => db.from('research_stage_drafts')
      .select('project_id, stage, content, updated_at').in('project_id', batch)
      .order('project_id').order('stage').range(from, to), 20));
  }
  return { documents, drafts };
}
