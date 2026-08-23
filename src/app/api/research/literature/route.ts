import { NextResponse } from 'next/server';

type LiteraturePaper = {
  id: string;
  title: string;
  authors: string;
  year: number | string;
  citationCount: number;
  abstract: string;
  source: 'OpenAlex' | 'Semantic Scholar' | 'OpenAlex + Semantic Scholar';
  pdfUrl: string | null;
};

type OpenAlexWork = {
  id?: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: Array<{ author?: { display_name?: string } }>;
  open_access?: { oa_url?: string | null };
  primary_location?: { pdf_url?: string | null };
};

type SemanticWork = {
  paperId?: string;
  title?: string;
  abstract?: string | null;
  year?: number;
  citationCount?: number;
  url?: string | null;
  authors?: Array<{ name?: string }>;
};

function normaliseTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z؀-ۿ0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function reconstructAbstract(index?: Record<string, number[]>) {
  if (!index) return 'المستخلص غير متوفر';
  const positions: Record<number, string> = {};
  for (const [word, indexes] of Object.entries(index)) {
    indexes.forEach((position) => { positions[position] = word; });
  }
  return Object.keys(positions).map(Number).sort((first, second) => first - second).map((position) => positions[position]).join(' ');
}

export async function POST(request: Request) {
  const { query } = await request.json() as { query?: string };
  if (!query?.trim()) return NextResponse.json({ success: false, error: 'عنوان البحث مطلوب' }, { status: 400 });

  const encodedQuery = encodeURIComponent(query.trim());
  const email = process.env.OPENALEX_EMAIL || 'researcher@waha.ai';
  const semanticHeaders: HeadersInit = process.env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY } : {};

  const [openAlexResult, semanticResult] = await Promise.allSettled([
    fetch(`https://api.openalex.org/works?search=${encodedQuery}&per-page=12&mailto=${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(15000) }),
    fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=12&fields=paperId,title,abstract,year,citationCount,url,authors`, { headers: semanticHeaders, signal: AbortSignal.timeout(15000) }),
  ]);

  const openAlexData = openAlexResult.status === 'fulfilled' && openAlexResult.value.ok
    ? await openAlexResult.value.json() as { results?: OpenAlexWork[] } : { results: [] };
  const semanticData = semanticResult.status === 'fulfilled' && semanticResult.value.ok
    ? await semanticResult.value.json() as { data?: SemanticWork[] } : { data: [] };

  const papers = new Map<string, LiteraturePaper>();
  (openAlexData.results || []).forEach((work) => {
    const title = work.title || 'عنوان غير متوفر';
    papers.set(normaliseTitle(title), { id: work.id || `openalex-${title}`, title, authors: (work.authorships || []).map((author) => author.author?.display_name).filter(Boolean).join('، ') || 'باحثون متعددون', year: work.publication_year || 'د.ت', citationCount: work.cited_by_count || 0, abstract: reconstructAbstract(work.abstract_inverted_index), source: 'OpenAlex', pdfUrl: work.open_access?.oa_url || work.primary_location?.pdf_url || null });
  });
  (semanticData.data || []).forEach((work) => {
    const title = work.title || 'عنوان غير متوفر';
    const key = normaliseTitle(title);
    const existing = papers.get(key);
    const semanticPaper: LiteraturePaper = { id: work.paperId || `semantic-${title}`, title, authors: (work.authors || []).map((author) => author.name).filter(Boolean).join('، ') || 'باحثون متعددون', year: work.year || 'د.ت', citationCount: work.citationCount || 0, abstract: work.abstract || 'المستخلص غير متوفر', source: 'Semantic Scholar', pdfUrl: work.url || null };
    papers.set(key, existing ? { ...existing, source: 'OpenAlex + Semantic Scholar', abstract: existing.abstract === 'المستخلص غير متوفر' ? semanticPaper.abstract : existing.abstract, citationCount: Math.max(existing.citationCount, semanticPaper.citationCount) } : semanticPaper);
  });

  return NextResponse.json({ success: true, data: Array.from(papers.values()).sort((first, second) => second.citationCount - first.citationCount), sources: { openAlex: (openAlexData.results || []).length, semanticScholar: (semanticData.data || []).length } });
}
