import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildProjectExportModel, buildProjectMarkdown, type ProjectExportModel } from '@/lib/project-export';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';
import { buildProjectLatex } from '@/lib/latex-export';
import { hasPaidPlan } from '@/lib/billing/entitlements';
import { languageExportModel, synthesisExportModel, taskMarkdown } from '@/lib/research-task-export';
import { readLanguageTask } from '@/lib/language-task';
import { resolveLibrarySelection } from '@/lib/research-search-results';
import { normaliseResearchAnalysis, researchAnalysisEvidenceIssue } from '@/lib/research-analysis';
import { availableAbstract } from '@/lib/research-abstracts';
import { readSupervisorReview, supervisorExportModel, SUPERVISOR_DOCUMENT_TYPE } from '@/lib/supervisor-review';
import { ORIGINALITY_DOCUMENT_TYPE, originalityExportModel, readSavedOriginalityReport } from '@/lib/originality/saved-report';
import { researcherProfileFromMetadata } from '@/lib/researcher-profile';
import { CITATION_STYLES, type CitationStyle } from '@/lib/citations/types';
import { readCompleteExportRows } from '@/lib/complete-export-rows';
import { verifyProjectExportEvidence } from '@/lib/project-export-evidence';
import { loadProjectSummaries } from '@/lib/project-summaries-data';
import { summaryExportModel, summaryReady } from '@/lib/project-summaries';
import { ProjectExportEvidenceError, projectExportEvidenceMessage } from '@/lib/project-export-errors';

export const runtime = 'nodejs';
export const maxDuration = 120;

const formats = ['markdown', 'docx', 'pdf', 'latex'] as const;
type ExportFormat = typeof formats[number];

const formatResponse = {
  markdown: { contentType: 'text/markdown; charset=utf-8', filename: 'waha-project.md' },
  docx: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: 'waha-project.docx' },
  pdf: { contentType: 'application/pdf', filename: 'waha-project.pdf' },
  latex: { contentType: 'application/x-tex; charset=utf-8', filename: 'waha-project.tex' },
} satisfies Record<ExportFormat, { contentType: string; filename: string }>;

function responseBody(content: string | Buffer): BodyInit {
  if (typeof content === 'string') return content;
  return Uint8Array.from(content).buffer;
}

export async function POST(request: Request) {
  let language: 'ar' | 'en' = 'ar';
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const projectId = body?.projectId;
    if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    const format: ExportFormat = body.format === undefined ? 'markdown' : body.format;
    if (!formats.includes(format)) return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
    if (body.citationStyle !== undefined && !CITATION_STYLES.includes(body.citationStyle)) return NextResponse.json({ error: 'Unsupported citation style' }, { status: 400 });
    if (body.language !== undefined && !['ar', 'en'].includes(body.language)) return NextResponse.json({ error: 'Unsupported export language' }, { status: 400 });
    language = body.language || 'ar';
    const citationStyle = body.citationStyle as CitationStyle | undefined;
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (body.task !== undefined) {
      let model: ProjectExportModel;
      if (body.task === 'language') {
        if (typeof body.documentId !== 'string') return NextResponse.json({ error: 'Document required' }, { status: 400 });
        const result = await access.supabase.from('documents').select('content').eq('id', body.documentId).eq('project_id', projectId).eq('type', 'journey:language_task').maybeSingle();
        const task = readLanguageTask(result.data?.content);
        if (result.error || !task || task.status !== 'completed') return NextResponse.json({ error: 'Saved task not found' }, { status: 404 });
        model = languageExportModel(task, language);
      } else if (body.task === 'supervisor') {
        if (typeof body.documentId !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.documentId)) return NextResponse.json({ error: 'Saved document required' }, { status: 400 });
        const result = await access.supabase.from('documents').select('content').eq('id', body.documentId).eq('project_id', projectId).eq('type', SUPERVISOR_DOCUMENT_TYPE).maybeSingle();
        const review = readSupervisorReview(result.data?.content);
        if (result.error || !review) return NextResponse.json({ error: 'Saved review not found' }, { status: 404 });
        model = supervisorExportModel(review, language);
      } else if (body.task === 'originality') {
        if (typeof body.documentId !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.documentId)) return NextResponse.json({ error: 'اختر تقريرًا محفوظًا للتصدير.' }, { status: 400 });
        const [result, project] = await Promise.all([
          access.supabase.from('documents').select('content').eq('id', body.documentId).eq('project_id', projectId).eq('type', ORIGINALITY_DOCUMENT_TYPE).maybeSingle(),
          access.supabase.from('projects').select('title').eq('id', projectId).eq('user_id', access.user.id).maybeSingle(),
        ]);
        const saved = readSavedOriginalityReport(result.data?.content);
        if (result.error || !saved) return NextResponse.json({ error: 'التقرير المحفوظ غير موجود في هذا المشروع.' }, { status: 404 });
        if (project.error || !project.data) throw new Error('Project unavailable');
        model = originalityExportModel({
          documentId: body.documentId, projectTitle: project.data.title,
          researcherName: researcherProfileFromMetadata(access.user.user_metadata).fullName, saved,
        }, language);
      } else if (body.task === 'analysis') {
        const result = await access.supabase.from('research_stage_drafts').select('stage, content').eq('project_id', projectId).in('stage', ['analysis', 'literature']);
        if (result.error) throw result.error;
        const draft = result.data?.find((row) => row.stage === 'analysis')?.content;
        const selection = result.data?.find((row) => row.stage === 'literature')?.content?.referenceIds;
        if (!Array.isArray(selection) || !Array.isArray(draft?.referenceIds) || selection.length !== draft.referenceIds.length || !selection.every((id) => draft.referenceIds.includes(id))) return NextResponse.json({ error: 'احفظ تخليقًا من اختيار المصادر الحالي قبل التصدير.' }, { status: 409 });
        const papers = await resolveLibrarySelection({ userId: access.user.id, projectId, referenceIds: selection });
        if (!papers) return NextResponse.json({ error: 'اختيار المصادر لم يعد متاحًا.' }, { status: 409 });
        const used = papers.filter((paper) => availableAbstract(paper.abstract));
        const analysis = normaliseResearchAnalysis(draft, used.map((paper) => paper.id));
        if (!analysis) return NextResponse.json({ error: 'لا توجد مسودة قابلة للتصدير بإحالات صالحة.' }, { status: 409 });
        const evidenceIssue = researchAnalysisEvidenceIssue(analysis, used);
        if (evidenceIssue) return NextResponse.json({ error: evidenceIssue }, { status: 409 });
        const project = await access.supabase.from('projects').select('title').eq('id', projectId).eq('user_id', access.user.id).maybeSingle();
        if (project.error || !project.data) throw new Error('Project unavailable');
        model = synthesisExportModel(project.data.title, analysis, used, language);
      } else if (body.task === 'journal_summary' || body.task === 'decision_summary') {
        const summaries = await loadProjectSummaries(access.supabase, projectId);
        const summary = body.task === 'journal_summary' ? summaries.journal : summaries.decision;
        if (!summaryReady(summary)) return NextResponse.json({ error: summary.kind === 'journal' ? 'اكتب الملخص المهيكل في مرحلة «جاهزية النشر» أولًا.' : 'لا يُصدَّر ملخص القرار قبل حفظ النتائج وحدودها.' }, { status: 409 });
        model = summaryExportModel(summary, language);
      } else return NextResponse.json({ error: 'Unsupported task' }, { status: 400 });
      model.watermark = (await hasPaidPlan(access.user.id)) ? 'none' : 'free';
      const content = format === 'docx' ? await buildProjectDocx(model) : format === 'pdf' ? await buildProjectPdf(model) : format === 'latex' ? buildProjectLatex(model) : taskMarkdown(model);
      const extension = format === 'markdown' ? 'md' : format === 'latex' ? 'tex' : format;
      return new NextResponse(responseBody(content), { headers: { 'Content-Type': formatResponse[format].contentType, 'Content-Disposition': `attachment; filename="waha-${body.task}.${extension}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }

    const [projectResult, documents, sources, references] = await Promise.all([
      access.supabase.from('projects').select('title, university_policy').eq('id', projectId).single(),
      readCompleteExportRows((from, to) => access.supabase.from('documents').select('id, type, content, version, created_at', { count: 'exact' }).eq('project_id', projectId).order('version', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
      readCompleteExportRows((from, to) => access.supabase.from('sources').select('id, project_id, raw_text, parsed_citation_apa, parsed_citation_ieee, confidence', { count: 'exact' }).eq('project_id', projectId).order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to)),
      readCompleteExportRows((from, to) => access.supabase.from('project_references').select('id, project_id, provider, external_item_key, title, authors, publication_year, publication_title, doi, url, citation_data', { count: 'exact' }).eq('project_id', projectId).eq('user_id', access.user.id).order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    ]);
    if (projectResult.error || !projectResult.data) throw new Error('Project unavailable');
    const project = projectResult.data;

    verifyProjectExportEvidence(projectId, documents, sources, references, language);
    const model = buildProjectExportModel(project, documents || [], sources || [], references || [], citationStyle, language);
    model.watermark = (await hasPaidPlan(access.user.id)) ? 'none' : 'free';
    const requiredStyle = model.styleProfile?.citation_style.system?.value?.toLowerCase().replace(/\s+/gu, '-') as CitationStyle | undefined;
    if (project.university_policy?.startsWith('WAHA_GUIDE_V1:') && requiredStyle && citationStyle && requiredStyle !== citationStyle) {
      return NextResponse.json({ error: language === 'en'
        ? `Your approved guide requires ${model.styleProfile?.citation_style.system?.value}; select that citation style in your draft before export.`
        : `الدليل المعتمد يطلب ${model.styleProfile?.citation_style.system?.value}؛ اختر نمط التوثيق نفسه في المسودة قبل التصدير.` }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const content = format === 'docx' ? await buildProjectDocx(model)
      : format === 'pdf' ? await buildProjectPdf(model)
        : format === 'latex' ? buildProjectLatex(model)
        : buildProjectMarkdown(project, documents || [], sources || [], references || [], citationStyle, language, model.watermark);
    const metadata = formatResponse[format];
    return new NextResponse(responseBody(content), { headers: {
      'Content-Type': metadata.contentType,
      'Content-Disposition': `attachment; filename="${metadata.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof ProjectExportEvidenceError) {
      return NextResponse.json({ code: error.code, error: projectExportEvidenceMessage(error.code, language) }, { status: 409, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    console.error('Project export failed', error instanceof Error ? error.message : 'Unknown export error');
    return NextResponse.json({ error: 'تعذر تصدير المشروع كاملًا الآن. أعد المحاولة؛ لم نصدر ملفًا ناقصًا.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
