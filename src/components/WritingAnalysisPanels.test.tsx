import { renderToStaticMarkup } from 'react-dom/server';
import { CitationReviewPanel, StudyExtractionPanel } from './WritingAnalysisPanels';
import type { WritingDraft } from '@/lib/evidence-writing';
let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => ({ useUiTranslation: () => ({ language: mockLanguage }) }));
afterEach(() => { mockLanguage = 'ar'; });
test.each(['ar', 'en'] as const)('analysis controls are localized and do not imply a scientific verdict in %s', language => {
  mockLanguage = language;
  const source = { id: 'ba13fcdb-69a7-41aa-a2c9-c495917bcfa3', kind: 'pdf' as const, title: 'Fixture', text: 'Original passage', hash: 'a'.repeat(64), origin: 'uploaded_text', url: null, year: null };
  const html = renderToStaticMarkup(<StudyExtractionPanel projectId="fixture" source={source} disabled={false} onUse={() => {}} />);
  const review = renderToStaticMarkup(<CitationReviewPanel projectId="fixture" documentId={null} draft={{ text: '', citations: [] }} dirty={false} saving={false} onApply={() => {}} />);
  expect(html).toContain(language === 'ar' ? 'المقطع الأصلي' : 'original passage');
  expect(review).toContain(language === 'ar' ? 'اقتراح للمراجعة' : 'A suggestion for review');
  if (language === 'en') { expect(html).not.toMatch(/[\u0600-\u06ff]/); expect(review).not.toMatch(/[\u0600-\u06ff]/); }
});
test('keeps assessment behind saving and renders untrusted claim/quote as text', () => {
  const draft = { text: '<script>alert(1)</script>', citations: [{ id: 'fixture', claimText: '<script>alert(1)</script>', quoteText: '<img onerror=alert(1)>', relation: 'unclear' }] } as unknown as WritingDraft;
  const html = renderToStaticMarkup(<CitationReviewPanel projectId="fixture" documentId={null} draft={draft} dirty saving={false} onApply={() => {}} />);
  expect(html).toContain('احفظ الكتابة وروابطها أولًا'); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('<img');
});
