import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import {
  createResearchObjectView,
  evaluateObjectivesQuestionsConsistency,
  evaluateProblemObjectivesConsistency,
  evaluateQuestionsHypothesesConsistency,
  evaluateQuestionsMethodologyConsistency,
} from '@/lib/research-objects';
import type {
  JourneyDocumentSnapshot,
  ResearchConsistencyReport,
  ResearchObjectViewWarning,
} from '@/lib/research-objects/types';
import { evaluateGate, isStage, nextAllowedStage, type WorkflowOutput, type WorkflowStage, WORKFLOW_STAGES } from '@/lib/research-workflow';

type StoredDocument = JourneyDocumentSnapshot;

type ConsistencyEvaluation = {
  report: ResearchConsistencyReport;
  warnings: ResearchObjectViewWarning[];
};

function parseOutput(content: StoredDocument['content']): WorkflowOutput | null {
  if (!content) return null;
  if (typeof content === 'object' && !Array.isArray(content)) return content as WorkflowOutput;
  if (typeof content !== 'string') return null;
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
  const { data, error } = await supabase.from('documents').select('id, project_id, type, content, version, created_at').eq('project_id', projectId).like('type', 'journey:%').order('version', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as StoredDocument[];
}

function evaluateConsistencyCandidate(
  projectId: string,
  documents: StoredDocument[],
  stage: 'objectives' | 'questions' | 'hypotheses' | 'methodology',
  serializedContent: string,
  version: number,
): ConsistencyEvaluation {
  const candidateDocument: JourneyDocumentSnapshot = {
    id: `candidate:${projectId}:${stage}:${version}`,
    project_id: projectId,
    type: `journey:${stage}`,
    content: serializedContent,
    version,
    created_at: new Date().toISOString(),
  };
  const objectView = createResearchObjectView(projectId, [...documents, candidateDocument]);
  const parsedCandidate = parseOutput(serializedContent);
  return {
    report: stage === 'objectives'
      ? evaluateProblemObjectivesConsistency(objectView)
      : stage === 'questions'
        ? evaluateObjectivesQuestionsConsistency(objectView)
        : stage === 'hypotheses'
          ? evaluateQuestionsHypothesesConsistency(objectView, {
            mode: parsedCandidate?.mode === 'not_applicable' ? 'not_applicable' : 'required',
            rationale: typeof parsedCandidate?.rationale === 'string' ? parsedCandidate.rationale : '',
          })
          : evaluateQuestionsMethodologyConsistency(objectView),
    warnings: objectView.warnings,
  };
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
    const consistency = stage === 'objectives' || stage === 'questions' || stage === 'hypotheses' || stage === 'methodology'
      ? evaluateConsistencyCandidate(projectId, documents, stage, serialized, version)
      : null;

    if (consistency?.report.status === 'failed') {
      const consistencyGate = {
        status: 'needs_improvement' as const,
        stage,
        reason: consistency.report.summary,
        nextStage: stage,
      };
      return NextResponse.json({
        error: consistency.report.summary,
        gate: consistencyGate,
        consistency: consistency.report,
        consistencyWarnings: consistency.warnings,
      }, { status: 422 });
    }

    const { error: insertError } = await access.supabase.from('documents').insert({ project_id: projectId, type: `journey:${stage}`, content: serialized, version });
    if (insertError) throw insertError;
    const decisionVersion = Math.max(0, ...documents.filter((item) => item.type === 'journey:decision').map((item) => item.version || 0)) + 1;
    const decisionContent = {
      ...gate,
      recordedAt: new Date().toISOString(),
      ...(consistency ? {
        consistency: {
          checkType: consistency.report.checkType,
          formulaVersion: consistency.report.formulaVersion,
          status: consistency.report.status,
          overallScore: consistency.report.overallScore,
          coverageScore: consistency.report.coverageScore,
          issues: consistency.report.issues,
        },
      } : {}),
    };
    const { error: decisionError } = await access.supabase.from('documents').insert({ project_id: projectId, type: 'journey:decision', content: JSON.stringify(decisionContent), version: decisionVersion });
    if (decisionError) throw decisionError;
    await access.supabase.from('projects').update({ status: gate.status === 'open' ? `${stage}_completed` : `${stage}_needs_improvement` }).eq('id', projectId).eq('user_id', access.user.id);
    return NextResponse.json({
      success: true,
      stage,
      version,
      gate,
      nextStage: nextAllowedStage(candidate),
      consistency: consistency?.report ?? null,
      consistencyWarnings: consistency?.warnings ?? [],
    });
  } catch { return NextResponse.json({ error: 'Unable to save research stage' }, { status: 500 }); }
}
