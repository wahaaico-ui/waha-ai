// Slice 2A: canonical scholarly identity. Identifiers decide identity in a fixed
// order, a conflicting strong identifier always means two works, and when
// identity is uncertain records stay separate.
import {
  compareIdentity,
  identifiersOf,
  identityTitle,
  identityYear,
  metadataFingerprint,
  normaliseArxivId,
  normaliseCoreId,
  normaliseDoi,
  normaliseOpenAlexId,
  normalisePmcid,
  normalisePmid,
  normaliseSemanticScholarId,
} from '@/lib/academic/identity';
import { canonicalRecordFrom } from '@/lib/academic/canonical-record';
import { deduplicatePapers } from '@/lib/academic/integrations/normalization';
import type { AcademicPaper } from '@/lib/academic/integrations/types';

function paper(overrides: Partial<AcademicPaper> = {}): AcademicPaper {
  return {
    id: 'record', title: 'Generative artificial intelligence in postgraduate learning', abstract: 'Abstract text.', year: 2024, citationCount: 3,
    authors: ['Alice Smith'], doi: null, pdfUrl: null, url: null, source: 'openalex', sources: ['openalex'], subjects: [], publicationType: 'article', openAccess: false,
    ...overrides,
  };
}

const S2_ID = '0123456789abcdef0123456789abcdef01234567';

describe('identifier normalisation', () => {
  test.each([
    ['10.1371/journal.pone.0298037'],
    ['https://doi.org/10.1371/JOURNAL.PONE.0298037'],
    ['http://dx.doi.org/10.1371/journal.pone.0298037'],
    ['doi: 10.1371/journal.pone.0298037.'],
    ['https://doi.org/10.1371%2Fjournal.pone.0298037'],
  ])('DOI %s normalises to one value', (value) => {
    expect(normaliseDoi(value)).toBe('10.1371/journal.pone.0298037');
  });

  test('a value that is not a DOI is no DOI', () => {
    expect(normaliseDoi('not a doi')).toBeNull();
    expect(normaliseDoi('Generative artificial intelligence')).toBeNull();
  });

  test('arXiv IDs keep their base and version apart', () => {
    expect(normaliseArxivId('2401.12345v2')).toEqual({ base: '2401.12345', version: 'v2' });
    expect(normaliseArxivId('http://arxiv.org/abs/2401.12345v1')).toEqual({ base: '2401.12345', version: 'v1' });
    expect(normaliseArxivId('arXiv:2401.12345')).toEqual({ base: '2401.12345', version: null });
    expect(normaliseArxivId('https://arxiv.org/pdf/2401.12345v3.pdf')).toEqual({ base: '2401.12345', version: 'v3' });
    expect(normaliseArxivId('hep-th/9901001v2')).toEqual({ base: 'hep-th/9901001', version: 'v2' });
    expect(normaliseArxivId('Some title')).toBeNull();
  });

  test('an arXiv DOI is the arXiv identifier, not a publisher DOI', () => {
    expect(identifiersOf(paper({ doi: '10.48550/arXiv.2401.12345' }))).toEqual({ arxiv: '2401.12345' });
  });

  test('PMID, PMCID, OpenAlex, Semantic Scholar and CORE IDs', () => {
    expect(normalisePmid('PMID: 38012345')).toBe('38012345');
    expect(normalisePmid('https://pubmed.ncbi.nlm.nih.gov/38012345')).toBe('38012345');
    expect(normalisePmid('abc')).toBeNull();
    expect(normalisePmcid('pmc1234567')).toBe('PMC1234567');
    expect(normalisePmcid('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567')).toBe('PMC1234567');
    expect(normaliseOpenAlexId('https://openalex.org/W2741809807')).toBe('W2741809807');
    expect(normaliseOpenAlexId('w2741809807')).toBe('W2741809807');
    expect(normaliseSemanticScholarId(S2_ID.toUpperCase())).toBe(S2_ID);
    expect(normaliseSemanticScholarId('not-a-paper-id')).toBeNull();
    expect(normaliseCoreId(123456)).toBe('123456');
    expect(normaliseCoreId('core-123')).toBeNull();
  });

  test('a title is never taken as a provider identifier', () => {
    const titled = paper({ id: 'Generative artificial intelligence in postgraduate learning', providerIds: { openalex: 'Generative artificial intelligence', semantic_scholar: 'Generative artificial intelligence', core: 'Generative artificial intelligence' } });
    expect(identifiersOf(titled)).toEqual({});
    expect(canonicalRecordFrom(titled, '2026-10-05T00:00:00.000Z').identifiers).toEqual({});
  });

  test('Arabic titles normalise diacritics, tatweel and alef forms but are not translated', () => {
    expect(identityTitle('أثرُ الذكاءِ الاصطناعيّ في التعلّـم')).toBe(identityTitle('اثر الذكاء الاصطناعي في التعلم'));
    expect(identityTitle('أثر الذكاء الاصطناعي في التعلم')).not.toBe(identityTitle('Effect of artificial intelligence on learning'));
  });

  test('year 0 and implausible years are missing', () => {
    expect(identityYear(0)).toBeNull();
    expect(identityYear(Number.NaN)).toBeNull();
    expect(identityYear(3024)).toBeNull();
    expect(identityYear(2024)).toBe(2024);
  });
});

describe('identity decisions', () => {
  test('the same DOI in different textual forms is the same work', () => {
    expect(compareIdentity(paper({ doi: '10.1000/ABC' }), paper({ doi: 'https://doi.org/10.1000/abc', title: 'A rather different title here' }))).toEqual({ same: true, basis: 'doi' });
  });

  test('different DOIs are different works whatever else matches', () => {
    expect(compareIdentity(paper({ doi: '10.1000/a', pmid: '1' }), paper({ doi: '10.1000/b', pmid: '1' }))).toEqual({ same: false, reason: 'doi_conflict' });
  });

  test('the same PMID is the same work, a different PMID is a different work', () => {
    expect(compareIdentity(paper({ pmid: '38012345' }), paper({ pmid: '38012345', title: 'Title worded differently by another index' }))).toEqual({ same: true, basis: 'pmid' });
    expect(compareIdentity(paper({ pmid: '38012345' }), paper({ pmid: '38012346' }))).toEqual({ same: false, reason: 'pmid_conflict' });
  });

  test('the same base arXiv ID in versions v1 and v2 is the same work; different arXiv IDs are different works', () => {
    expect(compareIdentity(paper({ arxivId: '2401.12345v1' }), paper({ arxivId: 'http://arxiv.org/abs/2401.12345v2', source: 'arxiv', sources: ['arxiv'] }))).toEqual({ same: true, basis: 'arxiv' });
    expect(compareIdentity(paper({ arxivId: '2401.12345' }), paper({ arxivId: '2401.54321' }))).toEqual({ same: false, reason: 'arxiv_conflict' });
  });

  test('a preprint and a record with a publisher DOI stay separate, even when the published record lists the arXiv ID', () => {
    const preprint = paper({ arxivId: '2401.12345v1', source: 'arxiv', sources: ['arxiv'] });
    expect(compareIdentity(preprint, paper({ doi: '10.1000/published', arxivId: '2401.12345', source: 'semantic-scholar', sources: ['semantic-scholar'] }))).toEqual({ same: false, reason: 'preprint_and_published' });
    // Same title, year and author does not override it.
    expect(compareIdentity(preprint, paper({ doi: '10.1000/published' })).same).toBe(false);
  });

  test('an arXiv DOI and an arXiv ID for the same paper are the same work', () => {
    expect(compareIdentity(paper({ doi: '10.48550/arXiv.2401.12345', source: 'datacite', sources: ['datacite'] }), paper({ arxivId: '2401.12345v2', source: 'arxiv', sources: ['arxiv'] }))).toEqual({ same: true, basis: 'arxiv' });
  });

  test('the same OpenAlex, Semantic Scholar or CORE record ID is the same work', () => {
    expect(compareIdentity(paper({ providerIds: { openalex: 'https://openalex.org/W1' } }), paper({ providerIds: { openalex: 'W1' }, title: 'Different wording of the same work' })).same).toBe(true);
    expect(compareIdentity(paper({ providerIds: { semantic_scholar: S2_ID } }), paper({ providerIds: { semantic_scholar: S2_ID }, title: 'Different wording of the same work' })).same).toBe(true);
    expect(compareIdentity(paper({ providerIds: { core: '42' } }), paper({ providerIds: { core: '42' }, title: 'Different wording of the same work' })).same).toBe(true);
  });

  test('a shared provider record ID does not override a conflicting DOI', () => {
    expect(compareIdentity(paper({ doi: '10.1000/a', providerIds: { core: '42' } }), paper({ doi: '10.1000/b', providerIds: { core: '42' } })).same).toBe(false);
  });

  test('a missing year makes the metadata fallback uncertain', () => {
    expect(compareIdentity(paper({ year: 0 }), paper())).toEqual({ same: false, reason: 'uncertain' });
    expect(metadataFingerprint(paper({ year: 0 }))).toBeNull();
  });

  test('without identifiers, an exact title, year and first author is the same work', () => {
    expect(compareIdentity(paper(), paper({ authors: ['Smith, Alice'], year: 2025 }))).toEqual({ same: true, basis: 'metadata_match' });
    expect(compareIdentity(paper(), paper({ authors: ['Bob Jones'] })).same).toBe(false);
  });

  test('similar but not identical titles are never merged', () => {
    expect(compareIdentity(paper(), paper({ title: 'Generative artificial intelligence in postgraduate learnings' })).same).toBe(false);
  });

  test('deduplication keeps conflicting arXiv and PMID records apart even with identical metadata', () => {
    expect(deduplicatePapers([paper({ arxivId: '2401.12345' }), paper({ arxivId: '2401.54321' })])).toHaveLength(2);
    expect(deduplicatePapers([paper({ pmid: '1' }), paper({ pmid: '2' })])).toHaveLength(2);
  });

  test('a record matching two different kept records is ambiguous and merged into neither', () => {
    const byPmid = paper({ pmid: '11111111', title: 'First work found by PMID only here' });
    const byOpenAlex = paper({ providerIds: { openalex: 'W5000' }, title: 'Second work found by OpenAlex only' });
    const both = paper({ pmid: '11111111', providerIds: { openalex: 'W5000' }, title: 'Record claiming both identifiers' });
    const records = deduplicatePapers([byPmid, byOpenAlex, both]);
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.title)).toEqual([byPmid.title, byOpenAlex.title, both.title]);
  });

  test('a record whose identifiers all point to one kept record merges normally', () => {
    const records = deduplicatePapers([
      paper({ pmid: '11111111', providerIds: { openalex: 'W5000' } }),
      paper({ pmid: '11111111', providerIds: { openalex: 'W5000', core: '9' }, source: 'core', sources: ['core'] }),
    ]);
    expect(records).toHaveLength(1);
    expect(identifiersOf(records[0])).toEqual({ pmid: '11111111', openalex: 'W5000', core: '9' });
  });

  test('deduplication merges records sharing a PMID and keeps both provider record IDs', () => {
    const merged = deduplicatePapers([
      paper({ pmid: '38012345', providerIds: { openalex: 'W1' } }),
      paper({ pmid: '38012345', title: 'Same article as indexed by PubMed', source: 'pubmed', sources: ['pubmed'], providerIds: undefined }),
      paper({ pmid: '38012345', source: 'semantic-scholar', sources: ['semantic-scholar'], providerIds: { semantic_scholar: S2_ID } }),
    ]);
    expect(merged).toHaveLength(1);
    // PubMed is the higher-priority identity source.
    expect(merged[0].title).toBe('Same article as indexed by PubMed');
    expect(identifiersOf(merged[0])).toEqual({ pmid: '38012345', openalex: 'W1', semantic_scholar: S2_ID });
  });
});

describe('canonical record input', () => {
  const observedAt = '2026-10-05T00:00:00.000Z';

  test('never includes an abstract', () => {
    const record = canonicalRecordFrom(paper({ abstract: 'A provider abstract.' }), observedAt);
    expect(JSON.stringify(record)).not.toContain('A provider abstract.');
  });

  test('records where each field came from, and citation counts per source', () => {
    const merged = deduplicatePapers([
      paper({ doi: '10.1000/x', source: 'openalex', sources: ['openalex'], citationCount: 12, pdfUrl: 'https://oa.example/x.pdf', fieldProvenance: { title: ['openalex'], doi: ['openalex'], authors: ['openalex'] } }),
      paper({ doi: '10.1000/x', source: 'crossref', sources: ['crossref'], citationCount: 9, journal: 'Journal X', fieldProvenance: { title: ['crossref'], doi: ['crossref'], authors: ['crossref'] } }),
    ])[0];
    const record = canonicalRecordFrom({ ...merged, citationCounts: { ...merged.citationCounts, opencitations: 7 } }, observedAt);

    expect(record.identitySource).toBe('crossref');
    expect(record.fieldProvenance.title).toEqual({ source: 'crossref', corroboratedBy: ['openalex'], observedAt, method: 'provider_record' });
    expect(record.fieldProvenance.doi).toEqual(expect.objectContaining({ source: 'crossref', status: 'registry_record', assertedBy: expect.arrayContaining(['crossref', 'openalex']) }));
    expect(record.fieldProvenance.oaUrl).toEqual({ source: 'openalex', observedAt, method: 'provider_record' });
    expect(record.citationCounts).toEqual({ openalex: { value: 12, observedAt }, crossref: { value: 9, observedAt }, opencitations: { value: 7, observedAt } });
    expect(record.fields.venue).toBe('Journal X');
  });

  test('a DOI reported only by an index is provider-asserted, and status never says verified', () => {
    const record = canonicalRecordFrom(paper({ doi: '10.1000/x', fieldProvenance: { doi: ['openalex'] } }), observedAt);
    expect(record.fieldProvenance.doi?.status).toBe('provider_asserted');
    expect(JSON.stringify(record)).not.toMatch(/verified/);
  });

  test('an open-access link found by Unpaywall is attributed to it as enrichment', () => {
    const record = canonicalRecordFrom(paper({ doi: '10.1000/x', pdfUrl: 'https://oa.example/x.pdf', fieldProvenance: { pdfUrl: ['unpaywall'] } }), observedAt);
    expect(record.fieldProvenance.oaUrl).toEqual({ source: 'unpaywall', observedAt, method: 'enrichment' });
  });

  test('year 0 is stored as missing, and a record without identifiers uses a fingerprint only when it is complete', () => {
    expect(canonicalRecordFrom(paper({ year: 0 }), observedAt)).toEqual(expect.objectContaining({ fingerprint: null, fields: expect.objectContaining({ publicationYear: null }) }));
    expect(canonicalRecordFrom(paper(), observedAt).fingerprint).toBe('generative artificial intelligence in postgraduate learning|2024|smith');
    expect(canonicalRecordFrom(paper({ doi: '10.1000/x' }), observedAt).fingerprint).toBeNull();
  });
});
