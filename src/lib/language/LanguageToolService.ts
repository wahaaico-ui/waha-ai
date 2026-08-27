import { fetchJson } from '@/lib/academic/integrations/http';

export type LanguageToolMatch = { message: string; offset: number; length: number; replacements: string[]; ruleId: string };
type Response = { matches?: Array<{ message?: string; offset?: number; length?: number; replacements?: Array<{ value?: string }>; rule?: { id?: string } }> };

export class LanguageToolService {
  static configured() { return Boolean(process.env.LANGUAGETOOL_API_URL); }
  static async check(text: string, language: 'ar' | 'en'): Promise<LanguageToolMatch[]> {
    const configuredUrl = process.env.LANGUAGETOOL_API_URL;
    if (!configuredUrl) throw new Error('LanguageTool requires a self-hosted or licensed API URL');
    const url = `${configuredUrl.replace(/\/$/, '')}/v2/check`;
    const body = new URLSearchParams({ text, language: language === 'ar' ? 'ar' : 'en-US' });
    if (process.env.LANGUAGETOOL_USERNAME) body.set('username', process.env.LANGUAGETOOL_USERNAME);
    if (process.env.LANGUAGETOOL_API_KEY) body.set('apiKey', process.env.LANGUAGETOOL_API_KEY);
    const payload = await fetchJson<Response>(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    return (payload.matches || []).map((match) => ({
      message: match.message || '', offset: match.offset || 0, length: match.length || 0,
      replacements: (match.replacements || []).map((replacement) => replacement.value || '').filter(Boolean),
      ruleId: match.rule?.id || '',
    }));
  }

  static applyFirstSuggestions(text: string, matches: LanguageToolMatch[]) {
    return [...matches].sort((a, b) => b.offset - a.offset).reduce((output, match) => {
      const replacement = match.replacements[0];
      return replacement ? `${output.slice(0, match.offset)}${replacement}${output.slice(match.offset + match.length)}` : output;
    }, text);
  }
}
