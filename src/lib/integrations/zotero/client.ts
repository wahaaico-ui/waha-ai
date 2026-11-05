export type ZoteroCollection = { key: string; data: { key: string; name: string; parentCollection?: string | false } };

export type ZoteroItem = {
  key: string;
  version: number;
  data: {
    key: string;
    itemType: string;
    title?: string;
    creators?: Array<{ creatorType: string; firstName?: string; lastName?: string; name?: string }>;
    date?: string;
    publicationTitle?: string;
    DOI?: string;
    ISBN?: string;
    url?: string;
    collections?: string[];
  };
};

type ReadErrorCode = 'unavailable' | 'incomplete_response' | 'library_changed' | 'rate_limited';
export class ZoteroReadError extends Error {
  constructor(readonly code: ReadErrorCode, readonly status = 503, readonly retryAfter?: number) {
    super(code); this.name = 'ZoteroReadError';
  }
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const isZoteroKey = (value: unknown): value is string => typeof value === 'string' && /^[A-Z0-9]{8}$/.test(value);
const optionalText = (value: unknown) => value === undefined || typeof value === 'string';
function isCollection(value: unknown): value is ZoteroCollection {
  return record(value) && isZoteroKey(value.key) && record(value.data) && value.data.key === value.key
    && typeof value.data.name === 'string' && (value.data.parentCollection === undefined
      || value.data.parentCollection === false || isZoteroKey(value.data.parentCollection));
}
function isItem(value: unknown): value is ZoteroItem {
  if (!record(value) || !isZoteroKey(value.key) || !Number.isSafeInteger(value.version) || Number(value.version) < 0
    || !record(value.data) || value.data.key !== value.key || typeof value.data.itemType !== 'string') return false;
  const data = value.data;
  return ['title', 'date', 'publicationTitle', 'DOI', 'ISBN', 'url'].every(key => optionalText(data[key]))
    && (data.creators === undefined || (Array.isArray(data.creators) && data.creators.every(creator => record(creator)
      && typeof creator.creatorType === 'string' && ['name', 'firstName', 'lastName'].every(key => optionalText(creator[key])))));
}
function seconds(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value); return Number.isSafeInteger(number) && number > 0 ? number : null;
}

async function readPage(url: string, apiKey: string, parent: AbortSignal) {
  if (parent.aborted) throw new ZoteroReadError('unavailable');
  const controller = new AbortController();
  let rejectAborted: (error: ZoteroReadError) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAborted = reject; });
  const abort = () => { controller.abort(); rejectAborted(new ZoteroReadError('unavailable')); };
  parent.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15_000);
  try {
    return await Promise.race([(async () => {
      let response: Response;
      try {
        response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, 'Zotero-API-Version': '3' },
          cache: 'no-store', redirect: 'error', signal: controller.signal });
      } catch { throw new ZoteroReadError('unavailable'); }
      if (response.status === 429 || response.status === 503) {
        throw new ZoteroReadError('rate_limited', response.status, seconds(response.headers.get('Retry-After')) || 60);
      }
      if (!response.ok) throw new ZoteroReadError('unavailable');
      let page: unknown;
      try { page = await response.json(); } catch { throw new ZoteroReadError('incomplete_response'); }
      return { response, page };
    })(), aborted]);
  } finally { clearTimeout(timer); parent.removeEventListener('abort', abort); }
}

/** Read every page before returning anything to a writer. A changed library,
 * missing pagination metadata or truncated page must never look complete. */
async function readAll<T extends { key: string }>(userId: string, apiKey: string, path: string,
  validate: (value: unknown) => value is T, options: { signal?: AbortSignal; items?: boolean } = {}): Promise<T[]> {
  if (!/^[1-9]\d*$/.test(userId) || !apiKey.trim()) throw new ZoteroReadError('unavailable');
  const budget = new AbortController(), rows: T[] = [], keys = new Set<string>();
  const abort = () => budget.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) budget.abort();
  const timer = setTimeout(abort, 180_000);
  let total: number | undefined, version: string | undefined;
  try {
  do {
    const url = new URL(`https://api.zotero.org/users/${userId}${path}`);
    url.search = new URLSearchParams({ format: 'json', limit: '100', start: String(rows.length), sort: 'dateAdded', direction: 'asc',
      ...(options.items ? { itemType: '-attachment' } : {}) }).toString();
    const { response, page } = await readPage(url.toString(), apiKey, budget.signal);
    const count = response.headers.get('Total-Results'), currentVersion = response.headers.get('Last-Modified-Version');
    if (count === null || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))
      || !currentVersion || !/^\d+$/.test(currentVersion)) throw new ZoteroReadError('incomplete_response');
    if (total !== undefined && (Number(count) !== total || currentVersion !== version)) throw new ZoteroReadError('library_changed', 409);
    total = Number(count); version = currentVersion;
    if (!Array.isArray(page) || page.length > 100 || (!page.length && rows.length < total)
      || rows.length + page.length > total) throw new ZoteroReadError('incomplete_response');
    for (const item of page) {
      if (!validate(item) || keys.has(item.key)) throw new ZoteroReadError('incomplete_response');
      keys.add(item.key); rows.push(item);
    }
    const backoff = seconds(response.headers.get('Backoff'));
    if (backoff && rows.length < total) throw new ZoteroReadError('rate_limited', 429, backoff);
  } while (rows.length < total);
  return rows;
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}

export async function listZoteroCollections(userId: string, apiKey: string, signal?: AbortSignal) {
  return readAll(userId, apiKey, '/collections', isCollection, { signal });
}

export async function listZoteroItems(userId: string, apiKey: string, collectionKey?: string, signal?: AbortSignal) {
  if (collectionKey !== undefined && !isZoteroKey(collectionKey)) throw new ZoteroReadError('incomplete_response');
  const prefix = collectionKey ? `/collections/${collectionKey}` : '';
  return readAll(userId, apiKey, `${prefix}/items/top`, isItem, { signal, items: true });
}

export function normalizeZoteroItem(item: ZoteroItem, projectId: string, userId: string) {
  const authors = (item.data.creators || []).map((creator) => ({
    type: creator.creatorType,
    name: creator.name || [creator.firstName, creator.lastName].filter(Boolean).join(' '),
  }));
  const yearMatch = item.data.date?.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);

  return {
    project_id: projectId,
    user_id: userId,
    provider: 'zotero',
    external_item_key: item.key,
    doi: item.data.DOI?.trim() || null,
    isbn: item.data.ISBN?.trim() || null,
    title: item.data.title?.trim() || 'مرجع بلا عنوان',
    authors,
    publication_year: yearMatch ? Number(yearMatch[1]) : null,
    publication_title: item.data.publicationTitle?.trim() || null,
    url: item.data.url?.trim() || null,
    citation_data: item.data,
    source_version: item.version,
    synced_at: new Date().toISOString(),
  };
}
