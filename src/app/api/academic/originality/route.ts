import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { buildOriginalityReport, type ReportCitation } from '@/lib/originality/report';
import { ORIGINALITY_DOCUMENT_TYPE, type SavedOriginalityReport } from '@/lib/originality/saved-report';
import { loadOpenSources, loadProjectSources, readLatestWritingDraft } from '@/lib/originality/sources-server';
import type { OverlapSource } from '@/lib/originality/text-match';

const MAX_TEXT_LENGTH = 50_000;
const MIN_TEXT_LENGTH = 50;

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

/**
 * Word-for-word overlap between the researcher's text and the sources the
 * platform can read: the project's own PDFs and references, and (opt-in) open
 * scholarly abstracts. Never a guessed originality score.
 */
export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return response({ error: 'يجب تسجيل الدخول أولاً.' }, 401);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return response({ error: 'طلب الفحص غير صالح.' }, 400);
  const fields = body as Record<string, unknown>;

  const projectId = typeof fields.projectId === 'string' ? fields.projectId.trim() : '';
  if (!projectId || !(await ownsProject(projectId, access.user.id, access.supabase))) return response({ error: 'المشروع غير موجود.' }, 404);
  if (fields.input !== 'draft' && fields.input !== 'text') return response({ error: 'اختر النص المراد فحصه.' }, 400);

  try {
    let text: string;
    let citations: ReportCitation[] = [];
    let draftSavedAt: string | null = null;
    if (fields.input === 'draft') {
      const draft = await readLatestWritingDraft(access.supabase, projectId);
      if (!draft) return response({ error: 'لا توجد مسودة محفوظة في الكتابة بالدليل لهذا المشروع.' }, 404);
      ({ text, citations, savedAt: draftSavedAt } = draft);
    } else {
      text = typeof fields.text === 'string' ? fields.text.trim() : '';
    }
    if (text.length < MIN_TEXT_LENGTH) return response({ error: `أدخل نصًا من ${MIN_TEXT_LENGTH} حرفًا على الأقل.` }, 400);
    if (text.length > MAX_TEXT_LENGTH) return response({ error: 'النص يتجاوز الحد المسموح للفحص.' }, 413);

    const projectSources = await loadProjectSources(access.supabase, projectId);
    let openSources: OverlapSource[] = [];
    let openSourceProviders: string[] = [];
    if (fields.includeOpenSources === true) {
      ({ sources: openSources, providers: openSourceProviders } = await loadOpenSources(text));
    }

    const report = buildOriginalityReport({
      text, citations, sources: [...projectSources, ...openSources],
      checked: { projectSources: projectSources.length, openSources: openSources.length, openSourceProviders },
    });
    // The report shown is the report saved for download: written once by the
    // server after the ownership check, never edited afterwards.
    const saved: SavedOriginalityReport = { version: 1, input: fields.input, draftSavedAt, report };
    const documentId = randomUUID();
    const stored = await createServiceClient().from('documents').insert({
      id: documentId, project_id: projectId, type: ORIGINALITY_DOCUMENT_TYPE, content: JSON.stringify(saved), version: 1,
    });
    if (stored.error) throw stored.error;
    return response({ success: true, input: fields.input, report, documentId }, 200);
  } catch {
    return response({ error: 'تعذر إكمال الفحص الآن. لم يُحفظ أي تقرير؛ أعد المحاولة.' }, 503);
  }
}
