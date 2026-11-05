import { renderToStaticMarkup } from 'react-dom/server';
import { readZoteroPanelCollections, readZoteroPanelImportCount, readZoteroPanelStatus, requestZoteroPanelJson, withZoteroDeadline, ZoteroImportPanelView, ZoteroPanelRequestError } from './ZoteroImportPanel';
import { translateUiText } from '@/lib/i18n/ui-text';

const ui = (key: string, values?: readonly unknown[]) => key.replace(/\{(\d+)\}/g, (_, index: string) => String(values?.[Number(index)]));
const view = (overrides: Partial<Parameters<typeof ZoteroImportPanelView>[0]> = {}) => renderToStaticMarkup(<ZoteroImportPanelView
  ui={ui} id="zotero-test" status={{ entitled: true, configured: true, integration: { status: 'connected' } }} statusLoading={false}
  collections={[]} collectionsLoaded collectionKey="" loadingCollections={false} importing={false} refreshing={false} needsRefresh={false}
  cooldown={false} notice={null} onStatusRetry={() => undefined} onCollections={() => undefined} onSelect={() => undefined}
  onImport={() => undefined} onRefresh={() => undefined} {...overrides} />);

beforeEach(() => jest.useRealTimers());
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('a connected library with no collections exposes a complete-library import and an accessible source label', () => {
  const html = view();
  expect(html).toContain('لا توجد مجموعات في مكتبتك');
  expect(html).toContain('value="" selected="">المكتبة كاملة');
  expect(html).toMatch(/<button[^>]*>[^]*?استيراد إلى هذا المشروع<\/button>/);
  expect(html).toContain('for="zotero-test-source"');
  expect(html).toContain('id="zotero-test-source"');
  expect(html).not.toContain('أول 100');
  expect(html).not.toMatch(/<select[^>]* disabled=""/);
  expect(html).toContain('min-h-11');
});

test.each(['ar', 'en'] as const)('all empty-library labels and recovery instructions are translated in %s', language => {
  const html = view({ ui: (key, values) => translateUiText(key, language, values), needsRefresh: true,
    notice: { key: 'تعذر تأكيد نتيجة الاستيراد. حدّث مكتبة المشروع للتحقق مما تم حفظه قبل إعادة المحاولة.', tone: 'error' } });
  expect(html).toContain(language === 'ar' ? 'المكتبة كاملة' : 'Entire library');
  expect(html).toContain(language === 'ar' ? 'تحديث مكتبة المشروع' : 'Refresh project library');
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});

test.each([{ importing: true }, { refreshing: true }, { needsRefresh: true }, { cooldown: true }])('selection and import stay disabled while an operation or recovery barrier is active (%j)', state => {
  const html = view(state);
  expect(html).toMatch(/<select[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(?:<[^>]*>[^]*?<\/svg>)?[^]*?استيراد|<button[^>]*disabled=""[^>]*>[^]*?جاري الاستيراد/);
});

test('status failures offer a retry rather than an endless spinner; unavailable configuration directs to settings', () => {
  const html = view({ status: null, statusLoading: false, notice: { key: 'تعذر التحقق من اتصال Zotero. أعد المحاولة.', tone: 'error' } });
  expect(html).toContain('إعادة التحقق من الاتصال');
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('<select');
  const unavailable = view({ status: { entitled: true, configured: false, integration: { status: 'connected' } } });
  expect(unavailable).toContain('href="/settings/integrations"');
  expect(unavailable).not.toContain('<select');
});

test('unentitled access provides truthful plan information rather than claiming an available paid upgrade', () => {
  const html = view({ status: { entitled: false, configured: true, integration: null } });
  expect(html).toContain('عرض الخطط المتاحة');
  expect(html).not.toContain('الترقية');
});

test('unknown import offers library refresh and a confirmed import with failed refresh stays informational', () => {
  const html = view({ needsRefresh: true, notice: { key: 'تعذر تأكيد نتيجة الاستيراد. حدّث مكتبة المشروع للتحقق مما تم حفظه قبل إعادة المحاولة.', tone: 'error' } });
  expect(html).toContain('تحديث مكتبة المشروع');
  expect(html).toContain('قبل إعادة المحاولة');
  const confirmed = view({ needsRefresh: true, notice: { key: 'تمت المزامنة، لكن تعذر تحديث عرض مكتبة المشروع. حدّث المكتبة لعرض المراجع المحفوظة.', tone: 'info' } });
  expect(confirmed).toContain('role="status"');
  expect(confirmed).not.toContain('role="alert"');
  expect(confirmed).not.toContain('إعادة الاستيراد');
});

test.each([0, 50, 100, 101, 1051])('only exact explicitly complete success is accepted, including %i references', count => {
  expect(readZoteroPanelImportCount({ complete: true, imported: count, total: count })).toBe(count);
});

test.each([
  null, [], {}, { imported: 100, total: 100 }, { complete: false, imported: 100, total: 100 },
  { complete: true, imported: 100, total: 101 }, { complete: true, imported: -1, total: -1 },
  { complete: true, imported: '101', total: '101' }, { complete: true, imported: 0.5, total: 0.5 },
  { complete: true, imported: Number.MAX_SAFE_INTEGER + 1, total: Number.MAX_SAFE_INTEGER + 1 },
])('a malformed or partial success never receives a confirmation (%j)', value => {
  expect(() => readZoteroPanelImportCount(value)).toThrow(ZoteroPanelRequestError);
});

test('status and collection payloads require their complete contract and do not silently drop malformed records', () => {
  expect(readZoteroPanelStatus({ entitled: true, configured: true, integration: null })).toEqual({ entitled: true, configured: true, integration: null });
  expect(() => readZoteroPanelStatus({ entitled: true, integration: null })).toThrow();
  expect(() => readZoteroPanelStatus({ entitled: true, configured: true, integration: [] })).toThrow();
  expect(readZoteroPanelCollections({ collections: [] })).toEqual([]);
  const collection = { key: 'ABCD1234', name: 'دراسات <script>private</script>', parentCollection: null };
  expect(readZoteroPanelCollections({ collections: [collection] })).toEqual([collection]);
  expect(() => readZoteroPanelCollections({ collections: [collection, collection] })).toThrow();
  expect(() => readZoteroPanelCollections({ collections: [{ ...collection, key: 'bad/key' }] })).toThrow();
  expect(() => readZoteroPanelCollections({ collections: [{ ...collection, parentCollection: false }] })).toThrow();
  expect(() => readZoteroPanelCollections({ collections: [{ ...collection, name: ' ' }] })).toThrow();
  const html = view({ collections: [collection] });
  expect(html).toContain('&lt;script&gt;private&lt;/script&gt;');
  expect(html).not.toContain('<script>');
});

test('requests use same-origin routes, send only the supplied mutation body and never automatically repeat a POST', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ complete: true, imported: 101, total: 101 }));
  const signal = new AbortController().signal;
  const body = { projectId: 'owned-project', collectionKey: 'ABCD1234' };
  expect(readZoteroPanelImportCount(await requestZoteroPanelJson('/api/integrations/zotero/import', signal, 240_000, body))).toBe(101);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/integrations/zotero/import', expect.objectContaining({ method: 'POST', cache: 'no-store', body: JSON.stringify(body), signal: expect.any(AbortSignal) }));
});

test('HTTP errors expose only status and safe retry metadata; private error bodies are never read', async () => {
  const json = jest.fn().mockRejectedValue(new Error('private provider key'));
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '60' }), json } as unknown as Response);
  try {
    await requestZoteroPanelJson('/api/integrations/zotero/import', new AbortController().signal, 240_000, {});
    throw new Error('Expected request rejection');
  } catch (error) {
    expect(error).toMatchObject({ kind: 'http', status: 429, retryAfter: 60 });
    expect(String(error)).not.toContain('private provider key');
  }
  expect(json).not.toHaveBeenCalled();
});

test('invalid success JSON and network failure are distinct from a confirmed import', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json', { status: 200 }));
  await expect(requestZoteroPanelJson('/api/integrations/zotero/import', new AbortController().signal, 240_000, {})).rejects.toMatchObject({ kind: 'response' });
  fetchMock.mockRejectedValue(new Error('private network details'));
  await expect(requestZoteroPanelJson('/api/integrations/zotero/import', new AbortController().signal, 240_000, {})).rejects.toMatchObject({ kind: 'network' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([20_000, 240_000])('the %i ms deadline includes a stalled JSON body and aborts the fetch signal', async timeout => {
  jest.useFakeTimers();
  let requestSignal: AbortSignal | undefined;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (_path, init) => {
    requestSignal = init?.signal ?? undefined;
    return { ok: true, json: () => new Promise(() => undefined) } as unknown as Response;
  });
  const promise = requestZoteroPanelJson('/api/integrations/zotero/import', new AbortController().signal, timeout, {});
  const outcome = expect(promise).rejects.toMatchObject({ kind: 'timeout' });
  await jest.advanceTimersByTimeAsync(timeout);
  await outcome;
  expect(requestSignal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('project/unmount cancellation immediately releases a pending operation and clears its deadline', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  const promise = withZoteroDeadline(() => new Promise(() => undefined), controller.signal, 240_000);
  const outcome = expect(promise).rejects.toMatchObject({ kind: 'aborted' });
  controller.abort();
  await outcome;
  expect(jest.getTimerCount()).toBe(0);
});

test('a completed request and a rejected library-refresh callback always release their deadline', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  await expect(withZoteroDeadline(async () => 'complete', controller.signal, 20_000)).resolves.toBe('complete');
  await expect(withZoteroDeadline(async () => { throw new Error('refresh failed'); }, controller.signal, 20_000)).rejects.toThrow('refresh failed');
  expect(jest.getTimerCount()).toBe(0);
});
