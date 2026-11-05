import { DISCOVERY_PROVIDER, USER_ASSERTED_PROVIDER } from '@/lib/research-search-results';

export type ReferenceOrigin = 'server_discovered' | 'user_asserted' | 'zotero_import' | 'legacy_client_submitted';

function hasDiscoveryRecord(citationData: unknown) {
  if (!citationData || typeof citationData !== 'object' || Array.isArray(citationData)) return false;
  const discovery = (citationData as { discovery?: unknown }).discovery;
  return Boolean(discovery && typeof discovery === 'object' && typeof (discovery as { resultId?: unknown }).resultId === 'string' && (discovery as { resultId: string }).resultId);
}

/**
 * Where a reference's metadata came from, from the values the server set. A
 * discovered reference must also carry the server-held search result it was
 * rehydrated from; a row that only names the discovery provider (for example
 * one written before browser writes were closed) is labelled legacy, as are
 * rows saved before Slice 1 (provider 'waha' or a provider named by the browser).
 */
export function referenceOrigin(row: { provider: string; citation_data: unknown }): ReferenceOrigin {
  if (row.provider === DISCOVERY_PROVIDER) return hasDiscoveryRecord(row.citation_data) ? 'server_discovered' : 'legacy_client_submitted';
  if (row.provider === USER_ASSERTED_PROVIDER) return 'user_asserted';
  if (row.provider === 'zotero') return 'zotero_import';
  return 'legacy_client_submitted';
}
