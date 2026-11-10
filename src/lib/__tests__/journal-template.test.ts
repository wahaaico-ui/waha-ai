import { buildJournalFit, countWords, JOURNAL_PRESETS, parseJournalTemplate, stageText } from '@/lib/journal-template';

const words = (n: number, w = 'كلمة') => Array.from({ length: n }, () => w).join(' ');

describe('countWords and stageText', () => {
  test('counts Arabic and English words and ignores punctuation-only tokens', () => {
    expect(countWords('أثر الذكاء الاصطناعي — على   الطلبة, and students.')).toBe(7);
  });
  test('collects every string value of a saved stage output', () => {
    expect(stageText({ title: 'عنوان', items: [{ text: 'أول' }, { text: 'ثان' }], count: 3, ok: true })).toBe('عنوان\nأول\nثان');
  });
});

describe('parseJournalTemplate', () => {
  test('accepts a preset unchanged', () => {
    expect(parseJournalTemplate(JOURNAL_PRESETS.imrad)).toEqual(JOURNAL_PRESETS.imrad);
  });
  test('rejects unknown sections, duplicates, empty section lists and inverted keyword ranges', () => {
    expect(parseJournalTemplate({ ...JOURNAL_PRESETS.imrad, sections: ['introduction', 'appendix'] })).toBeNull();
    expect(parseJournalTemplate({ ...JOURNAL_PRESETS.imrad, sections: ['methods', 'methods'] })).toBeNull();
    expect(parseJournalTemplate({ ...JOURNAL_PRESETS.imrad, sections: [] })).toBeNull();
    expect(parseJournalTemplate({ ...JOURNAL_PRESETS.imrad, keywordsMin: 6, keywordsMax: 3 })).toBeNull();
  });
  test('treats empty optional limits as no limit', () => {
    expect(parseJournalTemplate({ ...JOURNAL_PRESETS.imrad, wordLimit: null, referenceLimit: null })).toMatchObject({ wordLimit: null, referenceLimit: null });
  });
});

describe('buildJournalFit', () => {
  const template = { ...JOURNAL_PRESETS.imrad, wordLimit: 100, abstractMaxWords: 10, keywordsMin: 3, keywordsMax: 5, referenceLimit: 2 };
  const outputs = {
    problem: { text: words(20) },
    methodology: { text: words(30) },
    results: { text: words(25) },
    discussion: { text: words(40) },
  };
  const publication = { structuredAbstract: { background: words(4), objective: words(4), methods: words(4), results: '', conclusion: '' }, keywords: ['أ', 'ب'] };

  test('arranges saved stages in the template order with word counts', () => {
    const fit = buildJournalFit(template, outputs, publication, 1);
    expect(fit.outline.map(s => s.section)).toEqual(template.sections);
    expect(fit.outline.find(s => s.section === 'introduction')).toMatchObject({ stages: ['problem'], words: 20 });
    expect(fit.outline.find(s => s.section === 'methods')).toMatchObject({ stages: ['methodology'], words: 30 });
  });

  test('flags required sections the project has not written', () => {
    const fit = buildJournalFit(template, outputs, publication, 1);
    expect(fit.outline.find(s => s.section === 'conclusion')).toMatchObject({ words: 0, missing: true });
    expect(fit.checks.find(c => c.id === 'sections')).toMatchObject({ ok: false });
  });

  test('checks total words, abstract words, keywords and references against the limits', () => {
    const fit = buildJournalFit(template, outputs, publication, 3);
    const byId = Object.fromEntries(fit.checks.map(c => [c.id, c]));
    expect(byId.words).toMatchObject({ ok: false, actual: 115, limit: '100' });
    expect(byId.abstract).toMatchObject({ ok: false, actual: 12, limit: '10' });
    expect(byId.keywords).toMatchObject({ ok: false, actual: 2 });
    expect(byId.references).toMatchObject({ ok: false, actual: 3, limit: '2' });
  });

  test('passes when the manuscript is within every limit', () => {
    const fit = buildJournalFit({ ...template, wordLimit: 500, abstractMaxWords: 50, referenceLimit: 10, sections: ['introduction', 'methods', 'results', 'discussion'] },
      outputs, { ...publication, keywords: ['أ', 'ب', 'ج'] }, 2);
    expect(fit.checks.every(c => c.ok)).toBe(true);
  });

  test('omits checks for limits the journal does not set', () => {
    const fit = buildJournalFit({ ...template, wordLimit: null, referenceLimit: null }, outputs, publication, 1);
    expect(fit.checks.map(c => c.id)).not.toContain('words');
    expect(fit.checks.map(c => c.id)).not.toContain('references');
  });
});
