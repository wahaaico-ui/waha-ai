import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId, text, prompt } = await request.json();
    const rawText = text || prompt || '';
    if (!projectId || !rawText) return NextResponse.json({ error: 'projectId and text are required' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { output, confidenceLabel } = await generateStructured({ prompt: `Analyze the following academic text/PDF content and extract key insights and summary:\n\n${rawText}`, projectId, userId: access.user.id, supabase: access.supabase, feature: 'pdf-analyzer' });
    const { data, error } = await access.supabase.from('sources').insert({ project_id: projectId, raw_text: rawText, confidence: confidenceLabel }).select('id').single();
    if (error) return NextResponse.json({ error: 'Unable to save source' }, { status: 500 });
    return NextResponse.json({ success: true, output, confidenceLabel, sourceId: data.id });
  } catch { return NextResponse.json({ error: 'Unable to analyze document' }, { status: 500 }); }
}
