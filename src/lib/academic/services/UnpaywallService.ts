import { APPLICATION_EMAIL, fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl } from '../integrations/normalization';

export class UnpaywallService {
  public static async getPdfUrl(doi: string | null): Promise<string | null> {
    if (!doi) return null;

    const cleanDoi = normaliseDoi(doi);
    if (!cleanDoi) return null;
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(cleanDoi)}?email=${encodeURIComponent(APPLICATION_EMAIL)}`;

    try {
      const data = await fetchJson<{ is_oa?: boolean; best_oa_location?: { url_for_pdf?: string; url?: string } }>(url, {}, { retries: 0 });
      if (data.is_oa && data.best_oa_location?.url_for_pdf) {
        return safeUrl(data.best_oa_location.url_for_pdf);
      }
      return null;
    } catch {
      return null;
    }
  }
}
