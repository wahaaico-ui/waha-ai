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
import { completeOperationalRequest, operationalHeaders, startOperationalRequest } from '@/lib/observability';
import { createServiceClient } from '@/lib/supabase/service';
import {
  deriveAnalysisStageContent,
  deriveVerifyStageContent,
  sanitizeLiteraturePapers,
  SERVER_DERIVED_TRUST_MODEL,
  withoutClientVerification,
  type ServerVerificationDocument,
} from '@/lib/research-trust';

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

async function readServerVerification(projectId: string, supabase: SupabaseClient): Promise<ServerVerificationDocument | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, version, content')
    .eq('project_id', projectId)
    .eq('type', 'idea_verification')
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ServerVerificationDocument | null) || null;
}

function derivedByServer(output: WorkflowOutput | undefined) {
  const derivation = output?.serverDerivation;
  return Boolean(derivation && typeof derivation === 'object' && (derivation as Record<string, unknown>).trustModel === SERVER_DERIVED_TRUST_MODEL);
}

// Outputs saved before Slice 0 were accepted from the browser. They stay readable,
// but are labelled so they are not mistaken for server-derived state.
function outputTrust(outputs: Partial<Record<WorkflowStage, WorkflowOutput>>) {
  return {
    verify: outputs.verify ? (derivedByServer(outputs.verify) ? 'server_derived' : 'legacy_client_submitted') : null,
    literature: outputs.literature ? (outputs.literature.papers && Array.isArray(outputs.literature.papers) && outputs.literature.papers.every((paper) => paper && typeof paper === 'object' && (paper as Record<string, unknown>).metadataOrigin === 'client_submitted') ? 'client_submitted_unverified' : 'legacy_client_submitted') : null,
    analysis: outputs.analysis ? (derivedByServer(outputs.analysis) ? 'server_validated' : 'legacy_client_submitted') : null,
  };
}

type StoredDraft = {
  stage: string;
  content: Record<string, unknown>;
  client_updated_at: string;
  updated_at: string;
};

async function readDrafts(projectId: string, supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('research_stage_drafts')
    .select('stage, content, client_updated_at, updated_at')
    .eq('project_id', projectId);
  if (error) throw error;
  const drafts: Partial<Record<WorkflowStage, { content: WorkflowOutput; clientUpdatedAt: string; savedAt: string }>> = {};
  for (const draft of (data || []) as StoredDraft[]) {
    if (!isStage(draft.stage) || !draft.content || typeof draft.content !== 'object' || Array.isArray(draft.content)) continue;
    drafts[draft.stage] = {
      content: draft.content as WorkflowOutput,
      clientUpdatedAt: draft.client_updated_at,
      savedAt: draft.updated_at,
    };
  }
  return drafts;
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

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const operation = startOperationalRequest(request, '/api/projects/[projectId]/journey', 'api.research.journey.load.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.research.journey.load.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, { status, headers: operationalHeaders(operation) });
  };
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return respond({ error: 'Unauthorized' }, 401, 'unauthorized');
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return respond({ error: 'Project not found' }, 404, 'project_not_found');
    const [documents, drafts] = await Promise.all([
      readJourney(projectId, access.supabase),
      readDrafts(projectId, access.supabase),
    ]);
    const outputs = extractOutputs(documents);
    const nextStage = nextAllowedStage(outputs);
    const latestStageDocument = [...documents]
      .filter((document) => isStage(document.type?.replace('journey:', '')))
      .sort((first, second) => new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime())[0];
    const latestStage = latestStageDocument?.type?.replace('journey:', '');
    const metadata = access.user.user_metadata || {};
    const metadataText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
    const trust = outputTrust(outputs);
    if (outputs.literature) outputs.literature = { ...outputs.literature, papers: withoutClientVerification(outputs.literature.papers) };
    return respond({
      projectId,
      outputs,
      trust,
      drafts,
      nextStage,
      gate: nextStage ? evaluateGate(nextStage, outputs) : null,
      lastActivity: latestStageDocument && isStage(latestStage) ? { stage: latestStage, at: latestStageDocument.created_at } : null,
      researcher: {
        displayName: metadataText(metadata.full_name) || metadataText(metadata.name) || access.user.email?.split('@')[0] || 'باحث',
        specialty: metadataText(metadata.specialty),
      },
    }, 200);
  } catch { return respond({ error: 'Unable to load research journey' }, 500, 'unhandled_error'); }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const operation = startOperationalRequest(request, '/api/projects/[projectId]/journey', 'api.research.journey.draft.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.research.journey.draft.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, {
      status,
      headers: { ...operationalHeaders(operation), 'Cache-Control': 'no-store' },
    });
  };
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return respond({ error: 'Unauthorized' }, 401, 'unauthorized');
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return respond({ error: 'Project not found' }, 404, 'project_not_found');

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return respond({ error: 'Invalid request body' }, 400, 'invalid_request');
    const { stage, content, clientUpdatedAt } = body as { stage?: unknown; content?: unknown; clientUpdatedAt?: unknown };
    if (!isStage(stage) || !content || typeof content !== 'object' || Array.isArray(content)) {
      return respond({ error: 'A valid stage and content object are required' }, 400, 'invalid_stage_content');
    }
    const clientUpdatedTime = typeof clientUpdatedAt === 'string' ? Date.parse(clientUpdatedAt) : Number.NaN;
    if (!Number.isFinite(clientUpdatedTime) || clientUpdatedTime > Date.now() + 5 * 60_000) {
      return respond({ error: 'A valid client update timestamp is required' }, 400, 'invalid_timestamp');
    }
    const serialized = JSON.stringify(content);
    if (serialized.length > 50_000) return respond({ error: 'Stage draft is too large' }, 413, 'stage_draft_too_large');

    const { data, error } = await access.supabase.rpc('save_research_stage_draft', {
      p_project_id: projectId,
      p_stage: stage,
      p_content: content,
      p_client_updated_at: clientUpdatedAt,
    });
    if (error) throw error;
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved) {
      const drafts = await readDrafts(projectId, access.supabase);
      return respond({ error: 'A newer draft is already saved', draft: drafts[stage] || null }, 409, 'stale_draft');
    }
    return respond({
      success: true,
      stage,
      draft: {
        content: saved.content,
        clientUpdatedAt: saved.client_updated_at,
        savedAt: saved.updated_at,
      },
    }, 200);
  } catch {
    return respond({ error: 'Unable to save research draft' }, 500, 'unhandled_error');
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const operation = startOperationalRequest(request, '/api/projects/[projectId]/journey', 'api.research.journey.save.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.research.journey.save.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, { status, headers: operationalHeaders(operation) });
  };
  try {
    const { projectId } = await context.params;
    const access = await requireAuthenticatedUser();
    if (!access) return respond({ error: 'Unauthorized' }, 401, 'unauthorized');
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return respond({ error: 'Project not found' }, 404, 'project_not_found');
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return respond({ error: 'Invalid request body' }, 400, 'invalid_request');
    const { stage, content: clientContent } = body as { stage?: unknown; content?: unknown };
    if (!isStage(stage) || !clientContent || typeof clientContent !== 'object' || Array.isArray(clientContent)) return respond({ error: 'A valid stage and content object are required' }, 400, 'invalid_stage_content');
    if (JSON.stringify(clientContent).length > 50_000) return respond({ error: 'Stage output is too large' }, 413, 'stage_output_too_large');

    const documents = await readJourney(projectId, access.supabase);
    const outputs = extractOutputs(documents);

    const requestedIndex = WORKFLOW_STAGES.indexOf(stage);
    const missingPrevious = WORKFLOW_STAGES.slice(0, requestedIndex).find((previousStage) => !outputs[previousStage] || !evaluateGate(previousStage, outputs).status.includes('open'));
    if (missingPrevious) return respond({ error: 'Stage is locked', gate: evaluateGate(stage, outputs) }, 409, 'stage_locked');

    // System state is derived on the server; only researcher text, choices and
    // IDs are taken from the request (see src/lib/research-trust.ts).
    let content = clientContent as WorkflowOutput;
    if (stage === 'verify') {
      const derived = deriveVerifyStageContent(content, await readServerVerification(projectId, access.supabase));
      if (!derived.ok) return respond({ error: derived.error }, derived.status, derived.code);
      content = derived.content;
    } else if (stage === 'literature') {
      // Search counts are system state; the browser's copy is not stored.
      const literature: WorkflowOutput = { ...content, papers: sanitizeLiteraturePapers(content.papers) };
      delete literature.searchCoverage;
      content = literature;
    } else if (stage === 'analysis') {
      const derived = deriveAnalysisStageContent(content, outputs.literature);
      if (!derived.ok) return respond({ error: derived.error }, 422, 'analysis_evidence_rejected');
      content = derived.content;
    }
    const serialized = JSON.stringify(content);
    if (serialized.length > 50_000) return respond({ error: 'Stage output is too large' }, 413, 'stage_output_too_large');

    const candidate = { ...outputs, [stage]: content };
    const gate = evaluateGate(stage, candidate);
    if (gate.status !== 'open') {
      return respond({ error: gate.reason, gate }, 422, 'gate_rejected');
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
      return respond({
        error: consistency.report.summary,
        gate: consistencyGate,
        consistency: consistency.report,
        consistencyWarnings: consistency.warnings,
      }, 422, 'consistency_rejected');
    }

    // journey:* documents are server-owned (see migration 20260927000000). The
    // project was verified as the caller's above, so the write uses the server
    // client and is not open to the browser through the Data API.
    const serverWriter = createServiceClient();
    const { error: insertError } = await serverWriter.from('documents').insert({ project_id: projectId, type: `journey:${stage}`, content: serialized, version });
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
    const { error: decisionError } = await serverWriter.from('documents').insert({ project_id: projectId, type: 'journey:decision', content: JSON.stringify(decisionContent), version: decisionVersion });
    if (decisionError) throw decisionError;
    await access.supabase.from('projects').update({ status: gate.status === 'open' ? `${stage}_completed` : `${stage}_needs_improvement` }).eq('id', projectId).eq('user_id', access.user.id);
    try {
      await access.supabase.from('research_stage_drafts').delete().eq('project_id', projectId).eq('stage', stage);
    } catch {
      // The approved version is already durable. A stale draft is harmless and
      // can be replaced by the next edit, so cleanup must not roll back success.
    }
    return respond({
      success: true,
      stage,
      version,
      gate,
      nextStage: nextAllowedStage(candidate),
      consistency: consistency?.report ?? null,
      consistencyWarnings: consistency?.warnings ?? [],
    }, 200);
  } catch { return respond({ error: 'Unable to save research stage' }, 500, 'unhandled_error'); }
}
