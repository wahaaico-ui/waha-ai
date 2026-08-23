import { buildResearchPaths, buildSearchCoverage, filterRelevantPapers, inferMethodologyDistribution, paperRelevanceScore, type EvidencePaper } from '../research-exploration';

const papers: EvidencePaper[] = [
  {
    title: 'AI-supported learning in Saudi universities',
    abstract: 'A quantitative survey of university students.',
    year: 2026,
    citations: 12,
    url: 'https://example.com/saudi-ai',
    source: 'both',
    countries: ['SA'],
  },
  {
    title: 'Generative AI and higher education',
    abstract: 'Qualitative interviews with instructors.',
    year: 2025,
    citations: 30,
    url: 'https://example.com/ai-higher-ed',
    source: 'openalex',
    countries: ['GB'],
  },
  {
    title: 'Student adoption of AI tools',
    abstract: 'A mixed-method study.',
    year: 2022,
    citations: 8,
    url: 'https://example.com/adoption',
    source: 'semanticscholar',
    countries: ['US'],
  },
];

describe('research exploration evidence model', () => {
  test('reports unique coverage per real source without inflating the merged total', () => {
    const coverage = buildSearchCoverage(papers, 3, '2026-08-23T00:00:00.000Z', 5);
    expect(coverage.uniqueStudies).toBe(3);
    expect(coverage.candidateResults).toBe(5);
    expect(coverage.excludedByRelevance).toBe(2);
    expect(coverage.queryCount).toBe(3);
    expect(coverage.sources).toEqual([
      { id: 'semanticscholar', label: 'Semantic Scholar', uniqueMatches: 2 },
      { id: 'openalex', label: 'OpenAlex', uniqueMatches: 2 },
    ]);
    expect(coverage.scopeNote).toContain('ليست حكماً');
  });

  test('keeps topic-relevant academic writing evidence ahead of broad unrelated AI papers', () => {
    const relevant: EvidencePaper = {
      ...papers[0],
      title: 'Generative AI and academic writing among graduate students',
      abstract: 'A study of writing practices in postgraduate education.',
    };
    const unrelated: EvidencePaper = {
      title: 'Generative AI for automated theorem proving',
      abstract: 'A new prover for mathematical logic and formal verification.',
      year: 2026,
      citations: 1000,
      url: 'https://example.com/theorem',
      source: 'openalex',
    };
    const queries = ['generative AI academic writing graduate students'];

    expect(paperRelevanceScore(relevant, queries)).toBeGreaterThan(paperRelevanceScore(unrelated, queries));
    expect(filterRelevantPapers([relevant, unrelated], queries)).toEqual([relevant]);
  });

  test('labels methodology as inferred from abstracts and counts papers by method', () => {
    expect(inferMethodologyDistribution(papers)).toEqual([
      { type: 'كمي', count: 1 },
      { type: 'نوعي', count: 1 },
      { type: 'مختلط', count: 1 },
    ]);
  });

  test('uses the authenticated researcher context to propose a local path with references', () => {
    const paths = buildResearchPaths('أثر الذكاء الاصطناعي على التعلم', papers, {
      countryCode: 'SA',
      countryName: 'المملكة العربية السعودية',
      specialty: 'التربية وعلم النفس',
      university: 'جامعة الملك سعود',
      level: 'phd',
    }, 2026);

    expect(paths.length).toBeGreaterThanOrEqual(3);
    expect(paths[0].id).toBe('local-context');
    expect(paths[0].title).toContain('المملكة العربية السعودية');
    expect(paths[0].rationale).toContain('1');
    expect(paths[0].supportingReferences[0].title).toBe(papers[0].title);
    expect(paths.every((path) => path.evidenceLevel === 'suggestion')).toBe(true);
  });
});
