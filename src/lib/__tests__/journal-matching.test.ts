import { openAlexUrl, toJournalAngles, toJournalMatches } from '@/lib/journal-matching';

const groups = [
  { key: 'https://openalex.org/S1', key_display_name: 'Clinical Simulation in Nursing', count: 53 },
  { key: 'https://openalex.org/S2', key_display_name: 'BMC Nursing', count: 19 },
  { key: 'https://openalex.org/S3', key_display_name: 'Unknown Journal', count: 0 },
];
const sources = [
  { id: 'https://openalex.org/S2', display_name: 'BMC Nursing', host_organization_name: 'BioMed Central', issn_l: '1472-6955', is_oa: true, is_in_doaj: true, apc_usd: 3090, homepage_url: 'http://www.biomedcentral.com/bmcnurs/', summary_stats: { h_index: 116 }, type: 'journal' },
  { id: 'https://openalex.org/S1', display_name: 'Clinical Simulation in Nursing', host_organization_name: 'Elsevier BV', issn_l: '1876-1399', is_oa: false, is_in_doaj: false, apc_usd: null, homepage_url: null, summary_stats: {}, type: 'journal' },
];

describe('journal matching from OpenAlex (DOC-29-02)', () => {
  test('ranks journals by their works on the topic and keeps only what OpenAlex states', () => {
    expect(toJournalMatches(groups, sources)).toEqual([
      { id: 'S1', name: 'Clinical Simulation in Nursing', publisher: 'Elsevier BV', issn: '1876-1399', topicWorks: 53, openAccess: false, inDoaj: false, apcUsd: null, hIndex: null, homepage: null, acceptanceRate: null },
      { id: 'S2', name: 'BMC Nursing', publisher: 'BioMed Central', issn: '1472-6955', topicWorks: 19, openAccess: true, inDoaj: true, apcUsd: 3090, hIndex: 116, homepage: 'http://www.biomedcentral.com/bmcnurs/', acceptanceRate: null },
    ]);
  });

  test('never has an acceptance rate: OpenAlex does not publish one', () => {
    expect(toJournalMatches(groups, sources).every(match => match.acceptanceRate === null)).toBe(true);
  });

  test('a journal without details keeps its name and count, with every unknown field empty', () => {
    expect(toJournalMatches([groups[0]], [])).toEqual([{ id: 'S1', name: 'Clinical Simulation in Nursing', publisher: null, issn: null, topicWorks: 53, openAccess: null, inDoaj: null, apcUsd: null, hIndex: null, homepage: null, acceptanceRate: null }]);
  });
});

describe('reverse planning from a journal (DOC-29-03)', () => {
  const topics = [
    { key: 'https://openalex.org/T1', key_display_name: 'Simulation-Based Education in Healthcare', count: 120 },
    { key: 'https://openalex.org/T2', key_display_name: 'Nursing Education and Practice', count: 40 },
    { key: 'https://openalex.org/T3', key_display_name: 'Empathy and Medical Education', count: 12 },
    { key: 'https://openalex.org/T4', key_display_name: 'Obesity and Health Practices', count: 1 },
  ];
  const examples = { T1: { title: 'Debriefing after simulation', year: 2025, doi: 'https://doi.org/10.1/a' }, T2: null, T3: { title: 'Empathy in nursing students', year: 2024, doi: null } };

  test('three different angles drawn from the journal\'s own topics, with their counts and an example', () => {
    expect(toJournalAngles(topics, examples)).toEqual([
      { topicId: 'T1', topic: 'Simulation-Based Education in Healthcare', journalWorks: 120, example: examples.T1 },
      { topicId: 'T2', topic: 'Nursing Education and Practice', journalWorks: 40, example: null },
      { topicId: 'T3', topic: 'Empathy and Medical Education', journalWorks: 12, example: examples.T3 },
    ]);
  });

  test('topics with too few works are not offered as angles', () => {
    expect(toJournalAngles([topics[0], topics[3]], examples).map(angle => angle.topicId)).toEqual(['T1']);
  });
});

describe('OpenAlex requests', () => {
  const original = process.env.OPENALEX_API_KEY;
  afterEach(() => { if (original === undefined) delete process.env.OPENALEX_API_KEY; else process.env.OPENALEX_API_KEY = original; });

  test.each(['works', 'sources'] as const)('a %s request carries the platform key when one is set', path => {
    process.env.OPENALEX_API_KEY = 'test-key';
    const url = new URL(openAlexUrl(path, { filter: 'openalex:S1' }));
    expect(url.pathname).toBe(`/${path}`);
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('filter')).toBe('openalex:S1');
  });
});
