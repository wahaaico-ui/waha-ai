import { listZoteroCollections, listZoteroItems } from '@/lib/integrations/zotero/client';

const originalFetch = global.fetch;
const providerFetch = jest.fn();

function item(index: number) {
  const key = index.toString(36).toUpperCase().padStart(8, '0');
  return { key, version: 9, data: { key, itemType: 'journalArticle', title: `دراسة ${index} 🙂`, creators: [], date: '2024' } };
}

function collection(index: number) {
  const key = index.toString(36).toUpperCase().padStart(8, '0');
  return { key, version: 9, data: { key, name: `مجموعة ${index}`, parentCollection: false } };
}

function response(rows: unknown, total: number, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(rows), {
    status,
    headers: { 'Content-Type': 'application/json', 'Total-Results': String(total), 'Last-Modified-Version': '9', ...headers },
  });
}

function servePages(rows: unknown[], pageCap = 100) {
  const starts: number[] = [];
  providerFetch.mockImplementation(async (input: string | URL | Request, options: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe('https://api.zotero.org');
    expect(url.pathname.startsWith('/users/12345/')).toBe(true);
    expect(url.searchParams.get('limit')).toBe('100');
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer fixture-zotero-private-key');
    expect(new Headers(options.headers).get('Zotero-API-Version')).toBe('3');
    expect(options.cache).toBe('no-store');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const start = Number(url.searchParams.get('start') || 0);
    starts.push(start);
    return response(rows.slice(start, start + pageCap), rows.length);
  });
  return starts;
}

beforeEach(() => { providerFetch.mockReset(); global.fetch = providerFetch as typeof fetch; });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

describe('complete Zotero provider pagination with an explicit synthetic fetch transport', () => {
  test.each([0, 50, 100, 101, 250, 1051])('returns all %i provider items without a reference limit', async (count) => {
    const rows = Array.from({ length: count }, (_, index) => item(index));
    const starts = servePages(rows);
    expect(await listZoteroItems('12345', 'fixture-zotero-private-key')).toEqual(rows);
    expect(starts).toEqual(Array.from({ length: Math.max(1, Math.ceil(count / 100)) }, (_, index) => index * 100));
  });

  test('advances by the number actually returned when the provider caps pages at seven', async () => {
    const rows = Array.from({ length: 50 }, (_, index) => item(index));
    const starts = servePages(rows, 7);
    expect(await listZoteroItems('12345', 'fixture-zotero-private-key')).toEqual(rows);
    expect(starts).toEqual([0, 7, 14, 21, 28, 35, 42, 49]);
  });

  test('reads more than 100 collections using the same stable pagination contract', async () => {
    const rows = Array.from({ length: 205 }, (_, index) => collection(index));
    const starts = servePages(rows);
    expect(await listZoteroCollections('12345', 'fixture-zotero-private-key')).toEqual(rows);
    expect(starts).toEqual([0, 100, 200]);
    expect(new URL(String(providerFetch.mock.calls[0][0])).pathname).toBe('/users/12345/collections');
  });

  test('keeps collection paths and authorization on the fixed provider host', async () => {
    servePages([item(0)]);
    await listZoteroItems('12345', 'fixture-zotero-private-key', 'ABCD1234');
    expect(new URL(String(providerFetch.mock.calls[0][0])).pathname).toBe('/users/12345/collections/ABCD1234/items/top');
  });

  test.each(['../123', 'https://evil.test', '123?secret=x', '', 'abc'])('rejects invalid provider library identifier %j before any request', async (userId) => {
    await expect(listZoteroItems(userId, 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  test.each(['../items', 'abcd1234', 'A123', 'ABCD1234?token=x'])('rejects invalid collection key %j before any request', async (key) => {
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key', key)).rejects.toMatchObject({ name: 'ZoteroReadError' });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  test.each(['Total-Results', 'Last-Modified-Version'])('refuses a page without required %s metadata', async (missing) => {
    const page = response([item(0)], 1); page.headers.delete(missing); providerFetch.mockResolvedValue(page);
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
  });

  test.each([
    ['Total-Results', '-1'], ['Total-Results', '1.5'], ['Total-Results', 'NaN'],
    ['Last-Modified-Version', '-1'], ['Last-Modified-Version', 'private-error-details'],
  ])('rejects invalid %s value %j', async (name, value) => {
    providerFetch.mockResolvedValue(response([item(0)], 1, { [name]: value }));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
  });

  test.each([
    ['total', { 'Total-Results': '102' }], ['library version', { 'Last-Modified-Version': '10' }],
  ])('discards an unfinished read if the %s changes on a later page', async (_name, headers) => {
    providerFetch.mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, index) => item(index)), 101));
    providerFetch.mockResolvedValueOnce(response([item(100)], 101, headers));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  test('rejects a repeated item key rather than apparently completing the library', async () => {
    providerFetch.mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, index) => item(index)), 101));
    providerFetch.mockResolvedValueOnce(response([item(0)], 101));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
  });

  test.each([
    ['object response', { data: [item(0)] }], ['null row', [null]],
    ['mismatched data key', [{ ...item(0), data: { ...item(0).data, key: 'ABCD1234' } }]],
    ['missing item type', [{ ...item(0), data: { key: item(0).key } }]],
    ['invalid item version', [{ ...item(0), version: '9' }]],
  ])('rejects malformed provider content: %s', async (_name, rows) => {
    providerFetch.mockResolvedValue(response(rows, 1));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
  });

  test('rejects an unexpected empty page and a page exceeding the advertised total', async () => {
    providerFetch.mockResolvedValueOnce(response([], 1));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
    providerFetch.mockResolvedValueOnce(response([item(0), item(1)], 1));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError' });
  });

  test('a later provider failure exposes no partial result or private provider response', async () => {
    providerFetch.mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, index) => item(index)), 101));
    providerFetch.mockResolvedValueOnce(new Response('fixture-private-provider-response', { status: 500 }));
    const error = await listZoteroItems('12345', 'fixture-zotero-private-key').catch((value: unknown) => value);
    expect(error).toMatchObject({ name: 'ZoteroReadError' });
    expect(String(error)).not.toContain('fixture-private-provider-response');
    expect(String(error)).not.toContain('fixture-zotero-private-key');
  });

  test.each([429, 503])('returns a retryable %i provider error with safe Retry-After', async (status) => {
    providerFetch.mockResolvedValue(new Response('private-body', { status, headers: { 'Retry-After': '17' } }));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError', status, retryAfter: 17 });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  test('honors Backoff on a nonfinal successful page without saving a partial library or issuing another request', async () => {
    providerFetch.mockResolvedValue(response(Array.from({ length: 100 }, (_, index) => item(index)), 101, { Backoff: '19' }));
    await expect(listZoteroItems('12345', 'fixture-zotero-private-key')).rejects.toMatchObject({ name: 'ZoteroReadError', status: 429, retryAfter: 19 });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  test('aborts a stalled page within the configured per-request deadline', async () => {
    jest.useFakeTimers();
    providerFetch.mockImplementation((_input: unknown, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    const result = listZoteroItems('12345', 'fixture-zotero-private-key').catch((value: unknown) => value);
    await jest.advanceTimersByTimeAsync(15_001);
    expect(await result).toMatchObject({ name: 'ZoteroReadError' });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  test('cleans up timeout handles after a complete successful read', async () => {
    jest.useFakeTimers(); servePages([item(0)]);
    await listZoteroItems('12345', 'fixture-zotero-private-key');
    expect(jest.getTimerCount()).toBe(0);
  });
});
