import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { evaluateGate, isStage, nextAllowedStage, type WorkflowOutput, type WorkflowStage, WORKFLOW_STAGES } from '@/lib/research-workflow';

type StoredDocument = { type: string | null; content: string | null; version: number | null; created_at: string | null };

function parseOutput(content: string | null): WorkflowOutput | null {
  if (!content) return null;
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as WorkflowOutput : null;
  } catch { return null; }
}

function extractOutputs(documents: StoredDocument[]) {
  const outputs: Partial<Record<WorkflowStage, WorkflowOutput>> = {};
  for (const stage of WORKFLOW_STAGES) {
    const document = documents.find((item) => item.type === `journey:${stage}`);
    const output = parseOutput(document?.content ?? null);
    if (output) outputs[stage] = output;
  }
  return outputs;
}

async function readJourney(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase.from('documents').select('type, content, version, created_at').eq('project_id', projectId).like('type', 'journey:%').order('version', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as StoredDocument[];
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const documents = await readJourney(projectId, access.supabase);
    const outputs = extractOutputs(documents);
    const nextStage = nextAllowedStage(outputs);
    const latestStageDocument = [...documents]
      .filter((document) => isStage(document.type?.replace('journey:', '')))
      .sort((first, second) => new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime())[0];
    const latestStage = latestStageDocument?.type?.replace('journey:', '');
    const metadata = access.user.user_metadata || {};
    const metadataText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
    return NextResponse.json({
      projectId,
      outputs,
      nextStage,
      gate: nextStage ? evaluateGate(nextStage, outputs) : null,
      lastActivity: latestStageDocument && isStage(latestStage) ? { stage: latestStage, at: latestStageDocument.created_at } : null,
      researcher: {
        displayName: metadataText(metadata.full_name) || metadataText(metadata.name) || access.user.email?.split('@')[0] || 'باحث',
        specialty: metadataText(metadata.specialty),
      },
    });
  } catch { return NextResponse.json({ error: 'Unable to load research journey' }, { status: 500 }); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    const { stage, content } = body as { stage?: unknown; content?: unknown };
    if (!isStage(stage) || !content || typeof content !== 'object' || Array.isArray(content)) return NextResponse.json({ error: 'A valid stage and content object are required' }, { status: 400 });
    const serialized = JSON.stringify(content);
    if (serialized.length > 50_000) return NextResponse.json({ error: 'Stage output is too large' }, { status: 413 });

    const documents = await readJourney(projectId, access.supabase);
    const outputs = extractOutputs(documents);
    const requestedIndex = WORKFLOW_STAGES.indexOf(stage);
    const missingPrevious = WORKFLOW_STAGES.slice(0, requestedIndex).find((previousStage) => !outputs[previousStage] || !evaluateGate(previousStage, outputs).status.includes('open'));
    if (missingPrevious) return NextResponse.json({ error: 'Stage is locked', gate: evaluateGate(stage, outputs) }, { status: 409 });

    const candidate = { ...outputs, [stage]: content as WorkflowOutput };
    const gate = evaluateGate(stage, candidate);
    if (gate.status !== 'open') {
      return NextResponse.json({ error: gate.reason, gate }, { status: 422 });
    }
    const versions = documents.filter((item) => item.type === `journey:${stage}`).map((item) => item.version || 0);
    const version = Math.max(0, ...versions) + 1;
    const { error: insertError } = await access.supabase.from('documents').insert({ project_id: projectId, type: `journey:${stage}`, content: serialized, version });
    if (insertError) throw insertError;
    const decisionVersion = Math.max(0, ...documents.filter((item) => item.type === 'journey:decision').map((item) => item.version || 0)) + 1;
    const { error: decisionError } = await access.supabase.from('documents').insert({ project_id: projectId, type: 'journey:decision', content: JSON.stringify({ ...gate, recordedAt: new Date().toISOString() }), version: decisionVersion });
    if (decisionError) throw decisionError;
    await access.supabase.from('projects').update({ status: gate.status === 'open' ? `${stage}_completed` : `${stage}_needs_improvement` }).eq('id', projectId).eq('user_id', access.user.id);
    return NextResponse.json({ success: true, stage, version, gate, nextStage: nextAllowedStage(candidate) });
  } catch { return NextResponse.json({ error: 'Unable to save research stage' }, { status: 500 }); }
}
