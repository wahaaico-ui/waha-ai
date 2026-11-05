import { randomUUID } from 'node:crypto';
import { buildProjectExportModel, buildProjectMarkdown, type ExportReference } from '@/lib/project-export';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';
import { buildSourceBibliography, buildWritingCitationPlan } from '@/lib/citations/writing-citations';
import { CITATION_STYLES } from '@/lib/citations/types';
import { BibliographyEngine, CitationFormatter, type CitationItem } from '@/lib/citations';
import { attachWritingSource, type WritingSource } from '@/lib/evidence-writing';

const reference = { title: 'Evidence and responsible research', authors: [{ family: 'Smith', given: 'Jane' }], publication_year: 2024, publication_title: 'Research Journal', doi: '10.1234/evidence', url: null, citation_data: { volume: '12', issue: '2', pages: '10-18', type: 'article' } } satisfies ExportReference;

test.each(CITATION_STYLES)('exports the same %s bibliography from the library and the evidence editor', style => {
  const source: WritingSource = { id: randomUUID(), kind: 'reference', title: reference.title, year: 2024, url: null, text: 'Source passage.', hash: 'a'.repeat(64), origin: 'user_asserted', bibliography: bibliographyFromReference(reference) };
  const citation = attachWritingSource({ id: randomUUID(), claimStart: 0, claimEnd: 6, claimText: 'Claim.', sourceKind: source.kind, sourceId: source.id, sourceHash: source.hash, quoteStart: 0, quoteEnd: source.text.length, quoteText: source.text, relation: 'contextual', note: '' }, source);
  const plan = buildWritingCitationPlan({ text: 'Claim.', citations: [citation] }, {}, style);
  const model = buildProjectExportModel({ title: 'Reference test', university_policy: null }, [], [], [reference], style, 'en');
  const list = model.sections.find(section => section.title === `Bibliography — ${style}`)!;
  expect(list.paragraphs.slice(1)).toEqual(plan.bibliography.map(entry => entry.text));
  expect(list.paragraphs.join('\n')).not.toContain('Unknown author');
});

test('uses supplied family/given names and the actual APA volume, issue and page punctuation', () => {
  const model = buildProjectExportModel({ title: 'Reference test', university_policy: null }, [], [], [reference], 'apa-7', 'en');
  expect(model.sections.find(section => section.title === 'Bibliography — apa-7')!.paragraphs[1]).toBe('Smith, J. (2024). Evidence and responsible research. Research Journal, 12(2), 10–18. https://doi.org/10.1234/evidence');
});

test('preserves Zotero creators instead of dropping them when the row has no display authors', () => {
  const row = { ...reference, authors: [], citation_data: { ...reference.citation_data as object, creators: [{ creatorType: 'author', firstName: 'Jane', lastName: 'Smith' }] } };
  const model = buildProjectExportModel({ title: 'Reference test', university_policy: null }, [], [], [row], 'apa-7', 'en');
  expect(model.sections.find(section => section.title === 'Bibliography — apa-7')!.paragraphs[1]).toContain('Smith, J. (2024).');
});

test('does not invent initials or family names for an unstructured institutional author', () => {
  const row = { ...reference, authors: ['Research Evidence Consortium'] };
  const model = buildProjectExportModel({ title: 'Reference test', university_policy: null }, [], [], [row], 'apa-7', 'en');
  expect(model.sections.find(section => section.title === 'Bibliography — apa-7')!.paragraphs[1]).toContain('Research Evidence Consortium. (2024).');
  expect(model.sections.some(section => section.paragraphs.some(text => text.includes('full names were preserved')))).toBe(true);
});

test('normalizes duplicate DOI spellings and warns about conflicting publication facts', () => {
  const second = { ...reference, title: 'Conflicting supplied title', doi: 'https://doi.org/10.1234/EVIDENCE' };
  const model = buildProjectExportModel({ title: 'Reference test', university_policy: null }, [], [], [reference, second], 'apa-7', 'en');
  expect(model.sections.find(section => section.title === 'Bibliography — apa-7')!.paragraphs).toHaveLength(2);
  expect(model.sections.some(section => section.paragraphs.some(text => text.includes('same DOI have different metadata')))).toBe(true);
  const markdown = buildProjectMarkdown({ title: 'Reference test', university_policy: null }, [], [], [reference, second], 'apa-7', 'ar');
  expect(markdown).toContain('تختلف بيانات مرجعين');
});

test.each(CITATION_STYLES)('preserves a URL-form DOI once without duplicating its prefix for %s', style => {
  const row = { ...reference, doi: 'https://doi.org/10.1234/EVIDENCE' };
  const model = buildProjectExportModel({ title: 'Reference test', university_policy: null }, [], [], [row], style, 'en');
  const entry = model.sections.find(section => section.title === `Bibliography — ${style}`)!.paragraphs[1];
  expect(entry).toContain('10.1234/evidence');
  expect(entry).not.toContain('doi.org/https:');
  expect(entry.split('10.1234/evidence')).toHaveLength(2);
});

test.each([['book-chapter', 'chapter'], ['proceedings-article', 'paper-conference']] as const)('preserves the supplied %s publication type', (supplied, expected) => {
  const bibliography = bibliographyFromReference({ ...reference, citation_data: { type: supplied } });
  expect(bibliography.type).toBe(expected);
});

test.each(CITATION_STYLES)('uses the same %s output in citation APIs, the library list and project export', style => {
  const item: CitationItem = { id: 'source', title: reference.title, authors: ['Jane Smith'], bibliography: bibliographyFromReference(reference), year: reference.publication_year,
    journal: reference.publication_title, publisher: null, volume: '12', issue: '2', pages: '10-18', doi: reference.doi, url: null, type: 'article', verificationStatus: 'unverified', confidenceScore: 0, provenance: [] };
  const model = buildProjectExportModel({ title: 'Consistency', university_policy: null }, [], [], [reference], style, 'en');
  const expected = model.sections.find(section => section.title === `Bibliography — ${style}`)!.paragraphs[1];
  expect(CitationFormatter.bibliography(item, style)).toBe(expected);
  expect(BibliographyEngine.build([item], style)[0].text).toBe(expected);
  expect(BibliographyEngine.build([item, { ...item, id: 'duplicate', doi: 'https://doi.org/10.1234/EVIDENCE.' }], style)).toHaveLength(1);
});

test('keeps requested numeric labels and page locators separate', () => {
  const item: CitationItem = { id: 'source', title: reference.title, authors: ['Smith, Jane'], year: 2024, journal: reference.publication_title, publisher: null, volume: '12', issue: '2', pages: '10-18', doi: reference.doi, url: null, type: 'article', verificationStatus: 'unverified', confidenceScore: 0, provenance: [] };
  expect(CitationFormatter.inText(item, 'apa-7', 3, 'p. 12')).toBe('(Smith, 2024, p. 12)');
  expect(CitationFormatter.inText(item, 'ieee', 3, 'p. 12')).toContain('[3, p. 12]');
  expect(CitationFormatter.bibliography(item, 'ieee', 3)).toMatch(/^\[3\]/);
  expect(CitationFormatter.inText(item, 'apa-7', 3, 'Figure A')).toContain('Figure A');
});

test.each(CITATION_STYLES)('keeps collection-only %s formatting consistent with cited sources, including disambiguation and DOI aliases', style => {
  const source = (title: string, authors: unknown, doi: string | null): WritingSource => ({
    id: randomUUID(), kind: 'reference', title, year: 2024, url: null,
    text: 'Declared formatting fixture.', hash: 'a'.repeat(64), origin: 'user_asserted',
    bibliography: bibliographyFromReference({ authors, doi, publication_title: 'Fixture Journal', citation_data: {} }),
  });
  const first = source('Zeta study', [{ family: 'Smith', given: 'Jane' }], '10.1234/zeta');
  const sources = [first, source('Alpha study', [{ family: 'Smith', given: 'Jane' }], null),
    source('دراسة تجريبية', [{ family: 'أبو علوش', given: 'محمد' }], null),
    source('Institutional report', ['World Health Organization'], null),
    { ...first, id: randomUUID(), bibliography: { ...first.bibliography!, doi: 'https://doi.org/10.1234/ZETA' } }];
  let text = '';
  const citations = sources.map(s => {
    const claimText = `Claim ${text.length}.`, claimStart = text.length;
    text += claimText + '\n';
    return attachWritingSource({ id: randomUUID(), claimStart, claimEnd: claimStart + claimText.length, claimText,
      sourceKind: s.kind, sourceId: s.id, sourceHash: s.hash, quoteStart: 0, quoteEnd: s.text.length,
      quoteText: s.text, relation: 'contextual', note: 'Formatting test only.' }, s);
  });
  const library = buildSourceBibliography(sources, style);
  const editor = buildWritingCitationPlan({ text, citations }, {}, style);
  expect(library.bibliography).toEqual(editor.bibliography);
  expect(library.issues).toEqual(editor.issues);
  expect(library.bibliography).toHaveLength(4);
  if (style === 'apa-7') {
    expect(library.bibliography.some(entry => entry.text.includes('(2024a). Alpha study'))).toBe(true);
    expect(library.bibliography.some(entry => entry.text.includes('(2024b). Zeta study'))).toBe(true);
  }
});
