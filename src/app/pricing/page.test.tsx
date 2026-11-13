import { renderToStaticMarkup } from 'react-dom/server';
import PricingPage from './page';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-language', () => ({ useWahaLanguage: () => ({ language: mockLanguage }) }));
jest.mock('@/components/SiteHeader', () => ({ __esModule: true, default: () => null }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/use-ui-translation', () => ({ useUiTranslation: () => ({ text: (text: string) => text }) }));

afterEach(() => { mockLanguage = 'ar'; });

test.each(['ar', 'en'] as const)('planned institutional services cannot appear as an available purchase in %s', (language) => {
  mockLanguage = language;
  const html = renderToStaticMarkup(<PricingPage />);
  const cards = html.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
  const institutional = cards.find(card => card.includes(language === 'ar' ? 'مؤسسي' : 'Institutional'));
  expect(institutional).toBeDefined();
  expect(institutional).toContain(language === 'ar' ? 'قيد الإعداد' : 'In development');
  expect(institutional).toContain('href="/contact"');
  expect(institutional).not.toMatch(/<button\b/);
  expect(html).not.toMatch(/24[–-]48|25 مستخدم|25 users|3 AI assists|3 عمليات مساعدة|500 AI assists|500 عملية مساعدة/);
});

test.each(['ar', 'en'] as const)('visitors start writing for free and can open the public calculator in %s', (language) => {
  mockLanguage = language;
  const html = renderToStaticMarkup(<PricingPage />);
  expect(html).toContain('href="/?task=writing#start"');
  expect(html).toContain('href="/tools/sample-size"');
  expect(html).not.toMatch(/Subscribe to|الاشتراك في|<button\b/);
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});

test.each(['ar', 'en'] as const)('the free plan states the WAHA mark, paid plans its absence, and its limits honestly, in %s', (language) => {
  mockLanguage = language;
  const html = renderToStaticMarkup(<PricingPage />);
  expect(html).toContain(language === 'ar' ? 'أُعد بمساعدة الواحة' : 'Prepared with WAHA');
  expect(html).toContain(language === 'ar' ? 'ملفات مصدّرة بلا عبارة الواحة' : 'Exported files without the WAHA mark');
  expect(html).toContain(language === 'ar' ? 'فلا نعد بحماية لا تُكسر' : 'we do not promise protection that cannot be broken');
  // Before billing status arrives (and while billing is off) nothing can be bought.
  expect(html).not.toContain(language === 'ar' ? 'اشترك الآن' : 'Subscribe now');
});
