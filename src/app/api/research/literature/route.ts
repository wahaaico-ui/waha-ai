import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { filterRelevantPapers, paperRelevanceScore, type EvidencePaper } from '@/lib/research-exploration';
import { CrossrefService, type CrossrefPaper } from '@/lib/academic/services/CrossrefService';

type LiteraturePaper = {
  id: string;
  title: string;
  authors: string;
  year: number | string;
  citationCount: number;
  abstract: string;
  source: string;
  pdfUrl: string | null;
  relevanceScore: number;
  doi?: string | null;
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
  externalIds?: { DOI?: string | null } | null;
};

function normaliseTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z؀-ۿ0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function normaliseDoi(doi: string | null | undefined) {
  return doi?.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '') || null;
}

function paperKey(doi: string | null | undefined, title: string) {
  const normalisedDoi = normaliseDoi(doi);
  return normalisedDoi ? `doi:${normalisedDoi}` : `title:${normaliseTitle(title)}`;
}

function mergeSource(first: string, second: string) {
  return [...new Set([...first.split(' + '), ...second.split(' + ')])].join(' + ');
}

function mergePaper(existing: LiteraturePaper | undefined, incoming: LiteraturePaper): LiteraturePaper {
  if (!existing) return incoming;
  return {
    ...existing,
    doi: existing.doi || incoming.doi,
    source: mergeSource(existing.source, incoming.source),
    abstract: existing.abstract || incoming.abstract,
    authors: existing.authors === 'بيانات المؤلفين غير متاحة' ? incoming.authors : existing.authors,
    year: existing.year === 'د.ت' ? incoming.year : existing.year,
    pdfUrl: existing.pdfUrl || incoming.pdfUrl,
    citationCount: Math.max(existing.citationCount, incoming.citationCount),
  };
}

function upsertPaper(papers: Map<string, LiteraturePaper>, incoming: LiteraturePaper) {
  const incomingDoi = normaliseDoi(incoming.doi);
  const incomingTitle = normaliseTitle(incoming.title);
  const existingEntry = [...papers.entries()].find(([, paper]) => {
    const existingDoi = normaliseDoi(paper.doi);
    if (incomingDoi && existingDoi) return incomingDoi === existingDoi;
    return normaliseTitle(paper.title) === incomingTitle;
  });
  const key = paperKey(incomingDoi, incoming.title);
  if (existingEntry && existingEntry[0] !== key) papers.delete(existingEntry[0]);
  papers.set(key, mergePaper(existingEntry?.[1] || papers.get(key), incoming));
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
    source: paper.source === 'Semantic Scholar' ? 'semanticscholar' : paper.source.includes('Semantic Scholar') ? 'both' : 'openalex',
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
      .in('type', ['journey:verify', 'journey:title', 'journey:methodology'])
      .order('created_at', { ascending: false });
    if (documentsError) throw documentsError;

    const titleOutput = parseDocument((documents || []).find((document) => document.type === 'journey:title')?.content || null);
    const methodologyOutput = parseDocument((documents || []).find((document) => document.type === 'journey:methodology')?.content || null);
    const verificationOutput = parseDocument((documents || []).find((document) => document.type === 'journey:verify')?.content || null);
    const title = typeof titleOutput?.title === 'string' ? titleOutput.title.trim() : '';
    if (title.length < 10 || !methodologyOutput) return NextResponse.json({ success: false, error: 'اعتمد العنوان والمنهجية داخل المشروع قبل البحث في الأدبيات.' }, { status: 409 });

    const selectedPath = verificationOutput?.selectedResearchPath && typeof verificationOutput.selectedResearchPath === 'object'
      ? verificationOutput.selectedResearchPath as Record<string, unknown>
      : null;
    const queries = [...new Set([
      title,
      typeof verificationOutput?.translatedQuery === 'string' ? verificationOutput.translatedQuery.trim() : '',
      typeof selectedPath?.title === 'string' ? selectedPath.title.trim() : '',
      typeof verificationOutput?.topic === 'string' ? verificationOutput.topic.trim() : '',
    ].filter((query) => query.length >= 5))].slice(0, 4);
    const email = process.env.OPENALEX_EMAIL;
    const mailto = email ? `&mailto=${encodeURIComponent(email)}` : '';
    const semanticHeaders: HeadersInit = process.env.SEMANTIC_SCHOLAR_API_KEY ? { 'x-api-key': process.env.SEMANTIC_SCHOLAR_API_KEY } : {};
    const searches = await Promise.allSettled(queries.flatMap((query) => {
      const encodedQuery = encodeURIComponent(query);
      return [
        fetch(`https://api.openalex.org/works?search=${encodedQuery}&per-page=25${mailto}`, { signal: AbortSignal.timeout(15_000) }).then(async (response) => ({ provider: 'openalex' as const, available: response.ok, payload: response.ok ? await response.json() as { results?: OpenAlexWork[] } : { results: [] } })),
        fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=25&fields=paperId,title,abstract,year,citationCount,url,openAccessPdf,authors,externalIds`, { headers: semanticHeaders, signal: AbortSignal.timeout(15_000) }).then(async (response) => ({ provider: 'semantic' as const, available: response.ok, payload: response.ok ? await response.json() as { data?: SemanticWork[] } : { data: [] } })),
        CrossrefService.searchWorks(query, 25).then((items) => ({ provider: 'crossref' as const, available: true, payload: { items } })),
      ];
    }));

    const fulfilled = searches.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    const openAlexAvailable = fulfilled.some((result) => result.provider === 'openalex' && result.available);
    const semanticAvailable = fulfilled.some((result) => result.provider === 'semantic' && result.available);
    const crossrefAvailable = fulfilled.some((result) => result.provider === 'crossref' && result.available);
    if (!openAlexAvailable && !semanticAvailable && !crossrefAvailable) return NextResponse.json({ success: false, error: 'تعذر الوصول إلى مصادر الأدبيات حالياً. أعد المحاولة لاحقاً.' }, { status: 503 });
    const openAlexWorks = fulfilled.flatMap((result) => result.provider === 'openalex' && result.available && 'results' in result.payload ? result.payload.results || [] : []);
    const semanticWorks = fulfilled.flatMap((result) => result.provider === 'semantic' && result.available && 'data' in result.payload ? result.payload.data || [] : []);
    const crossrefWorks = fulfilled.flatMap((result) => result.provider === 'crossref' && result.available && 'items' in result.payload ? result.payload.items || [] : []) as CrossrefPaper[];
    const papers = new Map<string, LiteraturePaper>();

    openAlexWorks.forEach((work) => {
      const titleValue = work.title?.trim();
      if (!titleValue) return;
      const abstract = reconstructAbstract(work.abstract_inverted_index);
      const pdfUrl = safeExternalUrl(work.open_access?.oa_url || work.primary_location?.pdf_url || (work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : null));
      const doi = normaliseDoi(work.doi);
      const paper = { id: (work.id || `openalex-${normaliseTitle(titleValue)}`).slice(0, 500), doi, title: titleValue.slice(0, 500), authors: ((work.authorships || []).map((author) => author.author?.display_name).filter(Boolean).join('، ') || 'بيانات المؤلفين غير متاحة').slice(0, 1_000), year: work.publication_year || 'د.ت', citationCount: work.cited_by_count || 0, abstract, source: 'OpenAlex', pdfUrl, relevanceScore: 0 } satisfies LiteraturePaper;
      upsertPaper(papers, paper);
    });
    semanticWorks.forEach((work) => {
      const titleValue = work.title?.trim();
      if (!titleValue) return;
      const doi = normaliseDoi(work.externalIds?.DOI);
      const key = paperKey(doi, titleValue);
      const semanticPaper: LiteraturePaper = { id: (work.paperId || `semantic-${key}`).slice(0, 500), doi, title: titleValue.slice(0, 500), authors: ((work.authors || []).map((author) => author.name).filter(Boolean).join('، ') || 'بيانات المؤلفين غير متاحة').slice(0, 1_000), year: work.year || 'د.ت', citationCount: work.citationCount || 0, abstract: (work.abstract || '').slice(0, 4_000), source: 'Semantic Scholar', pdfUrl: safeExternalUrl(work.openAccessPdf?.url || work.url), relevanceScore: 0 };
      upsertPaper(papers, semanticPaper);
    });
    crossrefWorks.forEach((work) => {
      const crossrefPaper: LiteraturePaper = { id: (work.doi ? `crossref-${work.doi}` : `crossref-${normaliseTitle(work.title)}`).slice(0, 500), doi: work.doi, title: work.title.slice(0, 500), authors: (work.authors.join('، ') || 'بيانات المؤلفين غير متاحة').slice(0, 1_000), year: work.year || 'د.ت', citationCount: work.citationCount, abstract: work.abstract, source: 'Crossref', pdfUrl: safeExternalUrl(work.url), relevanceScore: 0 };
      upsertPaper(papers, crossrefPaper);
    });

    const candidates = Array.from(papers.values());
    const relevantEvidence = filterRelevantPapers(candidates.map(asEvidence), queries);
    const relevantTitles = new Set(relevantEvidence.map((paper) => normaliseTitle(paper.title)));
    const relevant = candidates
      .filter((paper) => relevantTitles.has(normaliseTitle(paper.title)))
      .map((paper) => ({ ...paper, relevanceScore: Math.round(paperRelevanceScore(asEvidence(paper), queries) * 100) }))
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
          { name: 'academic-index-a', available: openAlexAvailable, returned: openAlexWorks.length },
          { name: 'academic-index-b', available: semanticAvailable, returned: semanticWorks.length },
          { name: 'doi-registry', available: crossrefAvailable, returned: crossrefWorks.length },
        ],
        note: relevant.length >= 3
          ? 'عُثر على تغطية أولية صالحة للمراجعة. اقرأ الملخص والنص الكامل قبل اعتماد أي دراسة.'
          : 'التغطية الحالية غير كافية للحكم على غياب الدراسات؛ جرّب توسيع المفاهيم أو مراجعة صياغة العنوان.',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر إكمال البحث في الأدبيات حالياً.' }, { status: 500 });
  }
}
