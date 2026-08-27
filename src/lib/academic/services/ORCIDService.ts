import { fetchJson, resilientFetch } from '../integrations/http';

type TokenResponse = { access_token?: string };
type SearchResponse = { result?: Array<{ 'orcid-identifier'?: { path?: string; uri?: string } }> };

export class ORCIDService {
  private static token: string | null = null;
  static configured() { return Boolean(process.env.ORCID_CLIENT_ID && process.env.ORCID_CLIENT_SECRET); }
  private static async accessToken() {
    if (this.token) return this.token;
    const clientId = process.env.ORCID_CLIENT_ID; const clientSecret = process.env.ORCID_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('ORCID credentials are not configured');
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials', scope: '/read-public' });
    const response = await resilientFetch('https://orcid.org/oauth/token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const payload = await response.json() as TokenResponse; if (!payload.access_token) throw new Error('ORCID did not return an access token'); this.token = payload.access_token; return this.token;
  }
  static async searchResearcher(query: string, rows = 5) {
    const token = await this.accessToken(); const url = new URL('https://pub.orcid.org/v3.0/search/'); url.searchParams.set('q', query); url.searchParams.set('rows', String(Math.min(20, rows)));
    const payload = await fetchJson<SearchResponse>(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.orcid+json' } });
    return (payload.result || []).map((item) => ({ orcid: item['orcid-identifier']?.path || '', uri: item['orcid-identifier']?.uri || '' })).filter((item) => item.orcid);
  }
}
