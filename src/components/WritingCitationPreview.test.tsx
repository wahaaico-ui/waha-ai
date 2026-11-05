import { renderToStaticMarkup } from 'react-dom/server';
import WritingCitationPreview from './WritingCitationPreview';
import { attachWritingSource } from '@/lib/evidence-writing';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';

test.each(['ar', 'en'] as const)('renders the actual inline citation, bibliography and evidence control safely in %s', language => {
  const text = '<script>alert(1)</script> Research claim.';
  const source = { id: 'ba13fcdb-69a7-41aa-a2c9-c495917bcfa3', kind: 'reference' as const, title: 'Fixture study', text: 'Original passage', hash: 'a'.repeat(64), origin: 'user_asserted', url: null, year: 2024, bibliography: bibliographyFromReference({ authors: [{ family: 'Smith', given: 'Jane' }], publication_title: 'Fixture Journal', doi: null, citation_data: {} }) };
  const citation = attachWritingSource({ id: 'faddfe2c-78f0-4e15-a24d-df151c43f7aa', claimStart: 0, claimEnd: text.length, claimText: text, sourceKind: 'reference', sourceId: source.id, sourceHash: source.hash, quoteStart: 0, quoteEnd: source.text.length, quoteText: source.text, relation: 'contextual', note: '' }, source);
  const html = renderToStaticMarkup(<WritingCitationPreview draft={{ text, citations: [citation] }} sources={{}} language={language} onOpen={() => {}} />);
  expect(html).toContain('(Smith, 2024)'); expect(html).toContain('Smith, J. (2024). Fixture study. Fixture Journal.');
  expect(html).toContain(language === 'ar' ? 'افتح الدليل 1' : 'Open evidence 1');
  expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
  expect(html).toContain('/open-source/citeproc/NOTICE.txt');
  if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
});
