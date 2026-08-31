jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: jest.fn(),
  ownsProject: jest.fn(),
}));
jest.mock('@/lib/academic/services/UnifiedResearchEngine', () => ({
  UnifiedResearchEngine: { searchDetailed: jest.fn() },
}));

import { POST } from '@/app/api/research/literature/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';

const mockedAuth = requireAuthenticatedUser as jest.Mock;
const mockedOwnership = ownsProject as jest.Mock;
const mockedSearch = UnifiedResearchEngine.searchDetailed as jest.Mock;

afterEach(() => jest.clearAllMocks());

test('literature API returns 401 before accepting a project identifier', async () => {
  mockedAuth.mockResolvedValue(null);
  const response = await POST(new Request('http://localhost/api/research/literature', { method: 'POST', body: JSON.stringify({ projectId: 'other-user-project' }) }));
  expect(response.status).toBe(401);
  expect(mockedSearch).not.toHaveBeenCalled();
});

test('literature API searches only after ownership and saved-stage checks', async () => {
  const documents = [
    { type: 'journey:title', content: JSON.stringify({ title: 'Machine learning in academic education' }) },
    { type: 'journey:methodology', content: JSON.stringify({ approach: 'quantitative' }) },
    { type: 'journey:design', content: JSON.stringify({ variables: [{ name: 'AI use', role: 'independent' }], population: { description: 'Graduate students' }, sample: { strategy: 'Stratified sample' } }) },
    { type: 'journey:verify', content: JSON.stringify({ translatedQuery: 'AI in education', specialty: 'education' }) },
  ];
  const chain = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn() };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.in.mockReturnValue(chain); chain.order.mockResolvedValue({ data: documents, error: null });
  mockedAuth.mockResolvedValue({ user: { id: 'user-1' }, supabase: { from: jest.fn().mockReturnValue(chain) } });
  mockedOwnership.mockResolvedValue(true);
  mockedSearch.mockResolvedValue({
    domain: 'social-humanities',
    providers: [{ provider: 'core', available: true, papers: [{ id: 'p' }], durationMs: 10 }],
    papers: [{ id: 'p', title: 'Machine learning in academic education', abstract: 'Evidence', year: 2025, citationCount: 4, authors: ['A'], doi: '10.1000/p', pdfUrl: null, url: 'https://example.org', source: 'core', sources: ['core'], subjects: ['education'], publicationType: 'article', openAccess: false, relevanceScore: 80 }],
  });
  const response = await POST(new Request('http://localhost/api/research/literature', { method: 'POST', body: JSON.stringify({ projectId: 'project-1' }) }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(mockedOwnership).toHaveBeenCalledWith('project-1', 'user-1', expect.anything());
  expect(body.data).toHaveLength(1);
  expect(body.data[0].source).toBe('سجل أكاديمي موثق');
});
