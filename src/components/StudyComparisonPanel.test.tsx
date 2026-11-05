import { renderToStaticMarkup } from 'react-dom/server';
import StudyComparisonPanel, { StudyComparisonTable } from './StudyComparisonPanel';
import { EXTRACTION_FIELDS, type StudyExtraction } from '@/lib/writing-analysis';
import type { StudyComparisonPage } from '@/lib/study-comparison';
let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => ({ useUiTranslation: () => ({ language: mockLanguage }) }));
const record: StudyExtraction = { operation: 'extraction', language: 'en', source: { id: 'ba13fcdb-69a7-41aa-a2c9-c495917bcfa3', kind: 'reference', title: 'Synthetic study <script>alert(1)</script>', origin: 'server_discovered', year: 2024, url: null }, sourceHash: 'a'.repeat(64), generatedAt: '2026-10-18T10:00:00Z', sourceLength: 100000, scopeEnd: 60000, fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value: '20 students <img onerror=alert(1)>', quoteText: '20 students <script>alert(1)</script>', quoteStart: 0, quoteEnd: 44 } : null])) as StudyExtraction['fields'] };
const actions = { disabled: false, onOpen: () => {}, onUse: () => {}, onInspect: () => {} };
const page: StudyComparisonPage = { kind: 'reference', offset: 0, total: 1, nextOffset: null, items: [{ source: record.source, status: 'ready', record, locations: { sample: { firstLine: 1, lastLine: 1 } } }] };
afterEach(() => { mockLanguage = 'ar'; });
test.each(['ar', 'en'] as const)('renders accessible evidence cells, missing values and scope/language limits in %s', language => {
  const html = renderToStaticMarkup(<StudyComparisonTable page={page} language={language} {...actions} />);
  expect(html).toContain('scope="col"'); expect(html).toContain('scope="row"'); expect(html).toContain('tabindex="0"'); expect(html).toContain('<details');
  expect(html).toContain(language === 'ar' ? 'غير مذكور في النص المستخدم' : 'Not reported in the text used');
  expect(html).toContain(language === 'ar' ? 'أول جزء' : 'first part'); expect(html).toContain(language === 'ar' ? 'الإنجليزية' : 'English');
  expect(html).not.toContain('<script>'); expect(html).not.toContain('<img'); expect(html).toContain('&lt;script&gt;');
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});
test.each(['ar', 'en'] as const)('keeps the expensive collection closed until requested in %s', language => {
  mockLanguage = language;
  const html = renderToStaticMarkup(<StudyComparisonPanel projectId="fixture" revision={0} {...actions} />);
  expect(html).toContain('aria-expanded="false"'); expect(html).not.toContain('<table');
  expect(html).toContain(language === 'ar' ? 'فتح مقارنة الدراسات' : 'Open study comparison');
});
test('uses distinct messages for unanalyzed and unavailable studies, without showing fabricated empty cells', () => {
  const html = renderToStaticMarkup(<StudyComparisonTable {...actions} page={{ ...page, total: 2, items: [{ ...page.items[0], status: 'not_extracted', record: null }, { ...page.items[0], source: { ...record.source, id: 'second' }, status: 'text_unavailable', record: null }] }} language="en" />);
  expect(html).toContain('No extraction is saved'); expect(html).toContain('Text is unavailable'); expect(html).not.toContain('Not reported in the text used');
});
