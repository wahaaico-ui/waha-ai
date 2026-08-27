jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/academic/services/UnifiedResearchEngine', () => ({
  UnifiedResearchEngine: { searchDetailed: jest.fn() },
}));
jest.mock('@/lib/academic/services/EmbeddingSimilarity', () => ({ scoreSemanticRelevance: jest.fn() }));

import { POST } from '@/app/api/academic/evidence/route';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { scoreSemanticRelevance } from '@/lib/academic/services/EmbeddingSimilarity';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import type { AcademicPaper } from '@/lib/academic/integrations/types';

const mockedAuth = requireAuthenticatedUser as jest.Mock;
const mockedSearch = UnifiedResearchEngine.searchDetailed as jest.Mock;
const mockedSimilarity = scoreSemanticRelevance as jest.Mock;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;

function paper(index: number): AcademicPaper & { relevanceScore: number } {
  return {
    id: `paper-${index}`,
    title: `Evidence paper ${index}`,
    abstract: `This is a grounded academic abstract for evidence paper ${index}.`,
    year: 2024,
    citationCount: index,
    authors: [`Author ${index}`],
    doi: `10.1000/${index}`,
    pdfUrl: null,
    url: `https://example.org/${index}`,
    source: 'openalex',
    sources: ['openalex'],
    subjects: ['education'],
    publicationType: 'article',
    openAccess: true,
    relevanceScore: 80,
  };
}

function searchResult(count: number) {
  return {
    domain: 'social-humanities' as const,
    providers: [{ provider: 'openalex' as const, available: true, papers: [], durationMs: 10 }],
    papers: Array.from({ length: count }, (_, index) => paper(index + 1)),
  };
}

beforeEach(() => {
  mockedAuth.mockResolvedValue({ user: { id: 'user-1' } });
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  delete process.env.GROQ_API_KEY;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
});

test('evidence API rejects unauthenticated requests before parsing input', async () => {
  mockedAuth.mockResolvedValue(null);
  const response = await POST(new Request('http://localhost/api/academic/evidence', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(401);
  expect(mockedSearch).not.toHaveBeenCalled();
});

test('evidence API rejects invalid and oversized queries', async () => {
  const invalid = await POST(new Request('http://localhost/api/academic/evidence', {
    method: 'POST',
    body: JSON.stringify({ query: 'ab' }),
  }));
  const oversized = await POST(new Request('http://localhost/api/academic/evidence', {
    method: 'POST',
    body: JSON.stringify({ query: 'a'.repeat(501) }),
  }));
  expect(invalid.status).toBe(400);
  expect(oversized.status).toBe(400);
  expect(mockedSearch).not.toHaveBeenCalled();
});

test('evidence API does not invoke embeddings or an LLM when evidence is insufficient', async () => {
  mockedSearch.mockResolvedValue(searchResult(2));
  const fetchSpy = jest.spyOn(global, 'fetch');
  const response = await POST(new Request('http://localhost/api/academic/evidence', {
    method: 'POST',
    body: JSON.stringify({ query: 'artificial intelligence in education' }),
  }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.status).toBe('insufficient_evidence');
  expect(body.retrievedPapers).toBe(2);
  expect(mockedSimilarity).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('evidence API returns grounded papers and structured analysis', async () => {
  mockedSearch.mockResolvedValue(searchResult(3));
  mockedSimilarity.mockResolvedValue([91, 82, null]);
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ confidenceScore: 84, identifiedGaps: [] }) }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const response = await POST(new Request('http://localhost/api/academic/evidence', {
    method: 'POST',
    body: JSON.stringify({ query: 'artificial intelligence in education', specialty: 'education' }),
  }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.status).toBe('complete');
  expect(body.evidenceLayer.confidenceScore).toBe(84);
  expect(body.papers.map((item: { semanticSimilarityIndex: number | null }) => item.semanticSimilarityIndex)).toEqual([91, 82, null]);
  expect(mockedSearch).toHaveBeenCalledWith({ query: 'artificial intelligence in education', specialty: 'education', limit: 10 });
});

test('evidence API preserves retrieved papers when synthesis is unavailable', async () => {
  mockedSearch.mockResolvedValue(searchResult(3));
  mockedSimilarity.mockResolvedValue([70, 70, 70]);
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
  const response = await POST(new Request('http://localhost/api/academic/evidence', {
    method: 'POST',
    body: JSON.stringify({ query: 'artificial intelligence in education' }),
  }));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.status).toBe('evidence_only');
  expect(body.papers).toHaveLength(3);
  expect(body.evidenceLayer).toBeNull();
});
