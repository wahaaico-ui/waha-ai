import { existsSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicInformationPage from './PublicInformationPage';
import PublicDataLinks from './PublicDataLinks';
import { publicInformation, type PublicInformationKind } from '@/lib/public-information';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-language', () => ({ useWahaLanguage: () => ({ language: mockLanguage }) }));
jest.mock('@/components/SiteHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/PublicPage.module.css', () => ({ page: 'public-page' }));

test.each(['ar', 'en'] as const)('public information and account links have real destinations and readable sections in %s', language => {
  mockLanguage = language;
  for (const kind of ['privacy', 'research-use'] as PublicInformationKind[]) {
    const html = renderToStaticMarkup(<PublicInformationPage kind={kind} />);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain(`dir="${language === 'ar' ? 'rtl' : 'ltr'}"`);
    for (const section of publicInformation[kind][language].sections) {
      expect(html).toContain(`id="${section.id}"`);
      expect(html).toContain(`href="#${section.id}"`);
    }
    for (const match of html.matchAll(/href="([^\"]+)"/g)) {
      const href = match[1];
      if (href.startsWith('#')) continue;
      const url = new URL(href, 'https://waha.systems');
      expect(existsSync(path.join(process.cwd(), 'src/app', url.pathname, 'page.tsx'))).toBe(true);
    }
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
  }
  const accountLinks = renderToStaticMarkup(<PublicDataLinks language={language} />);
  expect(accountLinks).toContain('href="/privacy"');
  expect(accountLinks).toContain('href="/terms"');
});
