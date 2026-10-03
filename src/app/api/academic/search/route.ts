import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import { citationItemFromDiscovered, discoveredPaperFrom, storeSearchResults } from '@/lib/research-search-results';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    const fields = body && typeof body === 'object' && !Array.isArray(body) ? body as { query?: unknown; specialty?: unknown; projectId?: unknown } : {};
    const query = typeof fields.query === 'string' ? fields.query.trim() : '';
    const specialty = typeof fields.specialty === 'string' ? fields.specialty.trim() : '';
    const projectId = typeof fields.projectId === 'string' ? fields.projectId.trim() : '';
    if (query.length < 3 || query.length > 500) return NextResponse.json({ success: false, error: 'أدخل استعلامًا بحثيًا صالحًا.' }, { status: 400 });
    // Results are held on the server for this user and project, so a project is required.
    if (!projectId || !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });
    const result = await UnifiedResearchEngine.searchDetailed({ query, specialty, limit: 25 });
    const resultIds = await storeSearchResults({ userId: access.user.id, projectId, context: 'evidence_panel', query, papers: result.papers, scope: { domain: result.domain, providers: result.providers, candidateCount: result.papers.length } });
    return NextResponse.json({
      success: true,
      data: result.papers.map((paper, index) => {
        // Legacy enrichment scores are not server-authoritative verification.
        // Keep the server-held record intact; contain only the public projection.
        const discovery = { ...paper };
        delete discovery.verificationStatus;
        delete discovery.confidenceScore;
        return {
          ...discovery,
          resultId: resultIds[index],
          id: discoveredPaperFrom(paper).id,
          // Discovery is not verification: display items stay unverified.
          item: citationItemFromDiscovered(discoveredPaperFrom(paper)),
          authorsLabel: paper.authors.join('، ') || 'بيانات المؤلفين غير متاحة',
          year: paper.year || 'د.ت', citationCount: paper.citationCount, abstract: paper.abstract,
          sourceLabel: paper.sources.length > 1 ? 'ظهر في أكثر من فهرس' : 'ظهر في فهرس أكاديمي',
          pdfUrl: paper.pdfUrl || paper.url, doi: paper.doi, relevanceScore: paper.relevanceScore,
        };
      }),
      coverage: { domain: result.domain, availableSources: result.providers.filter((provider) => provider.available).length, attemptedSources: result.providers.length },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'تعذر إكمال البحث الأكاديمي.' }, { status: 500 });
  }
}
