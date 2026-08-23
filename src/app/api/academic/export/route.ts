import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId } = await request.json();
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: project } = await access.supabase.from('projects').select('title, university_policy').eq('id', projectId).single();
    const { data: documents, error: docError } = await access.supabase.from('documents').select('type, content, version').eq('project_id', projectId).order('version', { ascending: false });
    const { data: sources, error: sourceError } = await access.supabase.from('sources').select('raw_text, parsed_citation_apa, parsed_citation_ieee, confidence').eq('project_id', projectId);
    if (!project || docError || sourceError) return NextResponse.json({ error: 'Unable to export project' }, { status: 500 });

    const latest = new Map<string, { type: string | null; content: string | null; version: number | null }>();
    for (const document of documents || []) if (!latest.has(document.type || 'document')) latest.set(document.type || 'document', document);
    let content = `# ${project.title}\n\n**University Policy:** ${project.university_policy || 'Not specified'}\n\n---\n\n## Project Documents\n\n`;
    for (const document of latest.values()) content += `### ${document.type || 'Document'} (Version ${document.version || 1})\n${document.content || ''}\n\n---\n\n`;
    if ((sources || []).length) content += `## Sources & Citations\n\n${sources?.map((source, index) => `### Source ${index + 1}\n- Raw Text: ${source.raw_text || ''}\n- APA: ${source.parsed_citation_apa || ''}\n- IEEE: ${source.parsed_citation_ieee || ''}\n- Confidence: ${source.confidence || ''}`).join('\n\n')}`;
    return new NextResponse(content, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${encodeURIComponent(project.title || 'project')}-export.md"` } });
  } catch { return NextResponse.json({ error: 'Unable to export project' }, { status: 500 }); }
}
