// In-memory tables for route tests that mock the Supabase clients. Supports the
// query shapes the research routes use: select().eq()/in()/order()/limit() with
// maybeSingle()/single()/await, insert().select().single(), update().eq()
// .select().single(), and delete().eq(). Every write is logged with the client
// that made it, so tests can prove the browser session never writes.
import { randomUUID } from 'node:crypto';

type Row = Record<string, unknown>;
export type WriteLog = Array<{ client: string; table: string; kind: 'insert' | 'update' | 'delete'; row: Row }>;

export function createTableFake() {
  const tables = new Map<string, Row[]>();
  const writes: WriteLog = [];
  const rowsOf = (table: string) => { if (!tables.has(table)) tables.set(table, []); return tables.get(table) as Row[]; };
  /** Optional per-table check run on insert/update, returning an error code to simulate a constraint. */
  const constraints = new Map<string, (row: Row, kind: 'insert' | 'update' | 'delete') => string | null>();

  function client(name: string) {
    return {
      from(table: string) {
        const filters: Array<(row: Row) => boolean> = [];
        let mode: 'select' | 'update' | 'delete' = 'select';
        let patch: Row = {};
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
          return { data: matched.map((row) => ({ ...row })), error: null };
        };
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return query; },
          in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return query; },
          order: () => query,
          limit: () => query,
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
