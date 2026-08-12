export class UnpaywallService {
  public static async getPdfUrl(doi: string | null): Promise<string | null> {
    if (!doi) return null;

    const email = process.env.OPENALEX_EMAIL || 'researcher@waha.ai';
    const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//, '');
    const url = `https://api.unpaywall.org/v2/${cleanDoi}?email=${email}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      if (data.is_oa && data.best_oa_location?.url_for_pdf) {
        return data.best_oa_location.url_for_pdf;
      }
      return null;
    } catch {
      return null;
    }
  }
}
