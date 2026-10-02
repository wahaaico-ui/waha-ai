jest.mock('@/lib/supabase/authorization', () => ({
  requireAuthenticatedUser: jest.fn(),
  ownsProject: jest.fn(),
}));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => mockResults.client }));
jest.mock('@/lib/academic/services/UnifiedResearchEngine', () => ({
  UnifiedResearchEngine: { searchDetailed: jest.fn() },
}));

import { POST } from '@/app/api/research/literature/route';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import { createSearchResultsFake } from '@/lib/test-support/search-results-fake';

const mockResults = createSearchResultsFake();

const mockedAuth = requireAuthenticatedUser as jest.Mock;
const mockedOwnership = ownsProject as jest.Mock;
const mockedSearch = UnifiedResearchEngine.searchDetailed as jest.Mock;

afterEach(() => jest.clearAllMocks());

test('literature API returns 401 before accepting a project identifier', async () => {
  mockedAuth.mockResolvedValue(null);
  const response = await POST(new Request('http://localhost/api/research/literature', { method: 'POST', body: JSON.stringify({ projectId: 'other-user-project' }) }));
  const body = await response.json();
  expect(response.status).toBe(401);
  expect(response.headers.get('x-waha-request-id')).toBe(body.requestId);
  expect(mockedSearch).not.toHaveBeenCalled();
});

test('literature API searches only after ownership and saved-stage checks', async () => {
  const documents = [
    { type: 'journey:title', content: JSON.stringify({ title: 'Machine learning in academic education' }) },
    { type: 'journey:methodology', content: JSON.stringify({ approach: 'quantitative' }) },
    { type: 'journey:design', content: JSON.stringify({ variables: [{ name: 'AI use', role: 'independent' }], population: { description: 'Graduate students' }, sample: { strategy: 'Stratified sample' } }) },
    { type: 'journey:instrument', content: JSON.stringify({ title: 'Academic questionnaire', consentStatement: 'Participation is voluntary and responses are used only for this research.', instructions: 'Read each statement and select the answer that reflects your experience.', sections: [{ variableName: 'AI use', items: [{ text: 'I use AI tools in academic learning tasks.', kind: 'likert5' }] }] }) },
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
  expect(body.data[0].source).toBe('سجل ظهر في فهرس أكاديمي');
  expect(body.data[0].item).toEqual(expect.objectContaining({ verificationStatus: 'unverified', confidenceScore: 0 }));
  // Each result carries a server-issued id for a row the server holds.
  expect(body.data[0].resultId).toBe(mockResults.rows[0].id);
  expect(mockResults.rows[0]).toEqual(expect.objectContaining({ user_id: 'user-1', project_id: 'project-1', context: 'literature' }));
  expect(mockResults.rows[0].metadata).toEqual(expect.objectContaining({ title: 'Machine learning in academic education', doi: '10.1000/p', providers: ['core'] }));
});
