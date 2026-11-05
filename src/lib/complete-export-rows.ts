type ExportPage<T> = { data: T[] | null; error: unknown; count: number | null };

/** Read every owned row. A service page size is never a project item limit. */
export async function readCompleteExportRows<T extends { id: string }>(readPage: (from: number, to: number) => PromiseLike<ExportPage<T>>): Promise<T[]> {
  const rows: T[] = []; const seen = new Set<string>();
  let expected: number | null = null;
  for (;;) {
    const page = await readPage(rows.length, rows.length + 199);
    if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || Number(page.count) < 0) throw new Error('Project export data unavailable');
    if (expected !== null && page.count !== expected) throw new Error('Project changed during export; retry');
    expected = page.count as number;
    for (const row of page.data) {
      if (typeof row.id !== 'string' || !row.id || seen.has(row.id)) throw new Error('Project export pagination is inconsistent');
      seen.add(row.id); rows.push(row);
    }
    if (rows.length === expected) return rows;
    // Advance by the actual page length, including when the provider's page
    // ceiling is smaller than requested. Never return a partial attachment.
    if (!page.data.length || rows.length > expected) throw new Error('Project export data is incomplete');
  }
}
