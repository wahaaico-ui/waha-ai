import type { SupabaseClient } from '@supabase/supabase-js';
import { readCompleteExportRows } from '@/lib/complete-export-rows';

type Row = Record<string, unknown>;
export type ArchiveCollection = { table: string; columns: string; keys?: readonly string[]; userColumn?: string };

/** Explicit projection keeps pagination-only keys and credentials out of JSON.
 * Every page repeats its owner/project predicate on the privileged client. */
export async function readAccountArchiveRows(service: SupabaseClient, collection: ArchiveCollection, userId: string, projectIds?: readonly string[]) {
  if (!userId || (!collection.userColumn && !projectIds)) throw new Error('ACCOUNT_EXPORT_SCOPE_REQUIRED');
  if (projectIds?.length === 0) return [];
  const columns = collection.columns.split(',').map(column => column.trim());
  const keys = collection.keys ?? ['id'];
  const selected = [...new Set([...columns, ...keys])].join(', ');
  const pages = await readCompleteExportRows(async (from, to) => {
    let query = service.from(collection.table).select(selected, { count: 'exact' });
    if (collection.userColumn) query = query.eq(collection.userColumn, userId);
    if (projectIds) query = query.in('project_id', [...projectIds]);
    // Primary/unique keys avoid unstable offsets when timestamps are equal.
    for (const key of keys) query = query.order(key, { ascending: true });
    const { data, error, count } = await query.range(from, to);
    return {
      error, count,
      data: Array.isArray(data) ? data.map(value => {
        const raw: unknown = value;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('ACCOUNT_EXPORT_INVALID_ROW');
        const row = raw as Row;
        const identity = keys.map(key => row[key]);
        return {
          id: identity.every(value => typeof value === 'string' && value.length > 0) ? JSON.stringify(identity) : '',
          row: Object.fromEntries(columns.filter(column => Object.hasOwn(row, column)).map(column => [column, row[column]])),
        };
      }) : null,
    };
  });
  return pages.map(page => page.row);
}

/** A bounded IN-list is a query batch, not a limit on projects or references. */
export async function readAccountProjectRows(service: SupabaseClient, collection: ArchiveCollection, userId: string, projectIds: readonly string[]) {
  const rows: Row[] = [];
  for (let offset = 0; offset < projectIds.length; offset += 100) {
    rows.push(...await readAccountArchiveRows(service, collection, userId, projectIds.slice(offset, offset + 100)));
  }
  return rows;
}
