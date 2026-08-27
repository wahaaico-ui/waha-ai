import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import { CitationResolver } from '@/lib/citations';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    const query = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { query?: unknown }).query === 'string'
      ? (body as { query: string }).query.trim() : '';
    const specialty = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { specialty?: unknown }).specialty === 'string'
      ? (body as { specialty: string }).specialty.trim() : '';
    if (query.length < 3 || query.length > 500) return NextResponse.json({ success: false, error: 'أدخل استعلامًا بحثيًا صالحًا.' }, { status: 400 });
    const result = await UnifiedResearchEngine.searchDetailed({ query, specialty, limit: 25 });
    return NextResponse.json({
      success: true,
      data: result.papers.map((paper) => ({
        ...paper,
        item: CitationResolver.fromPaper(paper),
        authorsLabel: paper.authors.join('، ') || 'بيانات المؤلفين غير متاحة',
        year: paper.year || 'د.ت', citationCount: paper.citationCount, abstract: paper.abstract,
        sourceLabel: paper.sources.length > 1 ? 'تطابق في أكثر من فهرس' : 'سجل من فهرس أكاديمي',
        pdfUrl: paper.pdfUrl || paper.url, doi: paper.doi, relevanceScore: paper.relevanceScore,
      })),
      coverage: { domain: result.domain, availableSources: result.providers.filter((provider) => provider.available).length, attemptedSources: result.providers.length },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر إكمال البحث الأكاديمي.' }, { status: 500 });
  }
}
