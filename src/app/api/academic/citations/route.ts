import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { ownedSource, ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sourceId, rawText, projectId } = await request.json();
    if (sourceId && !(await ownedSource(sourceId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    if (!sourceId && (!projectId || !(await ownsProject(projectId, access.user.id, access.supabase)))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { output, confidenceLabel } = await generateStructured({ prompt: `Generate APA and IEEE citations for the following text/source:\n\n${rawText || 'Academic source reference'}\n\nProvide them clearly separated as APA and IEEE format.`, projectId, userId: access.user.id, supabase: access.supabase, feature: 'citations' });
    const apa = output.match(/APA[:\s]*(.*?)(?=IEEE|$)/is)?.[1].trim() || output;
    const ieee = output.match(/IEEE[:\s]*(.*)/is)?.[1].trim() || output;
    let resolvedSourceId = sourceId;
    if (sourceId) await access.supabase.from('sources').update({ parsed_citation_apa: apa, parsed_citation_ieee: ieee, confidence: confidenceLabel }).eq('id', sourceId);
    else { const { data, error } = await access.supabase.from('sources').insert({ project_id: projectId, raw_text: rawText || 'Academic source reference', parsed_citation_apa: apa, parsed_citation_ieee: ieee, confidence: confidenceLabel }).select('id').single(); if (error) return NextResponse.json({ error: 'Unable to save source' }, { status: 500 }); resolvedSourceId = data.id; }
    return NextResponse.json({ success: true, apa, ieee, confidenceLabel, sourceId: resolvedSourceId });
  } catch { return NextResponse.json({ error: 'Unable to create citations' }, { status: 500 }); }
}
