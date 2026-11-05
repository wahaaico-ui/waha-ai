import { BibliographyEngine, CitationEngine, CitationFormatter, CitationQualityEngine, CitationResolver, CITATION_STYLES, type CitationItem } from '@/lib/citations';
import { CitationVerifier as AcademicCitationVerifier } from '@/lib/academic/CitationVerifier';
import { ResearchRouter } from '@/lib/academic/ResearchRouter';
import { ResearchSourceRegistry } from '@/lib/academic/ResearchSourceRegistry';
import type { AcademicPaper } from '@/lib/academic/integrations/types';

const item: CitationItem = {
  id: '10.1000/example', title: 'A reliable academic study', authors: ['Ada Lovelace', 'Alan Turing'], year: 2025,
  journal: 'Journal of Reliable Research', publisher: 'Example Publisher', volume: '4', issue: '2', pages: '10-22',
  doi: '10.1000/example', url: 'https://doi.org/10.1000/example', type: 'article', verificationStatus: 'verified', confidenceScore: 94, provenance: ['crossref', 'openalex'],
};

describe('citation engine', () => {
  test.each(CITATION_STYLES)('normalizes DOI URLs in saved references for %s', (style) => {
    for (const doi of ['10.1000/example', 'https://doi.org/10.1000/example', 'http://dx.doi.org/10.1000/example', 'doi:10.1000/example']) {
      const formatted = CitationFormatter.bibliography({ ...item, doi }, style);
      expect(formatted).toContain('10.1000/example');
      expect(formatted).not.toContain('doi.org/https:');
    }
  });
  test.each(CITATION_STYLES)('formats a bibliography and in-text citation for %s', (style) => {
    const citation = CitationEngine.create(item, style, { number: 3, locator: 'p. 12' });
    expect(citation.inText).toBeTruthy();
    // CSL applies the style's title capitalization (e.g. Chicago title case).
    expect(citation.bibliography.toLowerCase()).toContain('a reliable academic study');
    expect(citation.verificationStatus).toBe('verified');
  });

  test('renumbers numeric bibliographies after an item is removed', () => {
    const second = { ...item, id: '10.1000/second', doi: '10.1000/second', title: 'Second study' };
    const before = BibliographyEngine.build([item, second], 'ieee');
    const after = BibliographyEngine.build([second], 'ieee');
    expect(before.map((entry) => entry.number)).toEqual([1, 2]);
    expect(after[0].number).toBe(1);
    expect(after[0].text).toMatch(/^\[1\]/);
  });

  test('does not mark incomplete unverified metadata as citation-ready', () => {
    const result = CitationQualityEngine.assess({ ...item, authors: [], year: null, doi: null, url: null, verificationStatus: 'unverified', confidenceScore: 20 });
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['authors', 'year', 'persistent-link']));
  });

  test('resolves a unified paper without inventing unavailable fields', () => {
    const paper: AcademicPaper = { id: 'p', title: 'Paper', authors: ['Author'], year: 2024, abstract: '', citationCount: 0, doi: null, pdfUrl: null, url: null, source: 'core', sources: ['core'], subjects: [], publicationType: 'article', openAccess: false };
    const resolved = CitationResolver.fromPaper(paper);
    expect(resolved).toMatchObject({ title: 'Paper', doi: null, journal: null, verificationStatus: 'unverified' });
    expect(CitationFormatter.bibliography(resolved, 'apa-7')).not.toContain('undefined');
  });
});

describe('research registry, routing and verification', () => {
  test('routes medicine to biomedical sources without sending it to arXiv', () => {
    const route = ResearchRouter.route('clinical nursing intervention');
    expect(route.providers).toEqual(expect.arrayContaining(['pubmed', 'europe-pmc', 'crossref']));
    expect(route.providers).not.toContain('arxiv');
  });

  test('registry exposes operational metadata rather than only provider names', () => {
    const crossref = ResearchSourceRegistry.get('crossref');
    expect(crossref).toMatchObject({ enabled: true, authentication: 'none' });
    expect(crossref?.documentationUrl).toMatch(/^https:/);
    expect(crossref?.retryPolicy.retry429).toBe(true);
  });

  test('verification distinguishes a single unverified record from a cross-validated DOI', () => {
    const single: AcademicPaper = { id: 'x', title: 'Study', authors: ['A'], year: 2025, abstract: '', citationCount: 0, doi: null, pdfUrl: null, url: null, source: 'core', sources: ['core'], subjects: [], publicationType: 'article', openAccess: false };
    const multi = { ...single, doi: '10.1000/x', sources: ['core', 'crossref'] as AcademicPaper['sources'] };
    expect(AcademicCitationVerifier.evaluate(single).status).toBe('unverified');
    expect(AcademicCitationVerifier.evaluate(multi).status).toBe('verified');
  });
});
