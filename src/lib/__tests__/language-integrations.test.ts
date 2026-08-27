import { CiteAsService } from '@/lib/language/CiteAsService';
import { DeepLService } from '@/lib/language/DeepLService';
import { LanguageToolService } from '@/lib/language/LanguageToolService';
import { MicrosoftTranslatorService } from '@/lib/language/MicrosoftTranslatorService';

const originalFetch = global.fetch;
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
afterEach(() => {
  global.fetch = originalFetch;
  ['DEEPL_API_KEY', 'DEEPL_API_URL', 'AZURE_TRANSLATOR_KEY', 'AZURE_TRANSLATOR_REGION', 'AZURE_TRANSLATOR_ENDPOINT', 'LANGUAGETOOL_API_URL'].forEach((name) => delete process.env[name]);
  jest.restoreAllMocks();
});

test('DeepL remains disabled without a key and translates through the free endpoint when configured', async () => {
  expect(DeepLService.configured()).toBe(false);
  process.env.DEEPL_API_KEY = 'server-key'; global.fetch = jest.fn().mockResolvedValue(json({ translations: [{ text: 'Translated' }] }));
  await expect(DeepLService.translate('نص أكاديمي', 'en')).resolves.toBe('Translated');
  expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('api-free.deepl.com');
});

test('Microsoft Translator omits the region header for a Global resource', async () => {
  process.env.AZURE_TRANSLATOR_KEY = 'server-key'; process.env.AZURE_TRANSLATOR_REGION = 'global';
  global.fetch = jest.fn().mockResolvedValue(json([{ translations: [{ text: 'مترجم' }] }]));
  await expect(MicrosoftTranslatorService.translate('Academic', 'ar')).resolves.toBe('مترجم');
  const headers = new Headers((global.fetch as jest.Mock).mock.calls[0][1].headers);
  expect(headers.get('Ocp-Apim-Subscription-Key')).toBe('server-key');
  expect(headers.get('Ocp-Apim-Subscription-Region')).toBeNull();
});

test('Microsoft Translator sends the region header for a regional resource', async () => {
  process.env.AZURE_TRANSLATOR_KEY = 'server-key'; process.env.AZURE_TRANSLATOR_REGION = 'westeurope';
  global.fetch = jest.fn().mockResolvedValue(json([{ translations: [{ text: 'مترجم' }] }]));
  await MicrosoftTranslatorService.translate('Academic', 'ar');
  const headers = new Headers((global.fetch as jest.Mock).mock.calls[0][1].headers);
  expect(headers.get('Ocp-Apim-Subscription-Region')).toBe('westeurope');
});

test('LanguageTool requires an explicitly configured licensed or self-hosted URL', async () => {
  expect(LanguageToolService.configured()).toBe(false);
  process.env.LANGUAGETOOL_API_URL = 'https://language.internal';
  global.fetch = jest.fn().mockResolvedValue(json({ matches: [{ message: 'Typo', offset: 0, length: 3, replacements: [{ value: 'The' }], rule: { id: 'SPELL' } }] }));
  const matches = await LanguageToolService.check('Teh text', 'en');
  expect(LanguageToolService.applyFirstSuggestions('Teh text', matches)).toBe('The text');
});

test('CiteAs returns clean official citation styles', async () => {
  global.fetch = jest.fn().mockResolvedValue(json({ citations: [{ citation: '<i>APA citation</i>', style_shortname: 'apa', style_fullname: 'APA' }] }));
  await expect(CiteAsService.citations('10.1000/test')).resolves.toEqual([{ citation: 'APA citation', style: 'apa', styleName: 'APA' }]);
});
