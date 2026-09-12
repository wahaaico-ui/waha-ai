import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildProjectMarkdown } from '@/lib/project-export';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const projectId = body?.projectId;
    if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    if (body.format !== undefined && body.format !== 'markdown') return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: project } = await access.supabase.from('projects').select('title, university_policy').eq('id', projectId).single();
    const { data: documents, error: docError } = await access.supabase.from('documents').select('type, content, version').eq('project_id', projectId).order('version', { ascending: false });
    const { data: sources, error: sourceError } = await access.supabase.from('sources').select('raw_text, parsed_citation_apa, parsed_citation_ieee, confidence').eq('project_id', projectId);
    const { data: references, error: referenceError } = await access.supabase.from('project_references')
      .select('title, authors, publication_year, publication_title, doi, url')
      .eq('project_id', projectId).eq('user_id', access.user.id).order('created_at', { ascending: true });
    if (!project || docError || sourceError || referenceError) return NextResponse.json({ error: 'Unable to export project' }, { status: 500 });

    const content = buildProjectMarkdown(project, documents || [], sources || [], references || []);
    return new NextResponse(content, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="waha-project.md"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return NextResponse.json({ error: 'Unable to export project' }, { status: 500 }); }
}
