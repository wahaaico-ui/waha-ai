jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/academic/services/UnifiedResearchEngine', () => ({
  UnifiedResearchEngine: { searchDetailed: jest.fn() },
}));

import { POST } from '@/app/api/academic/gaps/route';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import type { AcademicPaper } from '@/lib/academic/integrations/types';

const mockedAuth = requireAuthenticatedUser as jest.Mock;
const mockedSearch = UnifiedResearchEngine.searchDetailed as jest.Mock;
const originalGeminiKey = process.env.GEMINI_API_KEY;

function paper(index: number): AcademicPaper & { relevanceScore: number } {
  return {
    id: `gap-paper-${index}`,
    title: `Gap evidence paper ${index}`,
    abstract: `A sufficiently detailed abstract that supports a grounded analysis for paper ${index}.`,
    year: 2023,
    citationCount: index * 2,
    authors: [`Researcher ${index}`],
    doi: `10.2000/${index}`,
    pdfUrl: null,
    url: `https://example.org/gaps/${index}`,
    source: 'crossref',
    sources: ['crossref'],
    subjects: ['methodology'],
    publicationType: 'article',
    openAccess: false,
    relevanceScore: 75,
  };
}

function searchResult(count: number) {
  return {
    domain: 'general' as const,
    providers: [{ provider: 'crossref' as const, available: true, papers: [], durationMs: 15 }],
    papers: Array.from({ length: count }, (_, index) => paper(index + 1)),
  };
}

beforeEach(() => {
  mockedAuth.mockResolvedValue({ user: { id: 'user-1' } });
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
});

test('gaps API rejects unauthenticated requests', async () => {
  mockedAuth.mockResolvedValue(null);
  const response = await POST(new Request('http://localhost/api/academic/gaps', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(401);
  expect(mockedSearch).not.toHaveBeenCalled();
});

test('gaps API validates the research topic before searching', async () => {
  const response = await POST(new Request('http://localhost/api/academic/gaps', {
    method: 'POST',
    body: JSON.stringify({ domain: '  ' }),
  }));
  expect(response.status).toBe(400);
  expect(mockedSearch).not.toHaveBeenCalled();
});

test('gaps API refuses to generate a report from fewer than three papers', async () => {
  mockedSearch.mockResolvedValue(searchResult(2));
  const fetchSpy = jest.spyOn(global, 'fetch');
  const response = await POST(new Request('http://localhost/api/academic/gaps', {
    method: 'POST',
    body: JSON.stringify({ domain: 'digital education' }),
  }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.status).toBe('insufficient_evidence');
  expect(body.retrievedPapers).toBe(2);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('gaps API generates a report only after unified retrieval succeeds', async () => {
  mockedSearch.mockResolvedValue(searchResult(3));
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'تقرير فجوات موثق بالأدلة.' }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  const response = await POST(new Request('http://localhost/api/academic/gaps', {
    method: 'POST',
    body: JSON.stringify({ domain: 'digital education', specialty: 'education' }),
  }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.status).toBe('complete');
  expect(body.groundedInPapers).toBe(3);
  expect(body.report).toBe('تقرير فجوات موثق بالأدلة.');
  expect(mockedSearch).toHaveBeenCalledWith({ query: 'digital education', specialty: 'education', limit: 12 });
});

test('gaps API returns a controlled unavailable status when analysis provider fails', async () => {
  mockedSearch.mockResolvedValue(searchResult(3));
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('service unavailable', { status: 503 }));
  const response = await POST(new Request('http://localhost/api/academic/gaps', {
    method: 'POST',
    body: JSON.stringify({ domain: 'digital education' }),
  }));
  const body = await response.json();
  expect(response.status).toBe(503);
  expect(body.status).toBe('analysis_unavailable');
  expect(body.retrievedPapers).toBe(3);
  expect(JSON.stringify(body)).not.toContain('service unavailable');
});
