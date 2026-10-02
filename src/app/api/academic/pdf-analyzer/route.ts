import { NextResponse } from 'next/server';
import { AI_OUTPUT_NOT_ASSESSED, generateStructured } from '@/lib/ai/geminiClient';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { logOperationalEvent, requestCorrelationId } from '@/lib/observability';

// The uploaded PDF's own text is stored as the project source first. Citation
// extraction (/api/academic/citations) works from that stored text alone, so
// AI analysis is optional: a provider failure must not block the upload or the
// deterministic DOI step that follows it.
export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { projectId, text, prompt } = await request.json();
    const rawText = typeof text === 'string' && text ? text : typeof prompt === 'string' ? prompt : '';
    if (!projectId || !rawText) return NextResponse.json({ error: 'projectId and text are required' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Inserted exactly once, before and independently of the model call. The
    // text comes from the uploaded file and is not assessed or verified.
    const { data, error } = await access.supabase.from('sources').insert({ project_id: projectId, raw_text: rawText, confidence: AI_OUTPUT_NOT_ASSESSED }).select('id').single();
    if (error || !data) return NextResponse.json({ error: 'Unable to save source' }, { status: 500 });

    try {
      const { output } = await generateStructured({ prompt: `Analyze the following academic text/PDF content and extract key insights and summary:\n\n${rawText}`, projectId, userId: access.user.id, supabase: access.supabase, feature: 'pdf-analyzer' });
      return NextResponse.json({ success: true, sourceId: data.id, output, analysis: output, analysisStatus: 'completed', confidenceLabel: AI_OUTPUT_NOT_ASSESSED });
    } catch (reason) {
      logOperationalEvent('warn', {
        event: 'api.pdf_analyzer.analysis_unavailable', route: '/api/academic/pdf-analyzer', requestId: requestCorrelationId(request),
        feature: 'pdf-analyzer', outcome: 'fallback',
        errorCode: reason instanceof Error && /^No structured-generation provider is configured/.test(reason.message) ? 'no_provider_configured' : 'ai_generation_failed',
      });
      return NextResponse.json({ success: true, sourceId: data.id, output: null, analysis: null, analysisStatus: 'unavailable', confidenceLabel: AI_OUTPUT_NOT_ASSESSED });
    }
  } catch { return NextResponse.json({ error: 'Unable to analyze document' }, { status: 500 }); }
}
