import { ArxivService } from '@/lib/academic/services/ArxivService';
import { CoreService } from '@/lib/academic/services/CoreService';
import { DOABService } from '@/lib/academic/services/DOABService';
import { DataCiteService } from '@/lib/academic/services/DataCiteService';
import { EuropePMCService } from '@/lib/academic/services/EuropePMCService';
import { OpenAIREService } from '@/lib/academic/services/OpenAIREService';
import { OpenCitationsService } from '@/lib/academic/services/OpenCitationsService';
import { ORCIDService } from '@/lib/academic/services/ORCIDService';
import { PLOSService } from '@/lib/academic/services/PLOSService';
import { PubMedService } from '@/lib/academic/services/PubMedService';
import { CrossrefService } from '@/lib/academic/services/CrossrefService';
import { OpenAlexService } from '@/lib/academic/services/OpenAlexService';
import { SemanticScholarService } from '@/lib/academic/services/SemanticScholarService';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import { deduplicatePapers } from '@/lib/academic/integrations/normalization';
import { detectAcademicDomain, providersForDomain } from '@/lib/academic/integrations/routing';
import type { AcademicPaper, SearchOptions } from '@/lib/academic/integrations/types';
import { resilientFetch } from '@/lib/academic/integrations/http';

const options: SearchOptions = { query: 'machine learning', limit: 5, domain: 'computing' };
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  delete process.env.ORCID_CLIENT_ID;
  delete process.env.ORCID_CLIENT_SECRET;
  delete process.env.SEMANTIC_SCHOLAR_API_KEY;
  delete process.env.SEMANTIC_SCHOLAR_API_KEY_2;
});

describe('academic provider adapters', () => {
  test('normalises CORE metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ results: [{ id: 1, title: 'Core paper', doi: '10.1000/CORE', yearPublished: 2025, authors: [{ name: 'A Author' }], downloadUrl: 'https://example.org/a.pdf' }] }));
    const [paper] = await new CoreService().search(options);
    expect(paper).toMatchObject({ title: 'Core paper', doi: '10.1000/core', source: 'core', openAccess: true });
  });

  test('parses arXiv Atom and keeps the PDF link', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<feed><entry><id>https://arxiv.org/abs/1</id><title>Arxiv paper</title><summary>Abstract</summary><published>2025-01-01</published><author><name>Ada</name></author><link href="https://arxiv.org/pdf/1" type="application/pdf"/><category term="cs.AI"/></entry></feed>', { status: 200 }));
    const [paper] = await new ArxivService().search(options);
    expect(paper).toMatchObject({ title: 'Arxiv paper', year: 2025, authors: ['Ada'], source: 'arxiv' });
  });

  test('normalises Europe PMC biomedical metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ resultList: { result: [{ pmid: '1', title: 'Medical paper', doi: '10.1000/MED', pubYear: '2024', authorString: 'A One, B Two', isOpenAccess: 'Y' }] } }));
    const [paper] = await new EuropePMCService().search(options);
    expect(paper).toMatchObject({ doi: '10.1000/med', source: 'europe-pmc', openAccess: true });
  });

  test('normalises OpenAIRE repository metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ results: [{ id: 'o1', mainTitle: 'Repository paper', publicationDate: '2023-02-01', pids: [{ scheme: 'doi', value: '10.1000/OA' }], authors: [{ fullName: 'Researcher' }], bestAccessRight: { label: 'Open Access' } }] }));
    const [paper] = await new OpenAIREService().search(options);
    expect(paper).toMatchObject({ doi: '10.1000/oa', source: 'openaire', openAccess: true });
  });

  test('normalises PLOS records without fabricating a journal-specific PDF URL', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ response: { docs: [{ id: '10.1371/journal.pbio.1', title_display: 'PLOS paper', publication_date: '2022-01-01' }] } }));
    const [paper] = await new PLOSService().search(options);
    expect(paper).toMatchObject({ source: 'plos', openAccess: true, pdfUrl: null });
  });

  test('normalises DOAB book metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue(json([{ uuid: 'book', name: 'Open book', metadata: [{ key: 'dc.identifier.doi', value: '10.1000/book' }, { key: 'dc.date.issued', value: '2021' }] }]));
    const [paper] = await new DOABService().search(options);
    expect(paper).toMatchObject({ publicationType: 'book', doi: '10.1000/book', source: 'doab' });
  });

  test('normalises DataCite research objects', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({ data: [{ id: '10.1000/data', attributes: { doi: '10.1000/data', titles: [{ title: 'Dataset' }], creators: [{ name: 'Creator' }], publicationYear: 2026, types: { resourceTypeGeneral: 'Dataset' } } }] }));
    const [paper] = await new DataCiteService().search(options);
    expect(paper).toMatchObject({ title: 'Dataset', publicationType: 'Dataset', source: 'datacite' });
  });

  test('uses PubMed ESearch then ESummary', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(json({ esearchresult: { idlist: ['42'] } }))
      .mockResolvedValueOnce(json({ result: { 42: { uid: '42', title: 'PubMed paper', pubdate: '2020', authors: [{ name: 'Author' }], articleids: [{ idtype: 'doi', value: '10.1000/pm' }] } } }));
    const [paper] = await new PubMedService().search(options);
    expect(paper).toMatchObject({ id: '42', doi: '10.1000/pm', source: 'pubmed' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('reads an OpenCitations citation count', async () => {
    global.fetch = jest.fn().mockResolvedValue(json([{ count: '17' }]));
    await expect(OpenCitationsService.citationCount('10.1000/TEST')).resolves.toBe(17);
  });

  test('retries Semantic Scholar with the backup key after primary throttling', async () => {
    process.env.SEMANTIC_SCHOLAR_API_KEY = 'primary-key';
    process.env.SEMANTIC_SCHOLAR_API_KEY_2 = 'backup-key';
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '30' } }))
      .mockResolvedValueOnce(json({ data: [{ paperId: 'paper-1', title: 'Recovered paper', year: 2025 }] }));

    await expect(SemanticScholarService.searchPapers('reliable research', 1)).resolves.toEqual([
      expect.objectContaining({ paperId: 'paper-1', title: 'Recovered paper' }),
    ]);
    expect(global.fetch).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'primary-key' }) }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'backup-key' }) }));
  });

  test('authenticates ORCID server-side before public search', async () => {
    process.env.ORCID_CLIENT_ID = 'client'; process.env.ORCID_CLIENT_SECRET = 'secret';
    global.fetch = jest.fn()
      .mockResolvedValueOnce(json({ access_token: 'token' }))
      .mockResolvedValueOnce(json({ result: [{ 'orcid-identifier': { path: '0000-0001', uri: 'https://orcid.org/0000-0001' } }] }));
    await expect(ORCIDService.searchResearcher('Ada')).resolves.toEqual([{ orcid: '0000-0001', uri: 'https://orcid.org/0000-0001' }]);
  });
});

describe('routing and cross-source deduplication', () => {
  test('honours a long Retry-After by failing gracefully instead of retrying too early', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '30' } }));
    await expect(resilientFetch('https://example.org')).rejects.toThrow('retry after 30 seconds');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('routes biomedical and humanities queries only to appropriate sources', () => {
    expect(detectAcademicDomain('clinical nursing intervention')).toBe('biomedical');
    expect(providersForDomain('biomedical')).toEqual(expect.arrayContaining(['pubmed', 'europe-pmc']));
    expect(providersForDomain('social-humanities')).toEqual(expect.arrayContaining(['openaire', 'doab']));
    expect(providersForDomain('social-humanities')).not.toContain('pubmed');
  });

  test('merges duplicate DOI metadata and keeps all provenance', () => {
    const base: AcademicPaper = { id: 'one', title: 'Same Study', abstract: '', year: 2025, citationCount: 2, authors: ['A'], doi: '10.1000/x', pdfUrl: null, url: null, source: 'crossref', sources: ['crossref'], subjects: [], publicationType: 'article', openAccess: false };
    const merged = deduplicatePapers([base, { ...base, id: 'two', abstract: 'Full abstract', citationCount: 9, pdfUrl: 'https://example.org/x.pdf', source: 'core', sources: ['core'], openAccess: true }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ abstract: 'Full abstract', citationCount: 9, openAccess: true });
    expect(merged[0].sources).toEqual(expect.arrayContaining(['crossref', 'core']));
  });

  test('keeps the complete search alive when one routed provider fails', async () => {
    const paper: AcademicPaper = { id: 'ok', title: 'Reliable academic result', abstract: 'Evidence about the requested topic', year: 2025, citationCount: 1, authors: ['A'], doi: null, pdfUrl: null, url: 'https://example.org', source: 'core', sources: ['core'], subjects: [], publicationType: 'article', openAccess: false };
    jest.spyOn(OpenAlexService.prototype, 'search').mockRejectedValue(new Error('temporary 503'));
    jest.spyOn(SemanticScholarService.prototype, 'search').mockResolvedValue([]);
    jest.spyOn(CrossrefService.prototype, 'search').mockResolvedValue([]);
    jest.spyOn(CoreService.prototype, 'search').mockResolvedValue([paper]);
    jest.spyOn(OpenAIREService.prototype, 'search').mockResolvedValue([]);
    jest.spyOn(DataCiteService.prototype, 'search').mockResolvedValue([]);
    const result = await UnifiedResearchEngine.searchDetailed({ query: 'reliable academic topic', limit: 5 });
    expect(result.papers).toHaveLength(1);
    expect(result.providers.find((provider) => provider.provider === 'openalex')?.available).toBe(false);
    expect(result.providers.find((provider) => provider.provider === 'core')?.available).toBe(true);
  });
});
