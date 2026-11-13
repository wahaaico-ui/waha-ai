import { JOURNAL_CATALOG } from '@/lib/journal-catalog';
import { buildJournalFit, parseJournalTemplate } from '@/lib/journal-template';

describe('ten journals read from their author instructions (DOC-45-02)', () => {
  test('ten distinct journals, each with its source page and check date', () => {
    expect(JOURNAL_CATALOG).toHaveLength(10);
    expect(new Set(JOURNAL_CATALOG.map(journal => journal.id)).size).toBe(10);
    for (const journal of JOURNAL_CATALOG) {
      expect(new URL(journal.source).protocol).toBe('https:');
      expect(journal.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test.each(JOURNAL_CATALOG.map(journal => [journal.id, journal] as const))('%s is a valid template the server accepts', (_id, journal) => {
    expect(parseJournalTemplate(JSON.parse(JSON.stringify(journal.template)))).toEqual(journal.template);
  });

  test('a page that quotes another source says so, and lists what was not read', () => {
    for (const journal of JOURNAL_CATALOG.filter(item => item.sourceKind === 'secondary')) expect(journal.notChecked.join(' ')).toMatch(/تحقق/);
  });
});

describe('a journal that states no keyword count', () => {
  const plos = JOURNAL_CATALOG.find(journal => journal.id === 'plos-one')!.template;
  const srep = JOURNAL_CATALOG.find(journal => journal.id === 'scientific-reports')!.template;

  test('has no keyword check, and optional keywords are checked only for their maximum', () => {
    const publication = { structuredAbstract: { background: 'نص' }, keywords: [] };
    expect(buildJournalFit(plos, {}, publication, 0).checks.map(check => check.id)).not.toContain('keywords');
    expect(buildJournalFit(srep, {}, publication, 0).checks.find(check => check.id === 'keywords')).toEqual({ id: 'keywords', ok: true, actual: 0, limit: '0–6' });
    expect(buildJournalFit(srep, {}, { ...publication, keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }, 0).checks.find(check => check.id === 'keywords')?.ok).toBe(false);
  });

  test('half a keyword range, or a maximum of zero, is refused', () => {
    expect(parseJournalTemplate({ ...plos, keywordsMin: 3, keywordsMax: null })).toBeNull();
    expect(parseJournalTemplate({ ...plos, keywordsMin: 0, keywordsMax: 0 })).toBeNull();
  });

  test('the sections keep the journal\'s own order', () => {
    expect(buildJournalFit(srep, {}, null, 0).outline.map(item => item.section)).toEqual(['introduction', 'results', 'discussion', 'methods']);
  });
});
