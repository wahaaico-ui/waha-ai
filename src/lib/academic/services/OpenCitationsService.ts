import { fetchJson } from '../integrations/http';
import { normaliseDoi } from '../integrations/normalization';

type CountResponse = Array<{ count?: string }>;
export class OpenCitationsService {
  static async citationCount(doi: string) {
    const clean = normaliseDoi(doi); if (!clean) return null;
    const token = process.env.OPENCITATIONS_ACCESS_TOKEN;
    const payload = await fetchJson<CountResponse>(`https://opencitations.net/index/api/v2/citation-count/doi:${encodeURIComponent(clean)}`, { headers: token ? { authorization: token } : {} });
    const count = Number(payload[0]?.count); return Number.isFinite(count) ? count : null;
  }
}
