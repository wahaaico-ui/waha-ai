type CacheEntry<T> = { expiresAt: number; value: T };

const CACHE_LIMIT = 200;
const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function withAcademicCache<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const current = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = await load();
  if (memoryCache.size >= CACHE_LIMIT) memoryCache.delete(memoryCache.keys().next().value as string);
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function clearAcademicCache() { memoryCache.clear(); }
