'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';

type Collection = { key: string; name: string; parentCollection: string | null };
type Status = { entitled: boolean; configured: boolean; integration: null | { status: string } };
type Notice = { key: string; values?: readonly unknown[]; tone: 'error' | 'success' | 'info' };
type UiText = ReturnType<typeof useUiTranslation>['text'];
type FailureKind = 'aborted' | 'timeout' | 'network' | 'response' | 'http';

export class ZoteroPanelRequestError extends Error {
  constructor(readonly kind: FailureKind, readonly status?: number, readonly retryAfter?: number) {
    super('Zotero request could not be completed');
    this.name = 'ZoteroPanelRequestError';
  }
}

/** A deadline covers both headers and body; cancellation also stops an uncooperative body reader. */
export async function withZoteroDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let rejectAborted: (error: ZoteroPanelRequestError) => void = () => undefined;
  const onAbort = () => {
    controller.abort();
    rejectAborted(new ZoteroPanelRequestError(timedOut ? 'timeout' : 'aborted'));
  };
  const aborted = new Promise<never>((_, reject) => { rejectAborted = reject; });
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; onAbort(); }, timeoutMs);
  try {
    if (signal.aborted) throw new ZoteroPanelRequestError('aborted');
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

function retryDelay(value: string | null) {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined;
}

export async function requestZoteroPanelJson(path: string, signal: AbortSignal, timeoutMs: number, body?: unknown): Promise<unknown> {
  try {
    return await withZoteroDeadline(async requestSignal => {
      const response = await fetch(path, {
        method: body === undefined ? 'GET' : 'POST',
        cache: 'no-store',
        signal: requestSignal,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new ZoteroPanelRequestError('http', response.status, retryDelay(response.headers.get('Retry-After')));
      try { return await response.json() as unknown; }
      catch { throw new ZoteroPanelRequestError('response'); }
    }, signal, timeoutMs);
  } catch (error) {
    if (error instanceof ZoteroPanelRequestError) throw error;
    throw new ZoteroPanelRequestError('network');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readZoteroPanelStatus(value: unknown): Status {
  if (!isRecord(value) || typeof value.entitled !== 'boolean' || typeof value.configured !== 'boolean'
    || !(value.integration === null || (isRecord(value.integration) && typeof value.integration.status === 'string'))) {
    throw new ZoteroPanelRequestError('response');
  }
  return { entitled: value.entitled, configured: value.configured, integration: value.integration as Status['integration'] };
}

export function readZoteroPanelCollections(value: unknown): Collection[] {
  if (!isRecord(value) || !Array.isArray(value.collections)) throw new ZoteroPanelRequestError('response');
  const keys = new Set<string>();
  return value.collections.map((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.key !== 'string' || !/^[A-Z0-9]{8}$/.test(entry.key)
      || typeof entry.name !== 'string' || !entry.name.trim()
      || !(entry.parentCollection === null || (typeof entry.parentCollection === 'string' && /^[A-Z0-9]{8}$/.test(entry.parentCollection)))
      || keys.has(entry.key)) throw new ZoteroPanelRequestError('response');
    keys.add(entry.key);
    return { key: entry.key, name: entry.name, parentCollection: entry.parentCollection as string | null };
  });
}

/** A success toast is allowed only for an explicitly complete, exact result, including zero. */
export function readZoteroPanelImportCount(value: unknown): number {
  if (!isRecord(value) || value.complete !== true || !Number.isSafeInteger(value.imported) || !Number.isSafeInteger(value.total)
    || (value.imported as number) < 0 || value.imported !== value.total) throw new ZoteroPanelRequestError('response');
  return value.imported as number;
}

type ViewProps = {
  ui: UiText; id: string; status: Status | null; statusLoading: boolean; collections: Collection[];
  collectionsLoaded: boolean; collectionKey: string; loadingCollections: boolean; importing: boolean;
  refreshing: boolean; needsRefresh: boolean; cooldown: boolean; notice: Notice | null;
  onStatusRetry: () => void; onCollections: () => void; onSelect: (value: string) => void;
  onImport: () => void; onRefresh: () => void;
};

export function ZoteroImportPanelView(props: ViewProps) {
  const { ui, id, status, statusLoading, collections, collectionsLoaded, collectionKey, loadingCollections,
    importing, refreshing, needsRefresh, cooldown, notice, onStatusRetry, onCollections, onSelect, onImport, onRefresh } = props;
  const busy = importing || refreshing;
  const buttonClass = 'min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl bg-white p-6 shadow dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40"><BookOpen aria-hidden="true" className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-heading`} className="text-lg font-semibold">{ui('استيراد المراجع من Zotero')}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">{ui('استورد بيانات المراجع فقط؛ ملفات PDF تبقى في حساب Zotero الخاص بك.')}</p>
        </div>
      </div>
      {!status ? (
        <div className="mt-5">
          {statusLoading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />{ui('جارٍ التحقق من اتصال Zotero...')}</p>
            : <button type="button" onClick={onStatusRetry} className={buttonClass}>{ui('إعادة التحقق من الاتصال')}</button>}
        </div>
      ) : !status.entitled ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm leading-6">{ui('اطّلع على خيارات الوصول إلى Zotero في صفحة الخطط.')}</p>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">{ui('عرض الخطط المتاحة')}</Link>
        </div>
      ) : !status.configured || status.integration?.status !== 'connected' ? (
        <div className="mt-5 space-y-3">
          {!status.configured && <p className="text-sm leading-6">{ui('اتصال Zotero غير متاح حاليًا. راجع إعدادات الربط.')}</p>}
          <Link href="/settings/integrations" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">{ui('ربط حساب Zotero')}</Link>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <button type="button" onClick={onCollections} disabled={loadingCollections || busy || cooldown} className={buttonClass}>
            {loadingCollections ? ui('جاري تحميل المجموعات...') : collectionsLoaded ? ui('تحديث مجموعات Zotero') : ui('تحميل مجموعات Zotero')}
          </button>
          {collectionsLoaded && <>
            {collections.length === 0 && <p className="text-sm leading-6 text-gray-500">{ui('لا توجد مجموعات في مكتبتك. يمكنك استيراد المكتبة كاملة.')}</p>}
            <label htmlFor={`${id}-source`} className="block text-sm font-medium">{ui('المصدر')}</label>
            <select id={`${id}-source`} value={collectionKey} onChange={event => onSelect(event.target.value)} disabled={busy || loadingCollections || needsRefresh || cooldown} className="min-h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 disabled:opacity-50 dark:bg-gray-900 dark:text-white">
              <option value="">{ui('المكتبة كاملة')}</option>
              {collections.map(collection => <option key={collection.key} value={collection.key}>{collection.name}</option>)}
            </select>
            <button type="button" onClick={onImport} disabled={busy || loadingCollections || needsRefresh || cooldown} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {importing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
              {importing ? ui('جاري الاستيراد...') : ui('استيراد إلى هذا المشروع')}
            </button>
            {importing && <p role="status" className="text-sm leading-6">{ui('جارٍ استيراد جميع المراجع. قد يستغرق ذلك بضع دقائق.')}</p>}
          </>}
          {needsRefresh && <button type="button" onClick={onRefresh} disabled={busy} className={buttonClass}>
            {refreshing ? ui('جارٍ تحديث مكتبة المشروع...') : ui('تحديث مكتبة المشروع')}
          </button>}
        </div>
      )}
      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} aria-live={notice.tone === 'error' ? 'assertive' : 'polite'} className="mt-4 break-words text-sm leading-6 text-blue-600 dark:text-blue-300">{ui(notice.key, notice.values)}</p>}
    </section>
  );
}

function ZoteroImportSession({ projectId, onImported }: { projectId: string; onImported: () => Promise<void> }) {
  const { text: ui } = useUiTranslation();
  const id = useId();
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [collectionKey, setCollectionKey] = useState('');
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const active = useRef(true);
  const requests = useRef(new Set<AbortController>());
  const statusRequest = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const collectionBusy = useRef(false);
  const refreshRequired = useRef(false);
  const confirmedCount = useRef<number | null>(null);
  const cooldownDeadline = useRef(0);

  const beginRequest = useCallback(() => { const controller = new AbortController(); requests.current.add(controller); return controller; }, []);
  const endRequest = (controller: AbortController) => requests.current.delete(controller);
  const live = (controller: AbortController) => active.current && !controller.signal.aborted;
  const applyCooldown = (error: unknown) => {
    if (error instanceof ZoteroPanelRequestError && error.retryAfter) {
      cooldownDeadline.current = Date.now() + error.retryAfter * 1000;
      setCooldownUntil(cooldownDeadline.current);
    }
  };
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setTimeout(() => { cooldownDeadline.current = 0; setCooldownUntil(0); }, Math.max(0, cooldownUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [cooldownUntil]);

  const loadStatus = useCallback(async () => {
    statusRequest.current?.abort();
    const controller = beginRequest();
    statusRequest.current = controller;
    setStatusLoading(true);
    setNotice(null);
    try {
      const value = readZoteroPanelStatus(await requestZoteroPanelJson('/api/integrations/zotero/status', controller.signal, 20_000));
      if (active.current && !controller.signal.aborted) setStatus(value);
    } catch {
      if (active.current && !controller.signal.aborted) setNotice({ key: 'تعذر التحقق من اتصال Zotero. أعد المحاولة.', tone: 'error' });
    } finally {
      requests.current.delete(controller);
      if (active.current && statusRequest.current === controller && !controller.signal.aborted) setStatusLoading(false);
    }
  }, [beginRequest]);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadStatus(); });
    const controllers = requests.current;
    return () => { cancelled = true; active.current = false; for (const controller of controllers) controller.abort(); controllers.clear(); };
  }, [loadStatus]);

  async function loadCollections() {
    if (collectionBusy.current || busy.current || Date.now() < cooldownDeadline.current) return;
    collectionBusy.current = true;
    const controller = beginRequest();
    setLoadingCollections(true);
    setNotice(null);
    try {
      const result = readZoteroPanelCollections(await requestZoteroPanelJson('/api/integrations/zotero/collections', controller.signal, 20_000));
      if (!live(controller)) return;
      setCollections(result);
      setCollectionsLoaded(true);
      setCollectionKey(current => result.some(collection => collection.key === current) ? current : '');
    } catch (error) {
      if (!live(controller)) return;
      applyCooldown(error);
      setNotice({ key: error instanceof ZoteroPanelRequestError && error.retryAfter ? 'الاتصال غير متاح مؤقتًا. يمكنك إعادة المحاولة بعد {0} ثانية.' : 'تعذر تحميل مجموعات Zotero. أعد المحاولة.', values: error instanceof ZoteroPanelRequestError && error.retryAfter ? [error.retryAfter] : undefined, tone: 'error' });
    } finally {
      endRequest(controller);
      collectionBusy.current = false;
      if (live(controller)) setLoadingCollections(false);
    }
  }

  async function refreshLibrary(controller: AbortController) {
    setRefreshing(true);
    try {
      await withZoteroDeadline(() => onImported(), controller.signal, 20_000);
      if (!live(controller)) return;
      refreshRequired.current = false;
      setNeedsRefresh(false);
      setNotice(confirmedCount.current === null
        ? { key: 'تم تحديث مكتبة المشروع. راجع المراجع المحفوظة قبل إعادة الاستيراد عند الحاجة.', tone: 'info' }
        : confirmedCount.current === 0 ? { key: 'لا توجد مراجع قابلة للاستيراد في المصدر المحدد.', tone: 'success' }
          : { key: 'تمت مزامنة {0} مرجعًا بنجاح.', values: [confirmedCount.current], tone: 'success' });
    } catch {
      if (!live(controller)) return;
      refreshRequired.current = true;
      setNeedsRefresh(true);
      setNotice({ key: confirmedCount.current === null ? 'تعذر تحديث مكتبة المشروع. أعد التحديث قبل محاولة الاستيراد مرة أخرى.' : 'تمت المزامنة، لكن تعذر تحديث عرض مكتبة المشروع. حدّث المكتبة لعرض المراجع المحفوظة.', tone: confirmedCount.current === null ? 'error' : 'info' });
    } finally {
      if (live(controller)) setRefreshing(false);
    }
  }

  async function importReferences() {
    if (busy.current || collectionBusy.current || refreshRequired.current || Date.now() < cooldownDeadline.current || !collectionsLoaded) return;
    busy.current = true;
    const controller = beginRequest();
    confirmedCount.current = null;
    setImporting(true);
    setNotice(null);
    try {
      const count = readZoteroPanelImportCount(await requestZoteroPanelJson('/api/integrations/zotero/import', controller.signal, 240_000, { projectId, ...(collectionKey ? { collectionKey } : {}) }));
      if (!live(controller)) return;
      confirmedCount.current = count;
      setNotice(count === 0 ? { key: 'لا توجد مراجع قابلة للاستيراد في المصدر المحدد.', tone: 'success' } : { key: 'تمت مزامنة {0} مرجعًا بنجاح.', values: [count], tone: 'success' });
      await refreshLibrary(controller);
    } catch (error) {
      if (!live(controller)) return;
      applyCooldown(error);
      refreshRequired.current = true;
      setNeedsRefresh(true);
      setNotice({ key: 'تعذر تأكيد نتيجة الاستيراد. حدّث مكتبة المشروع للتحقق مما تم حفظه قبل إعادة المحاولة.', tone: 'error' });
    } finally {
      endRequest(controller);
      busy.current = false;
      if (live(controller)) setImporting(false);
    }
  }

  async function refreshManually() {
    if (busy.current || collectionBusy.current || !refreshRequired.current) return;
    busy.current = true;
    const controller = beginRequest();
    try { await refreshLibrary(controller); }
    finally { endRequest(controller); busy.current = false; }
  }

  return <ZoteroImportPanelView ui={ui} id={id} status={status} statusLoading={statusLoading} collections={collections}
    collectionsLoaded={collectionsLoaded} collectionKey={collectionKey} loadingCollections={loadingCollections} importing={importing}
    refreshing={refreshing} needsRefresh={needsRefresh} cooldown={cooldownUntil !== 0} notice={notice}
    onStatusRetry={() => { void loadStatus(); }} onCollections={() => { void loadCollections(); }} onSelect={setCollectionKey}
    onImport={() => { void importReferences(); }} onRefresh={() => { void refreshManually(); }} />;
}

export default function ZoteroImportPanel(props: { projectId: string; onImported: () => Promise<void> }) {
  return <ZoteroImportSession key={props.projectId} {...props} />;
}
