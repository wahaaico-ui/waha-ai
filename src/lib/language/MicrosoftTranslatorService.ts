import { fetchJson } from '@/lib/academic/integrations/http';

type TranslatorResponse = Array<{ translations?: Array<{ text?: string }> }>;
export class MicrosoftTranslatorService {
  static configured() { return Boolean(process.env.AZURE_TRANSLATOR_KEY); }
  static async translate(text: string, targetLanguage: 'ar' | 'en') {
    const key = process.env.AZURE_TRANSLATOR_KEY;
    const region = process.env.AZURE_TRANSLATOR_REGION;
    if (!key) throw new Error('Microsoft Translator is not configured');
    const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
    const url = new URL(`${endpoint}/translate`); url.searchParams.set('api-version', '3.0'); url.searchParams.set('to', targetLanguage);
    const headers: Record<string, string> = {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/json',
    };
    if (region && region.toLowerCase() !== 'global') headers['Ocp-Apim-Subscription-Region'] = region;
    const payload = await fetchJson<TranslatorResponse>(url, {
      method: 'POST', headers,
      body: JSON.stringify([{ text }]),
    });
    const output = payload[0]?.translations?.[0]?.text?.trim();
    if (!output) throw new Error('Microsoft Translator returned no translation');
    return output;
  }
}
