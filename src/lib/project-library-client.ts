import type { CitationItem } from './citations/types';
import type { literaturePaperFromReference } from './research-search-results';

export type ProjectLibraryItem = CitationItem & { origin?: string; canonicalLinked: boolean; literaturePaper: ReturnType<typeof literaturePaperFromReference> };
export class LibraryLoadError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); this.name = 'LibraryLoadError'; }
}
const incomplete = () => new LibraryLoadError('تغيرت المكتبة أثناء التحميل أو لم يكتمل وصولها. أعد تحميلها للحصول على القائمة كاملة.');

function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const cancel = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

async function readPage(url: string, signal?: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const cancel = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    let data: Record<string, unknown>;
    try {
      response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (response.status !== 429) {
        if (!response.ok) throw new LibraryLoadError(response.status === 401 ? 'انتهت جلسة الدخول. سجّل الدخول مجدداً لتحميل مراجعك.' : 'تعذر تحميل المكتبة. أعد المحاولة.', response.status);
        data = await response.json();
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error instanceof LibraryLoadError) throw error;
      throw new LibraryLoadError(controller.signal.aborted ? 'استغرق تحميل المكتبة وقتاً طويلاً. أعد المحاولة.' : 'تعذر تحميل المكتبة. أعد المحاولة.');
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
    if (response.status !== 429) return data!;
    if (attempt >= 2) throw new LibraryLoadError('طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة.', 429);
    const seconds = Number(response.headers.get('Retry-After'));
    await pause(Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : 60_000, signal);
  }
}

/** Bounded requests, complete result. A page is never presented as the whole library. */
export async function loadProjectLibrary(projectId: string, options: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {}): Promise<ProjectLibraryItem[]> {
  const items: ProjectLibraryItem[] = [], seen = new Set<string>();
  let expected: number | null = null;
  for (;;) {
    const data = await readPage(`/api/research/library?projectId=${encodeURIComponent(projectId)}&view=items&offset=${items.length}`, options.signal);
    options.signal?.throwIfAborted();
    if (!data || data.success !== true || !Array.isArray(data.items) || data.items.length > 200 || !Number.isSafeInteger(data.total)
      || Number(data.total) < 0 || data.offset !== items.length || (expected !== null && data.total !== expected)) throw incomplete();
    expected = Number(data.total);
    for (const item of data.items) {
      if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) throw incomplete();
      seen.add(item.id); items.push(item as ProjectLibraryItem);
    }
    if (items.length > expected || (items.length < expected && (!data.items.length || data.nextOffset !== items.length))) throw incomplete();
    if (items.length === expected && data.nextOffset !== null) throw incomplete();
    options.onProgress?.(items.length, expected);
    if (items.length === expected) return items;
  }
}
