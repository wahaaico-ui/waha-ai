import { ResearchAnalyzer } from '../academic/ResearchAnalyzer';
import type { ResearchEvidence } from '@/types/OpenAlex';

function paper(overrides: Partial<ResearchEvidence>): ResearchEvidence {
  return {
    title: 'دراسة',
    publicationYear: 2024,
    doi: null,
    openalexId: 'W1',
    citationCount: 0,
    journal: null,
    authors: [],
    abstract: null,
    concepts: [],
    countries: [],
    openalexUrl: 'https://openalex.org/W1',
    ...overrides,
  };
}

describe('ResearchAnalyzer', () => {
  test('computes descriptive metrics from normalized OpenAlex evidence', () => {
    const result = ResearchAnalyzer.analyze([
      paper({ publicationYear: 2023, citationCount: 4, journal: 'Journal A', countries: ['PS'] }),
      paper({ openalexId: 'W2', publicationYear: 2025, citationCount: 8, journal: 'Journal A', countries: ['PS', 'JO'] }),
    ]);

    expect(result).toEqual({
      totalPapers: 2,
      latestPublicationYear: 2025,
      oldestPublicationYear: 2023,
      averageCitationCount: 6,
      numberOfJournals: 1,
      numberOfCountries: 2,
      topJournal: { value: 'Journal A', count: 2 },
      topCountry: { value: 'PS', count: 2 },
    });
  });

  test('does not invent journal, country, year, or citation values for empty evidence', () => {
    expect(ResearchAnalyzer.analyze([])).toEqual({
      totalPapers: 0,
      latestPublicationYear: null,
      oldestPublicationYear: null,
      averageCitationCount: null,
      numberOfJournals: 0,
      numberOfCountries: 0,
      topJournal: { value: null, count: 0 },
      topCountry: { value: null, count: 0 },
    });
  });
});
