import { CrossrefService } from '@/lib/academic/services/CrossrefService';

describe('CrossrefService', () => {
  const originalFetch = global.fetch;
  const originalEmail = process.env.CROSSREF_EMAIL;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEmail === undefined) delete process.env.CROSSREF_EMAIL;
    else process.env.CROSSREF_EMAIL = originalEmail;
    jest.restoreAllMocks();
  });

  it('identifies the application and normalises Crossref metadata', async () => {
    process.env.CROSSREF_EMAIL = 'research@example.com';
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      message: {
        items: [{
          DOI: '10.1000/TEST',
          title: ['<b>Useful</b> research'],
          abstract: '<jats:p>An &amp; abstract</jats:p>',
          author: [{ given: 'Ada', family: 'Lovelace' }],
          published: { 'date-parts': [[2025, 3, 1]] },
          'is-referenced-by-count': 12,
          URL: 'https://doi.org/10.1000/TEST',
        }],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    global.fetch = fetchMock;

    const result = await CrossrefService.searchWorks('useful research', 500);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      doi: '10.1000/test',
      title: 'Useful research',
      abstract: 'An & abstract',
      year: 2025,
      citationCount: 12,
      authors: ['Ada Lovelace'],
      url: 'https://doi.org/10.1000/TEST',
    });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('rows=100');
    expect(url).toContain('mailto=research%40example.com');
    expect(new Headers(options.headers).get('User-Agent')).toContain('research@example.com');
  });

  it('throws on an unavailable Crossref response so the aggregator can fall back', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 429 }));
    await expect(CrossrefService.searchWorks('topic')).rejects.toThrow('429');
  });
});
