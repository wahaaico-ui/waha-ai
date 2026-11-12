import { heritageBibliography, heritageNotes, type HeritageSource } from '@/lib/citations/heritage';

const muqaddima: HeritageSource = {
  key: 'a', title: 'المقدمة', year: 1988,
  authors: [{ literal: 'ابن خلدون' }], editors: [{ literal: 'خليل شحادة' }],
  edition: '2', place: 'بيروت', publisher: 'دار الفكر',
};
const lisan: HeritageSource = { key: 'b', title: 'لسان العرب', year: 1994, authors: [{ literal: 'ابن منظور' }], editors: [], edition: '3', place: 'بيروت', publisher: 'دار صادر' };
const tabari: HeritageSource = { key: 'c', title: 'تاريخ الرسل والملوك', year: null, authors: [{ family: 'الطبري', given: 'محمد بن جرير' }], editors: [], edition: null, place: null, publisher: null };

describe('heritage footnotes (DOC-35-02)', () => {
  test('the first note is full and keeps the volume and page', () => {
    expect(heritageNotes([{ sources: [{ source: muqaddima, volume: '1', page: '25' }] }])).toEqual([
      'ابن خلدون، المقدمة، تحقيق: خليل شحادة، ط2، (بيروت: دار الفكر، 1988)، ج1، ص25.',
    ]);
  });

  test('a later note to the same book is short; one right after it says «المصدر نفسه»', () => {
    expect(heritageNotes([
      { sources: [{ source: muqaddima, volume: '1', page: '25' }] },
      { sources: [{ source: muqaddima, volume: '2', page: '110-112' }] },
      { sources: [{ source: lisan, volume: '13', page: '٤٥' }] },
      { sources: [{ source: muqaddima, page: '30' }] },
    ])).toEqual([
      'ابن خلدون، المقدمة، تحقيق: خليل شحادة، ط2، (بيروت: دار الفكر، 1988)، ج1، ص25.',
      'المصدر نفسه، ج2، ص110-112.',
      'ابن منظور، لسان العرب، ط3، (بيروت: دار صادر، 1994)، ج13، ص٤٥.',
      'ابن خلدون، المقدمة، ص30.',
    ]);
  });

  test('missing publication details are left out, never invented', () => {
    expect(heritageNotes([{ sources: [{ source: tabari }] }])).toEqual(['محمد بن جرير الطبري، تاريخ الرسل والملوك.']);
  });

  test('several sources for one passage share a note, separated by a semicolon', () => {
    expect(heritageNotes([{ sources: [{ source: lisan, volume: '1', page: '5' }, { source: tabari, page: '7' }] }])).toEqual([
      'ابن منظور، لسان العرب، ط3، (بيروت: دار صادر، 1994)، ج1، ص5؛ محمد بن جرير الطبري، تاريخ الرسل والملوك، ص7.',
    ]);
  });
});

describe('heritage list of sources', () => {
  test('alphabetical by author, ignoring the article «ال», with the family name first', () => {
    expect(heritageBibliography([tabari, muqaddima, lisan])).toEqual([
      { key: 'a', text: 'ابن خلدون، المقدمة، تحقيق: خليل شحادة، ط2، بيروت: دار الفكر، 1988.' },
      { key: 'b', text: 'ابن منظور، لسان العرب، ط3، بيروت: دار صادر، 1994.' },
      { key: 'c', text: 'الطبري، محمد بن جرير، تاريخ الرسل والملوك.' },
    ]);
  });
});

describe('heritage citation in a draft', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildWritingCitationPlan, buildSourceBibliography } = require('@/lib/citations/writing-citations') as typeof import('@/lib/citations/writing-citations');
  const book = (id: string, title: string, author: string, extra = {}) => ({
    id, kind: 'reference' as const, title, origin: 'zotero', url: null, year: 1988,
    bibliography: { authors: [{ literal: author }], unstructuredNames: true, journal: null, publisher: 'دار الفكر', volume: null, issue: null, pages: null, doi: null, type: 'book', place: 'بيروت', edition: '2', ...extra },
  });
  const sources = { c1: book('11111111-1111-4111-8111-111111111111', 'المقدمة', 'ابن خلدون', { editors: [{ literal: 'خليل شحادة' }] }), c2: book('11111111-1111-4111-8111-111111111111', 'المقدمة', 'ابن خلدون', { editors: [{ literal: 'خليل شحادة' }] }) };
  const text = 'العصبية أساس الملك. والملك غاية العصبية.';
  const link = (id: string, start: number, end: number, volume: string, page: string) => ({
    id, claimStart: start, claimEnd: end, claimText: text.slice(start, end), sourceKind: 'reference' as const, sourceId: '11111111-1111-4111-8111-111111111111',
    sourceHash: 'a'.repeat(64), quoteStart: 0, quoteEnd: 4, quoteText: 'نص', relation: 'supports' as const, note: '', volume, page,
  });
  const draft = { text, citationStyle: 'heritage' as const, citations: [link('c1', 0, 19, '1', '154'), link('c2', 20, text.length, '1', '160')] };

  test('numbers the notes in the text and keeps each passage\'s volume and page', () => {
    const plan = buildWritingCitationPlan(draft, sources);
    expect(plan.segments.filter(segment => segment.inText).map(segment => segment.inText)).toEqual(['(1)', '(2)']);
    expect(plan.notes).toEqual([
      'ابن خلدون، المقدمة، تحقيق: خليل شحادة، ط2، (بيروت: دار الفكر، 1988)، ج1، ص154.',
      'المصدر نفسه، ج1، ص160.',
    ]);
    expect(plan.bibliography).toEqual([{ sourceKeys: ['reference:11111111-1111-4111-8111-111111111111'], text: 'ابن خلدون، المقدمة، تحقيق: خليل شحادة، ط2، بيروت: دار الفكر، 1988.' }]);
  });

  test('the other styles are unchanged and carry no notes', () => {
    expect(buildWritingCitationPlan({ ...draft, citationStyle: 'apa-7' }, sources).notes).toBeUndefined();
  });

  test('a library list in the heritage style is alphabetical', () => {
    const { bibliography } = buildSourceBibliography([book('22222222-2222-4222-8222-222222222222', 'لسان العرب', 'ابن منظور'), sources.c1], 'heritage');
    expect(bibliography.map(entry => entry.text.split('،')[0])).toEqual(['ابن خلدون', 'ابن منظور']);
  });
});

describe('volume and page are saved with the link and reach the file', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseWritingDraft, readSavedWriting } = require('@/lib/evidence-writing') as typeof import('@/lib/evidence-writing');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writingExportModel } = require('@/lib/evidence-writing-export') as typeof import('@/lib/evidence-writing-export');
  const text = 'العصبية أساس الملك.';
  const citation = {
    id: '33333333-3333-4333-8333-333333333333', claimStart: 0, claimEnd: text.length, claimText: text,
    sourceKind: 'reference', sourceId: '11111111-1111-4111-8111-111111111111', sourceHash: 'b'.repeat(64),
    quoteStart: 0, quoteEnd: 3, quoteText: 'نصّ', relation: 'supports', note: '', volume: '1', page: '١٥٤',
  };

  test('only numbers or a range are accepted, and earlier drafts without them stay valid', () => {
    expect(parseWritingDraft({ text, citations: [citation] })?.citations[0]).toMatchObject({ volume: '1', page: '١٥٤' });
    expect(parseWritingDraft({ text, citations: [{ ...citation, page: '110-112' }] })?.citations[0].page).toBe('110-112');
    expect(parseWritingDraft({ text, citations: [{ ...citation, page: '\\input{x}' }] })).toBeNull();
    const earlier: Partial<typeof citation> = { ...citation }; delete earlier.volume; delete earlier.page;
    expect(parseWritingDraft({ text, citations: [earlier] })?.citations[0]).not.toHaveProperty('volume');
  });

  test('a saved heritage draft exports its notes with volume and page', () => {
    const saved = readSavedWriting(JSON.stringify({ text, citationStyle: 'heritage', citations: [{
      ...citation, firstLine: 1, lastLine: 1,
      source: { id: citation.sourceId, kind: 'reference', title: 'المقدمة', origin: 'zotero', url: null, year: 1988,
        bibliography: { authors: [{ literal: 'ابن خلدون' }], unstructuredNames: true, journal: null, publisher: 'دار الفكر', volume: null, issue: null, pages: null, doi: null, type: 'book', editors: [{ literal: 'خليل شحادة' }], edition: '2', place: 'بيروت' } },
    }] }));
    expect(saved).not.toBeNull();
    const model = writingExportModel(saved!, 'ar');
    expect(model.sections[0].paragraphs[0]).toContain('(1)');
    expect(model.sections.find(section => section.title === 'الحواشي')?.paragraphs).toEqual(['(1) ابن خلدون، المقدمة، تحقيق: خليل شحادة، ط2، (بيروت: دار الفكر، 1988)، ج1، ص١٥٤.']);
  });
});
