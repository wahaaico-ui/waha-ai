import { readCompleteExportRows } from '@/lib/complete-export-rows';

test('adapts to a service ceiling smaller than the requested page without dropping rows', async () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ id: `row-${i}` }));
  const read = jest.fn(async (from: number) => ({ data: items.slice(from, from + 7), error: null, count: items.length }));
  expect(await readCompleteExportRows(read)).toEqual(items);
  expect(read.mock.calls.map(call => call[0])).toEqual([0, 7, 14, 21]);
});
test('returns an empty collection only when the service confirms zero owned rows', async () => {
  expect(await readCompleteExportRows(async () => ({ data: [], error: null, count: 0 }))).toEqual([]);
  await expect(readCompleteExportRows(async () => ({ data: [], error: null, count: null }))).rejects.toThrow('unavailable');
  await expect(readCompleteExportRows(async () => ({ data: [], error: null, count: 4 }))).rejects.toThrow('incomplete');
});
test('fails on later page errors, changed counts or duplicate rows rather than issuing partial content', async () => {
  const first = { data: [{ id: 'a' }], error: null, count: 2 };
  for (const second of [
    { data: null, error: { message: 'private failure' }, count: null },
    { data: [{ id: 'b' }], error: null, count: 3 },
    { data: [{ id: 'a' }], error: null, count: 2 },
    { data: [], error: null, count: 2 },
  ]) {
    const read = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    await expect(readCompleteExportRows(read)).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(2);
  }
});
