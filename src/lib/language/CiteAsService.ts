import { APPLICATION_EMAIL, fetchJson } from '@/lib/academic/integrations/http';
import { stripMarkup } from '@/lib/academic/integrations/normalization';

type CiteAsResponse = { citations?: Array<{ citation?: string; style_shortname?: string; style_fullname?: string }> };
export class CiteAsService {
  static async citations(identifier: string) {
    const value = identifier.trim();
    if (!value || value.length > 500) throw new Error('Invalid citation identifier');
    const url = new URL(`https://api.citeas.org/product/${encodeURIComponent(value)}`); url.searchParams.set('email', APPLICATION_EMAIL);
    const payload = await fetchJson<CiteAsResponse>(url, {}, { retries: 0 });
    return (payload.citations || []).map((citation) => ({
      style: citation.style_shortname || '', styleName: citation.style_fullname || '', citation: stripMarkup(citation.citation),
    })).filter((citation) => citation.citation);
  }
}
