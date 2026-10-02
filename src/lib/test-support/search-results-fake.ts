// In-memory stand-in for the research_search_results table, for tests that mock
// createServiceClient. Supports the queries src/lib/research-search-results.ts
// issues: insert().select(), delete().eq().lt(), select().in().eq().gt().
import { randomUUID } from 'node:crypto';

export type FakeResultRow = {
  id: string;
  search_run_id: string;
  user_id: string;
  project_id: string;
  context: string;
  query: string;
  position: number;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string;
};

type Filter = (row: FakeResultRow) => boolean;

export function createSearchResultsFake() {
  const rows: FakeResultRow[] = [];

  function query(mode: 'select' | 'delete', columns?: string) {
    const filters: Filter[] = [];
    const project = (row: FakeResultRow) => columns ? Object.fromEntries(columns.split(',').map((column) => column.trim()).map((column) => [column, row[column as keyof FakeResultRow]])) : row;
    const run = () => {
      const matched = rows.filter((row) => filters.every((filter) => filter(row)));
      if (mode === 'delete') {
        for (const row of matched) rows.splice(rows.indexOf(row), 1);
        return { data: null, error: null };
      }
      return { data: matched.map(project), error: null };
    };
    const chain = {
      eq: (column: keyof FakeResultRow, value: unknown) => { filters.push((row) => row[column] === value); return chain; },
      in: (column: keyof FakeResultRow, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return chain; },
      lt: (column: keyof FakeResultRow, value: string) => { filters.push((row) => String(row[column]) < value); return chain; },
      gt: (column: keyof FakeResultRow, value: string) => { filters.push((row) => String(row[column]) > value); return chain; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return chain;
  }

  const table = {
    insert: (input: Array<Omit<FakeResultRow, 'id' | 'created_at' | 'expires_at'>>) => {
      const now = Date.now();
      const inserted = input.map((row) => ({ ...row, id: randomUUID(), created_at: new Date(now).toISOString(), expires_at: new Date(now + 24 * 3_600_000).toISOString() }));
      rows.push(...inserted);
      return { select: (columns: string) => Promise.resolve({ data: inserted.map((row) => Object.fromEntries(columns.split(',').map((column) => column.trim()).map((column) => [column, row[column as keyof FakeResultRow]]))), error: null }) };
    },
    select: (columns: string) => query('select', columns),
    delete: () => query('delete'),
  };

  return {
    rows,
    client: { from: (name: string) => { if (name !== 'research_search_results') throw new Error(`unexpected table ${name}`); return table; } },
    /** Adds a stored result directly, as a search would have. */
    seed(row: Partial<FakeResultRow> & Pick<FakeResultRow, 'user_id' | 'project_id' | 'metadata'>) {
      const now = Date.now();
      const stored: FakeResultRow = { id: randomUUID(), search_run_id: randomUUID(), context: 'literature', query: 'seeded query', position: rows.length, created_at: new Date(now).toISOString(), expires_at: new Date(now + 24 * 3_600_000).toISOString(), ...row };
      rows.push(stored);
      return stored;
    },
  };
}

export function discoveredMetadata(overrides: Record<string, unknown> = {}) {
  return {
    id: '10.1371/journal.pone.0298037', doi: '10.1371/journal.pone.0298037', title: 'Server-held study title', authors: ['Server Author'], year: 2024,
    journal: 'PLOS ONE', publisher: 'PLOS', volume: null, issue: null, pages: null, url: 'https://doi.org/10.1371/journal.pone.0298037', pdfUrl: null,
    abstract: 'Server-held abstract.', citationCount: 3, publicationType: 'article', providers: ['openalex', 'crossref'], ...overrides,
  };
}
