import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { recordIntegrityEventAfterResponse } from '@/lib/research-audit';
import { isUuid } from '@/lib/research-evidence';
import { assessGap, GAP_METHOD_VERSION, type GapLink, type GapSearchRun } from '@/lib/research-gaps';

// Gap assessments (Slice 6). The server computes the classification from the
// claim, its links and the recorded search scope (src/lib/research-gaps.ts);
// nothing in the request can set it. The researcher can accept or reject an
// assessment; a new assessment is a new record.

const COLUMNS = 'id, project_id, claim_id, classification, rationale, limitations, basis, search_run_ids, scope, origin, method_version, researcher_confirmation, confirmed_at, generated_at';
const SCOPE_RUNS = 20;

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const { data, error } = await auth.access.supabase.from('gap_assessments').select(COLUMNS).eq('project_id', auth.projectId).order('generated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, assessments: data || [] });
  } catch { return NextResponse.json({ error: 'Unable to load gap assessments' }, { status: 500 }); }
}

export async function POST(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !isUuid(body.claimId)) return NextResponse.json({ error: 'A gap claim is required' }, { status: 400 });
    const db = auth.access.supabase;
    const claim = await db.from('claims').select('id, claim_type, status').eq('id', body.claimId).eq('project_id', auth.projectId).maybeSingle();
    if (claim.error) throw claim.error;
    if (!claim.data) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    const { claim_type: claimType, status } = claim.data as { claim_type: string; status: string };
    if (claimType !== 'gap') return NextResponse.json({ error: 'Only a gap claim can be assessed as a gap' }, { status: 422 });
    if (status !== 'active') return NextResponse.json({ error: 'Activate the claim before assessing it' }, { status: 409 });

    const links = await db.from('claim_supports').select('id, evidence_item_id, relation, origin, confirmation').eq('claim_id', body.claimId).eq('project_id', auth.projectId);
    if (links.error) throw links.error;
    const linkRows = (links.data || []) as Array<{ id: string; evidence_item_id: string; relation: GapLink['relation']; origin: GapLink['origin']; confirmation: GapLink['confirmation'] }>;
    const evidenceIds = linkRows.map((link) => link.evidence_item_id);
    const evidence = evidenceIds.length
      ? await db.from('evidence_items').select('id, state, project_reference_id, work_id, source_kind').in('id', evidenceIds).eq('project_id', auth.projectId)
      : { data: [], error: null };
    if (evidence.error) throw evidence.error;
    const evidenceById = new Map(((evidence.data || []) as Array<NonNullable<GapLink['evidence']>>).map((item) => [item.id, item]));
    const runs = await db.from('research_search_runs').select('id, query, executed_at, providers_attempted, providers_available, result_count, limitations').eq('project_id', auth.projectId).order('executed_at', { ascending: false }).limit(SCOPE_RUNS);
    if (runs.error) throw runs.error;

    const assessment = assessGap(linkRows.map((link) => ({ ...link, evidence: evidenceById.get(link.evidence_item_id) || null })), (runs.data || []) as GapSearchRun[]);
    const service = createServiceClient();
    const { data, error } = await service.from('gap_assessments').insert({
      project_id: auth.projectId, claim_id: body.claimId, classification: assessment.classification, rationale: assessment.rationale,
      limitations: assessment.limitations, basis: assessment.basis, search_run_ids: assessment.searchRunIds, scope: assessment.scope,
      origin: 'system', method_version: GAP_METHOD_VERSION, generated_by: auth.access.user.id, researcher_confirmation: 'unreviewed',
    }).select(COLUMNS).single();
    if (error) throw error;
    recordIntegrityEventAfterResponse(service, { projectId: auth.projectId, actor: 'system', actorUserId: auth.access.user.id, entityType: 'gap_assessment', entityId: (data as { id: string }).id, action: 'assessed', details: { claimId: body.claimId, classification: assessment.classification, methodVersion: GAP_METHOD_VERSION } });
    return NextResponse.json({ success: true, assessment: data });
  } catch { return NextResponse.json({ error: 'Unable to assess the gap' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !isUuid(body.assessmentId) || (body.decision !== 'accept' && body.decision !== 'reject')) return NextResponse.json({ error: 'An assessment and a decision (accept or reject) are required' }, { status: 400 });
    const current = await auth.access.supabase.from('gap_assessments').select('id, classification, researcher_confirmation').eq('id', body.assessmentId).eq('project_id', auth.projectId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    const decision = body.decision === 'accept' ? 'accepted' : 'rejected';
    const service = createServiceClient();
    // Only the researcher decision changes; the classification and its basis are fixed.
    const { data, error } = await service.from('gap_assessments').update({ researcher_confirmation: decision, confirmed_by: auth.access.user.id, confirmed_at: new Date().toISOString() })
      .eq('id', body.assessmentId).eq('project_id', auth.projectId).select(COLUMNS).single();
    if (error) throw error;
    recordIntegrityEventAfterResponse(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'gap_assessment', entityId: body.assessmentId, action: decision, details: { classification: (current.data as { classification: string }).classification } });
    return NextResponse.json({ success: true, assessment: data });
  } catch { return NextResponse.json({ error: 'Unable to record the decision' }, { status: 500 }); }
}
