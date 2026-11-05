// In-memory tables for route tests that mock the Supabase clients. Supports the
// query shapes the research routes use: select().eq()/in()/order()/limit() with
// maybeSingle()/single()/await, insert().select().single(), update().eq()
// .select().single(), and delete().eq(). Every write is logged with the client
// that made it, so tests can prove the browser session never writes.
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
export type WriteLog = Array<{ client: string; table: string; kind: 'insert' | 'update' | 'delete'; row: Row }>;

export function createTableFake(options: { strictQuery?: boolean; serverRowLimit?: number } = {}) {
  const tables = new Map<string, Row[]>();
  const writes: WriteLog = [];
  const rowsOf = (table: string) => { if (!tables.has(table)) tables.set(table, []); return tables.get(table) as Row[]; };
  /** Optional per-table check run on insert/update, returning an error code to simulate a constraint. */
  const constraints = new Map<string, (row: Row, kind: 'insert' | 'update' | 'delete') => string | null>();

  function client(name: string) {
    return {
      // Contract substitute only. Real transaction locking and role privileges
      // are covered separately by the disposable PostgreSQL tests.
      async rpc(procedure: string, args: Row) {
        if (name !== 'service' || procedure !== 'commit_evidence_writing') return { data: null, error: { code: '42501' } };
        const rows = rowsOf('documents');
        const latest = rows.filter(row => row.project_id === args.p_project_id && row.type === 'evidence-writing:v1')
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)))[0];
        const existing = rows.find(row => row.id === args.p_document_id);
        if (existing && existing.content !== args.p_content) return { data: null, error: { code: '22023' } };
        if (existing) return { data: { outcome: latest?.id === existing.id ? 'saved' : 'conflict', saved: true, documentId: existing.id }, error: null };
        if ((latest?.id ?? null) !== args.p_base_document_id) return { data: { outcome: 'conflict' }, error: null };
        const row = { id: args.p_document_id, project_id: args.p_project_id, type: 'evidence-writing:v1', content: args.p_content, version: 1, created_at: new Date(Math.max(Date.now(), latest ? Date.parse(String(latest.created_at)) + 1 : 0)).toISOString() };
        const failure = constraints.get('documents')?.(row, 'insert');
        if (failure) return { data: null, error: { code: failure } };
        rows.push(row); writes.push({ client: name, table: 'documents', kind: 'insert', row: { ...row } });
        return { data: { outcome: 'saved', documentId: row.id }, error: null };
      },
      from(table: string) {
        const filters: Array<(row: Row) => boolean> = [];
        let mode: 'select' | 'update' | 'delete' = 'select';
        let patch: Row = {};
        const ordering: Array<{ column: string; ascending: boolean }> = [];
        let offset = 0, last = Infinity;
        const run = () => {
          const rows = rowsOf(table);
          const matched = rows.filter((row) => filters.every((filter) => filter(row)));
          if (mode === 'update') {
            for (const row of matched) {
              const check = constraints.get(table)?.({ ...row, ...patch }, 'update');
              if (check) return { data: null, error: { code: check } };
            }
            for (const row of matched) { Object.assign(row, patch); writes.push({ client: name, table, kind: 'update', row: { ...patch, id: row.id } }); }
          }
          if (mode === 'delete') {
            for (const row of matched) {
              const check = constraints.get(table)?.(row, 'delete');
              if (check) return { data: null, error: { code: check } };
            }
            for (const row of matched) { rows.splice(rows.indexOf(row), 1); writes.push({ client: name, table, kind: 'delete', row: { id: row.id } }); }
          }
          let selected = matched;
          if (options.strictQuery) {
            selected = [...matched].sort((a, b) => {
              for (const order of ordering) {
                const left = a[order.column], right = b[order.column];
                const comparison = typeof left === 'number' && typeof right === 'number'
                  ? left - right : String(left ?? '').localeCompare(String(right ?? ''));
                if (comparison) return order.ascending ? comparison : -comparison;
              }
              return 0;
            }).slice(offset, Math.min(last + 1, offset + (options.serverRowLimit ?? Infinity)));
          }
          return { data: selected.map((row) => ({ ...row })), error: null, count: matched.length };
        };
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return query; },
          is: (column: string, value: null | boolean) => { filters.push((row) => row[column] === value); return query; },
          like: (column: string, pattern: string) => {
            const expression = new RegExp(`^${pattern.split(/([%_])/).map(part => part === '%' ? '.*' : part === '_' ? '.' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}$`, 's');
            filters.push(row => typeof row[column] === 'string' && expression.test(row[column] as string)); return query;
          },
          in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return query; },
          order: (column: string, settings?: { ascending?: boolean }) => { ordering.push({ column, ascending: settings?.ascending !== false }); return query; },
          limit: (count: number) => { last = count - 1; return query; },
          range: (first: number, end: number) => { offset = first; last = end; return query; },
          maybeSingle: async () => { const result = run(); return result.error ? result : { data: (result.data as Row[])[0] || null, error: null }; },
          single: async () => { const result = run(); return result.error ? result : { data: (result.data as Row[])[0] || null, error: (result.data as Row[])[0] ? null : { code: 'PGRST116' } }; },
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
          update: (values: Row) => { mode = 'update'; patch = values; return query; },
          delete: () => { mode = 'delete'; return query; },
          insert: (input: Row | Row[]) => {
            const inserted: Row[] = [];
            for (const value of Array.isArray(input) ? input : [input]) {
              const row = { id: randomUUID(), created_at: new Date().toISOString(), ...value };
              const check = constraints.get(table)?.(row, 'insert');
              if (check) {
                const failed = { data: null, error: { code: check } };
                return { select: () => ({ single: async () => failed, then: (resolve: (value: unknown) => unknown) => Promise.resolve(failed).then(resolve) }), then: (resolve: (value: unknown) => unknown) => Promise.resolve(failed).then(resolve) };
              }
              rowsOf(table).push(row); inserted.push(row); writes.push({ client: name, table, kind: 'insert', row: { ...row } });
            }
            const result = { data: inserted.map((row) => ({ ...row })), error: null };
            return {
              select: () => ({ single: async () => ({ data: { ...inserted[0] }, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }),
              then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
            };
          },
        };
        return query;
      },
    };
  }

  return {
    tables, writes, constraints,
    rows: rowsOf,
    seed(table: string, row: Row) { const stored = { id: randomUUID(), created_at: new Date().toISOString(), ...row }; rowsOf(table).push(stored); return stored; },
    session: client('session'),
    service: client('service'),
    reset() { tables.clear(); writes.length = 0; constraints.clear(); },
  };
}
