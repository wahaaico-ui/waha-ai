import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { filterRelevantPapers, paperRelevanceScore, type EvidencePaper } from '@/lib/research-exploration';

type LiteraturePaper = {
  id: string;
  title: string;
  authors: string;
  year: number | string;
  citationCount: number;
  abstract: string;
  source: 'OpenAlex' | 'Semantic Scholar' | 'OpenAlex + Semantic Scholar';
  pdfUrl: string | null;
  relevanceScore: number;
};

type OpenAlexWork = {
  id?: string;
  doi?: string | null;
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
  openAccessPdf?: { url?: string | null } | null;
  authors?: Array<{ name?: string }>;
};

function normaliseTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z؀-ۿ0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function reconstructAbstract(index?: Record<string, number[]>) {
  if (!index) return '';
  const positions: Record<number, string> = {};
  for (const [word, indexes] of Object.entries(index)) indexes.forEach((position) => { positions[position] = word; });
  return Object.keys(positions).map(Number).sort((first, second) => first - second).map((position) => positions[position]).join(' ').slice(0, 4_000);
}

function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
}

function parseDocument(content: string | null) {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function asEvidence(paper: LiteraturePaper): EvidencePaper {
  return {
    title: paper.title,
    abstract: paper.abstract,
    year: typeof paper.year === 'number' ? paper.year : 0,
    citations: paper.citationCount,
    url: paper.pdfUrl || '',
    source: paper.source === 'OpenAlex' ? 'openalex' : paper.source === 'Semantic Scholar' ? 'semanticscholar' : 'both',
  };
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ success: false, error: 'يجب تسجيل الدخول للبحث داخل أدبيات مشروعك.' }, { status: 401 });

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'طلب غير صالح.' }, { status: 400 });
    const { projectId } = body as { projectId?: unknown };
    if (typeof projectId !== 'string' || !projectId.trim()) return NextResponse.json({ success: false, error: 'معرّف المشروع مطلوب.' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });

    const { data: documents, error: documentsError } = await access.supabase
      .from('documents')
      .select('type, content, version, created_at')
      .eq('project_id', projectId)
      .in('type', ['journey:title', 'journey:methodology'])
      .order('created_at', { ascending: false });
    if (documentsError) throw documentsError;

    const titleOutput = parseDocument((documents || []).find((document) => document.type === 'journey:title')?.content || null);
    const methodologyOutput = parseDocument((documents || []).find((document) => document.type === 'journey:methodology')?.content || null);
    const title = typeof titleOutput?.title === 'string' ? titleOutput.title.trim() : '';
    if (title.length < 10 || !methodologyOutput) return NextResponse.json({ success: false, error: 'اعتمد العنوان والمنهجية داخل المشروع قبل البحث في الأدبيات.' }, { status: 409 });

    const encodedQuery = encodeURIComponent(title);
    const email = process.env.OPENALEX_EMAIL;
    const mailto = email ? `&mailto=${encodeURIComponent(email)}` : '';
    const semanticHeaders: HeadersInit = process.env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY } : {};
    const [openAlexResult, semanticResult] = await Promise.allSettled([
      fetch(`https://api.openalex.org/works?search=${encodedQuery}&per-page=25${mailto}`, { signal: AbortSignal.timeout(15_000) }),
      fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=25&fields=paperId,title,abstract,year,citationCount,url,openAccessPdf,authors`, { headers: semanticHeaders, signal: AbortSignal.timeout(15_000) }),
    ]);

    const openAlexAvailable = openAlexResult.status === 'fulfilled' && openAlexResult.value.ok;
    const semanticAvailable = semanticResult.status === 'fulfilled' && semanticResult.value.ok;
    if (!openAlexAvailable && !semanticAvailable) return NextResponse.json({ success: false, error: 'تعذر الوصول إلى مصادر الأدبيات حالياً. أعد المحاولة لاحقاً.' }, { status: 503 });

    const openAlexData = openAlexAvailable ? await openAlexResult.value.json() as { results?: OpenAlexWork[] } : { results: [] };
    const semanticData = semanticAvailable ? await semanticResult.value.json() as { data?: SemanticWork[] } : { data: [] };
    const papers = new Map<string, LiteraturePaper>();

    (openAlexData.results || []).forEach((work) => {
      const titleValue = work.title?.trim();
      if (!titleValue) return;
      const abstract = reconstructAbstract(work.abstract_inverted_index);
      const pdfUrl = safeExternalUrl(work.open_access?.oa_url || work.primary_location?.pdf_url || (work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : null));
      papers.set(normaliseTitle(titleValue), { id: (work.id || `openalex-${normaliseTitle(titleValue)}`).slice(0, 500), title: titleValue.slice(0, 500), authors: ((work.authorships || []).map((author) => author.author?.display_name).filter(Boolean).join('، ') || 'بيانات المؤلفين غير متاحة').slice(0, 1_000), year: work.publication_year || 'د.ت', citationCount: work.cited_by_count || 0, abstract, source: 'OpenAlex', pdfUrl, relevanceScore: 0 });
    });
    (semanticData.data || []).forEach((work) => {
      const titleValue = work.title?.trim();
      if (!titleValue) return;
      const key = normaliseTitle(titleValue);
      const existing = papers.get(key);
      const semanticPaper: LiteraturePaper = { id: (work.paperId || `semantic-${key}`).slice(0, 500), title: titleValue.slice(0, 500), authors: ((work.authors || []).map((author) => author.name).filter(Boolean).join('، ') || 'بيانات المؤلفين غير متاحة').slice(0, 1_000), year: work.year || 'د.ت', citationCount: work.citationCount || 0, abstract: (work.abstract || '').slice(0, 4_000), source: 'Semantic Scholar', pdfUrl: safeExternalUrl(work.openAccessPdf?.url || work.url), relevanceScore: 0 };
      papers.set(key, existing ? { ...existing, source: 'OpenAlex + Semantic Scholar', abstract: existing.abstract || semanticPaper.abstract, pdfUrl: existing.pdfUrl || semanticPaper.pdfUrl, citationCount: Math.max(existing.citationCount, semanticPaper.citationCount) } : semanticPaper);
    });

    const candidates = Array.from(papers.values());
    const relevantEvidence = filterRelevantPapers(candidates.map(asEvidence), [title]);
    const relevantTitles = new Set(relevantEvidence.map((paper) => normaliseTitle(paper.title)));
    const relevant = candidates
      .filter((paper) => relevantTitles.has(normaliseTitle(paper.title)))
      .map((paper) => ({ ...paper, relevanceScore: Math.round(paperRelevanceScore(asEvidence(paper), [title]) * 100) }))
      .sort((first, second) => (second.relevanceScore - first.relevanceScore) || (second.citationCount - first.citationCount));

    return NextResponse.json({
      success: true,
      query: title,
      data: relevant,
      searchCoverage: {
        candidateResults: candidates.length,
        relevantResults: relevant.length,
        excludedByRelevance: candidates.length - relevant.length,
        searchedAt: new Date().toISOString(),
        sources: [
          { name: 'OpenAlex', available: openAlexAvailable, returned: (openAlexData.results || []).length },
          { name: 'Semantic Scholar', available: semanticAvailable, returned: (semanticData.data || []).length },
        ],
        note: 'العدد يصف النتائج ذات الصلة ضمن أول 25 نتيجة من كل مصدر في هذا الفحص، وليس جميع ما نُشر عالمياً.',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر إكمال البحث في الأدبيات حالياً.' }, { status: 500 });
  }
}
