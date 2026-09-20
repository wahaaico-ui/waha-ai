import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildProjectExportModel, buildProjectMarkdown } from '@/lib/project-export';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';

export const runtime = 'nodejs';

const formats = ['markdown', 'docx', 'pdf'] as const;
type ExportFormat = typeof formats[number];

const formatResponse = {
  markdown: { contentType: 'text/markdown; charset=utf-8', filename: 'waha-project.md' },
  docx: { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: 'waha-project.docx' },
  pdf: { contentType: 'application/pdf', filename: 'waha-project.pdf' },
} satisfies Record<ExportFormat, { contentType: string; filename: string }>;

function responseBody(content: string | Buffer): BodyInit {
  if (typeof content === 'string') return content;
  return Uint8Array.from(content).buffer;
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const projectId = body?.projectId;
    if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    const format: ExportFormat = body.format === undefined ? 'markdown' : body.format;
    if (!formats.includes(format)) return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: project } = await access.supabase.from('projects').select('title, university_policy').eq('id', projectId).single();
    const { data: documents, error: docError } = await access.supabase.from('documents').select('type, content, version').eq('project_id', projectId).order('version', { ascending: false });
    const { data: sources, error: sourceError } = await access.supabase.from('sources').select('raw_text, parsed_citation_apa, parsed_citation_ieee, confidence').eq('project_id', projectId);
    const { data: references, error: referenceError } = await access.supabase.from('project_references')
      .select('title, authors, publication_year, publication_title, doi, url')
      .eq('project_id', projectId).eq('user_id', access.user.id).order('created_at', { ascending: true });
    if (!project || docError || sourceError || referenceError) return NextResponse.json({ error: 'Unable to export project' }, { status: 500 });

    const model = buildProjectExportModel(project, documents || [], sources || [], references || []);
    const content = format === 'docx' ? await buildProjectDocx(model)
      : format === 'pdf' ? await buildProjectPdf(model)
        : buildProjectMarkdown(project, documents || [], sources || [], references || []);
    const metadata = formatResponse[format];
    return new NextResponse(responseBody(content), { headers: {
      'Content-Type': metadata.contentType,
      'Content-Disposition': `attachment; filename="${metadata.filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    console.error('Project export failed', error instanceof Error ? error.message : 'Unknown export error');
    return NextResponse.json({ error: 'Unable to export project' }, { status: 500 });
  }
}
