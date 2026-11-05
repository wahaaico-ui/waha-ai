import { renderToStaticMarkup } from 'react-dom/server';
import GuidePage from './page';
import { researchEntryTasks, isResearchEntryTask } from '@/lib/research-entry-tasks';
import { translateUiText } from '@/lib/i18n/ui-text';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => ({
  useUiTranslation: () => ({ language: mockLanguage, direction: mockLanguage === 'ar' ? 'rtl' : 'ltr', text: (value: string) => translateUiText(value, mockLanguage) }),
}));
jest.mock('@/components/SiteHeader', () => () => null);
jest.mock('@/components/SiteFooter', () => () => null);
jest.mock('@/components/PublicPage.module.css', () => ({ page: 'public-page' }));

test.each(['ar', 'en'] as const)('the %s guide opens supported tasks and preserves their actual action labels', (language) => {
  mockLanguage = language;
  const html = renderToStaticMarkup(<GuidePage />);
  const taskUrls = [...html.matchAll(/href="([^"\s]+\?task=[^"\s]+)"/g)].map((match) => new URL(match[1], 'https://waha.systems'));
  expect(taskUrls).toHaveLength(Object.keys(researchEntryTasks).length);
  for (const url of taskUrls) {
    expect(url.pathname).toBe('/');
    expect(url.hash).toBe('#start');
    const task = url.searchParams.get('task');
    expect(isResearchEntryTask(task)).toBe(true);
    if (isResearchEntryTask(task)) expect(html).toContain(translateUiText(researchEntryTasks[task].action, language));
  }
  expect(html).toContain('href="/verify-idea"');
  expect(html).toContain('href="/dashboard"');
  expect(html).toContain('href="/contact"');
  expect(html).not.toMatch(/href="#"/);
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});
