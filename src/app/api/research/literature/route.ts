import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import { normaliseTitle } from '@/lib/academic/integrations/normalization';
import { CitationResolver } from '@/lib/citations';
import { completeOperationalRequest, operationalHeaders, startOperationalRequest } from '@/lib/observability';

function parseDocument(content: string | null) {
  if (!content) return null;
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  const operation = startOperationalRequest(request, '/api/research/literature', 'api.research.literature.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.research.literature.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, { status, headers: operationalHeaders(operation) });
  };
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return respond({ success: false, error: 'يجب تسجيل الدخول للبحث داخل أدبيات مشروعك.' }, 401, 'unauthorized');
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return respond({ success: false, error: 'طلب غير صالح.' }, 400, 'invalid_request');
    const { projectId } = body as { projectId?: unknown };
    if (typeof projectId !== 'string' || !projectId.trim()) return respond({ success: false, error: 'معرّف المشروع مطلوب.' }, 400, 'invalid_project_id');
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return respond({ success: false, error: 'المشروع غير موجود.' }, 404, 'project_not_found');

    const { data: documents, error } = await access.supabase
      .from('documents')
      .select('type, content, created_at')
      .eq('project_id', projectId)
      .in('type', ['journey:verify', 'journey:title', 'journey:methodology', 'journey:design', 'journey:instrument'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    const latest = (type: string) => parseDocument((documents || []).find((document) => document.type === type)?.content || null);
    const titleOutput = latest('journey:title');
    const methodologyOutput = latest('journey:methodology');
    const designOutput = latest('journey:design');
    const instrumentOutput = latest('journey:instrument');
    const verificationOutput = latest('journey:verify');
    const title = typeof titleOutput?.title === 'string' ? titleOutput.title.trim() : '';
    if (title.length < 10 || !methodologyOutput || !designOutput || !instrumentOutput) return respond({ success: false, error: 'اعتمد العنوان والمنهجية وتصميم الدراسة وأداة الدراسة داخل المشروع قبل البحث في الأدبيات.' }, 409, 'prerequisites_missing');

    const selectedPath = verificationOutput?.selectedResearchPath && typeof verificationOutput.selectedResearchPath === 'object'
      ? verificationOutput.selectedResearchPath as Record<string, unknown> : null;
    const queries = [...new Set([
      title,
      typeof verificationOutput?.translatedQuery === 'string' ? verificationOutput.translatedQuery.trim() : '',
      typeof selectedPath?.title === 'string' ? selectedPath.title.trim() : '',
      typeof verificationOutput?.topic === 'string' ? verificationOutput.topic.trim() : '',
    ].filter((query) => query.length >= 5))].slice(0, 4);
    const specialty = typeof verificationOutput?.specialty === 'string'
      ? verificationOutput.specialty
      : typeof selectedPath?.field === 'string' ? selectedPath.field : '';

    const result = await UnifiedResearchEngine.searchDetailed({ query: title, alternateQueries: queries.slice(1), specialty, limit: 40 });
    const availableProviders = result.providers.filter((provider) => provider.available);
    if (!availableProviders.length) return respond({ success: false, error: 'تعذر الوصول إلى مصادر الأدبيات حالياً. أعد المحاولة لاحقاً.' }, 503, 'academic_providers_unavailable');
    const relevant = result.papers
      .filter((paper) => paper.relevanceScore >= 18)
      .map((paper) => ({
        id: String(paper.id).slice(0, 500),
        doi: paper.doi,
        title: paper.title.slice(0, 500),
        authors: (paper.authors.join('، ') || 'بيانات المؤلفين غير متاحة').slice(0, 1_000),
        year: paper.year || 'د.ت',
        citationCount: paper.citationCount,
        abstract: paper.abstract.slice(0, 4_000),
        source: paper.sources.length > 1 ? 'سجل موثق من عدة فهارس' : 'سجل أكاديمي موثق',
        pdfUrl: paper.pdfUrl || paper.url,
        relevanceScore: paper.relevanceScore,
        item: CitationResolver.fromPaper(paper),
      }));

    return respond({
      success: true,
      query: title,
      data: relevant,
      searchCoverage: {
        candidateResults: result.papers.length,
        relevantResults: relevant.length,
        excludedByRelevance: result.papers.length - relevant.length,
        searchedAt: new Date().toISOString(),
        domain: result.domain,
        sources: result.providers.map((provider, index) => ({ name: `academic-source-${index + 1}`, available: provider.available, returned: provider.papers.length })),
        crossValidated: relevant.filter((paper) => paper.source.includes('عدة')).length,
        queryFingerprint: normaliseTitle(title),
        note: relevant.length >= 3
          ? 'عُثر على تغطية أولية صالحة للمراجعة. اقرأ الملخص والنص الكامل قبل اعتماد أي دراسة.'
          : 'التغطية الحالية غير كافية للحكم على غياب الدراسات؛ جرّب توسيع المفاهيم أو مراجعة صياغة العنوان.',
      },
    }, 200);
  } catch {
    return respond({ success: false, error: 'تعذر إكمال البحث في الأدبيات حالياً.' }, 500, 'unhandled_error');
  }
}
