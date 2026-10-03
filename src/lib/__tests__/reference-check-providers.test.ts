// The index adapters: real response shapes are read correctly, a 404 for a DOI
// means "no record", and any other failure is thrown so the reference is
// reported as not checked rather than not found.
jest.mock('@/lib/academic/integrations/http', () => {
  const actual = jest.requireActual('@/lib/academic/integrations/http');
  return { ...actual, fetchJson: jest.fn() };
});
jest.mock('@/lib/academic/services/CrossrefService', () => ({ CrossrefService: { searchWorks: jest.fn() } }));
jest.mock('@/lib/academic/services/OpenAlexService', () => ({ OpenAlexService: { searchWorks: jest.fn() } }));

import { ExternalApiError, fetchJson } from '@/lib/academic/integrations/http';
import { crossrefReferenceProvider, openAlexReferenceProvider } from '@/lib/reference-check-providers';

const fetchMock = fetchJson as jest.Mock;
beforeEach(() => fetchMock.mockReset());

test('Crossref and OpenAlex DOI records are read from their response shapes', async () => {
  fetchMock.mockResolvedValueOnce({ message: { DOI: '10.1038/NATURE14539', title: ['Deep learning'], author: [{ given: 'Yann', family: 'LeCun' }], issued: { 'date-parts': [[2015, 5, 27]] }, URL: 'https://doi.org/10.1038/nature14539' } });
  expect(await crossrefReferenceProvider.byDoi('10.1038/nature14539')).toEqual({ provider: 'crossref', title: 'Deep learning', authors: ['Yann LeCun'], year: 2015, doi: '10.1038/nature14539', url: 'https://doi.org/10.1038/nature14539' });
  expect(fetchMock.mock.calls[0][0]).toContain('https://api.crossref.org/works/10.1038%2Fnature14539');

  fetchMock.mockResolvedValueOnce({ id: 'https://openalex.org/W1', title: 'Deep learning', doi: 'https://doi.org/10.1038/nature14539', publication_year: 2015, authorships: [{ author: { display_name: 'Yann LeCun' } }] });
  expect(await openAlexReferenceProvider.byDoi('10.1038/nature14539')).toEqual(expect.objectContaining({ provider: 'openalex', title: 'Deep learning', year: 2015, doi: '10.1038/nature14539', authors: ['Yann LeCun'] }));
});

test('a 404 means the index has no record; other failures are thrown', async () => {
  fetchMock.mockRejectedValueOnce(new ExternalApiError(404, 'not found'));
  expect(await crossrefReferenceProvider.byDoi('10.9999/none')).toBeNull();
  fetchMock.mockRejectedValueOnce(new ExternalApiError(503, 'down'));
  await expect(openAlexReferenceProvider.byDoi('10.9999/none')).rejects.toThrow();
  fetchMock.mockRejectedValueOnce(new Error('network'));
  await expect(crossrefReferenceProvider.byDoi('10.9999/none')).rejects.toThrow();
});
