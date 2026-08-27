import { fetchJson } from '@/lib/academic/integrations/http';

type DeepLResponse = { translations?: Array<{ text?: string }> };
export class DeepLService {
  static configured() { return Boolean(process.env.DEEPL_API_KEY); }
  static async translate(text: string, targetLanguage: 'ar' | 'en') {
    const key = process.env.DEEPL_API_KEY;
    if (!key) throw new Error('DeepL is not configured');
    const endpoint = (process.env.DEEPL_API_URL || 'https://api-free.deepl.com').replace(/\/$/, '');
    const body = new URLSearchParams({ text, target_lang: targetLanguage.toUpperCase() });
    const payload = await fetchJson<DeepLResponse>(`${endpoint}/v2/translate`, {
      method: 'POST', headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const output = payload.translations?.[0]?.text?.trim();
    if (!output) throw new Error('DeepL returned no translation');
    return output;
  }
}
