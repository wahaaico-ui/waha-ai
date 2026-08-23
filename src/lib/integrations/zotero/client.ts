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

async function zoteroFetch<T>(userId: string, apiKey: string, path: string): Promise<T> {
  const response = await fetch(`https://api.zotero.org/users/${encodeURIComponent(userId)}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Zotero-API-Version': '3',
    },
    cache: 'no-store',
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60';
    throw new Error(`Zotero rate limit reached. Retry after ${retryAfter} seconds.`);
  }
  if (!response.ok) throw new Error(`Zotero API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function listZoteroCollections(userId: string, apiKey: string) {
  return zoteroFetch<ZoteroCollection[]>(userId, apiKey, '/collections?limit=100');
}

export function listZoteroItems(userId: string, apiKey: string, collectionKey?: string) {
  const prefix = collectionKey ? `/collections/${encodeURIComponent(collectionKey)}` : '';
  return zoteroFetch<ZoteroItem[]>(userId, apiKey, `${prefix}/items/top?limit=100&itemType=-attachment`);
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
