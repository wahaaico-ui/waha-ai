// Deduplication must never combine two scholarly identities: different DOIs
// are different works, and a merged record takes every identity-bearing field
// from a single anchor record. When identity is uncertain, duplicates are kept.
import { deduplicatePapers } from '@/lib/academic/integrations/normalization';
import type { AcademicPaper } from '@/lib/academic/integrations/types';

function paper(overrides: Partial<AcademicPaper>): AcademicPaper {
  return {
    id: 'id', title: 'Artificial intelligence in higher education', abstract: '', year: 2023, citationCount: 0, authors: ['Alice Smith'],
    doi: null, pdfUrl: null, url: null, source: 'crossref', sources: ['crossref'], subjects: [], publicationType: 'article', openAccess: false,
    ...overrides,
  };
}

const identity = (record: AcademicPaper) => ({ doi: record.doi, title: record.title, authors: record.authors, year: record.year, journal: record.journal ?? null, volume: record.volume ?? null, pages: record.pages ?? null });

test('two different DOIs are never merged, even with the same title and adjacent years', () => {
  const first = paper({ id: 'a', doi: '10.1111/aaa', year: 2023, authors: ['Alice Smith'], journal: 'Journal A' });
  const second = paper({ id: 'b', doi: '10.2222/bbb', year: 2024, authors: ['Bob Jones', 'Carol Lee'], abstract: 'A different study.', journal: 'Journal B', source: 'openalex', sources: ['openalex'] });

  const records = deduplicatePapers([first, second]);

  expect(records).toHaveLength(2);
  expect(records.map(identity)).toEqual([identity(first), identity(second)]);
});

test('different DOIs stay apart even when the authors also match', () => {
  const records = deduplicatePapers([
    paper({ id: 'a', doi: '10.1111/aaa' }),
    paper({ id: 'b', doi: '10.2222/bbb', source: 'openalex', sources: ['openalex'] }),
  ]);
  expect(records.map((record) => record.doi)).toEqual(['10.1111/aaa', '10.2222/bbb']);
});

test('the same DOI from two providers is merged and keeps both provenances', () => {
  const records = deduplicatePapers([
    paper({ id: 'a', doi: '10.1111/AAA', source: 'crossref', sources: ['crossref'] }),
    paper({ id: 'b', doi: 'https://doi.org/10.1111/aaa', abstract: 'Abstract', pdfUrl: 'https://example.org/a.pdf', citationCount: 7, source: 'openalex', sources: ['openalex'] }),
  ]);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ doi: '10.1111/aaa', abstract: 'Abstract', citationCount: 7 });
  expect(records[0].sources).toEqual(expect.arrayContaining(['crossref', 'openalex']));
});

test('a record without a DOI joins a DOI record only when title, year and first author agree, and takes no identity from it', () => {
  const withDoi = paper({ id: 'a', doi: '10.1111/aaa', authors: ['Alice Smith', 'Dan Roe'], year: 2023, journal: 'Journal A', volume: '4', pages: '1-10' });
  const withoutDoi = paper({ id: 'core:1', authors: ['Smith, Alice'], year: 2024, abstract: 'Repository abstract.', pdfUrl: 'https://repo.example/a.pdf', journal: 'Repository', volume: '99', pages: '50-60', source: 'core', sources: ['core'] });

  const records = deduplicatePapers([withoutDoi, withDoi]);

  expect(records).toHaveLength(1);
  // Every identity-bearing field is the DOI record's.
  expect(identity(records[0])).toEqual(identity(withDoi));
  // Supplementary fields may come from the other copy of the same work.
  expect(records[0]).toMatchObject({ abstract: 'Repository abstract.', pdfUrl: 'https://repo.example/a.pdf' });
  expect(records[0].sources).toEqual(expect.arrayContaining(['crossref', 'core']));
});

test.each([
  ['a different first author', { authors: ['Bob Jones'] }],
  ['a missing author list', { authors: [] as string[] }],
  ['a year more than one apart', { year: 2026 }],
  ['a short, non-distinctive title', { title: 'Editorial' }],
])('a record without a DOI is kept apart from a DOI record with %s', (_label, overrides) => {
  const withDoi = paper({ id: 'a', doi: '10.1111/aaa', ...('title' in overrides ? { title: overrides.title } : {}) });
  const withoutDoi = paper({ id: 'core:1', source: 'core', sources: ['core'], abstract: 'Other abstract.', ...overrides });

  const records = deduplicatePapers([withDoi, withoutDoi]);

  expect(records).toHaveLength(2);
  expect(identity(records[0])).toEqual(identity(withDoi));
  expect(records[0].abstract).toBe('');
});

test('two records without DOIs merge only on title, year and first author together', () => {
  const sameWork = deduplicatePapers([
    paper({ id: 'core:1', source: 'core', sources: ['core'] }),
    paper({ id: 'openaire:1', authors: ['A. Smith'], abstract: 'Abstract', source: 'openaire', sources: ['openaire'] }),
  ]);
  expect(sameWork).toHaveLength(1);

  const differentAuthors = deduplicatePapers([
    paper({ id: 'core:1', source: 'core', sources: ['core'] }),
    paper({ id: 'openaire:1', authors: ['Bob Jones'], source: 'openaire', sources: ['openaire'] }),
  ]);
  expect(differentAuthors).toHaveLength(2);
});

test('no merged record carries a DOI from one input and authors or year from another', () => {
  const inputs = [
    paper({ id: 'a', doi: '10.1111/aaa', authors: ['Alice Smith'], year: 2023 }),
    paper({ id: 'b', doi: '10.2222/bbb', authors: ['Bob Jones'], year: 2024, source: 'openalex', sources: ['openalex'] }),
    paper({ id: 'c', authors: ['Smith, Alice'], year: 2023, source: 'core', sources: ['core'] }),
    paper({ id: 'd', authors: ['Jones, Bob'], year: 2024, source: 'openaire', sources: ['openaire'] }),
    paper({ id: 'e', doi: '10.1111/aaa', authors: ['Alice Smith', 'Dan Roe'], year: 2023, abstract: 'x', source: 'semantic-scholar', sources: ['semantic-scholar'] }),
  ];
  for (const record of deduplicatePapers(inputs)) {
    if (!record.doi) continue;
    const donors = inputs.filter((input) => input.doi && input.doi === record.doi);
    expect(donors.some((donor) => donor.authors.join('|') === record.authors.join('|') && donor.year === record.year && donor.title === record.title)).toBe(true);
  }
});
