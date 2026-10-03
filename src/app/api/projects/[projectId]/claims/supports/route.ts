import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { recordIntegrityEvent } from '@/lib/research-audit';
import { parseSupportInput } from '@/lib/research-claims';
import { isUuid } from '@/lib/research-evidence';

// Links between claims and evidence (Slice 5). A link made here is the
// researcher's and is confirmed. Suggested links (origin system) are created
// only on the server (recordSuggestedSupport) and are confirmed or rejected
// here; their origin and relation never change.

const COLUMNS = 'id, project_id, claim_id, evidence_item_id, relation, origin, confirmation, rationale, decided_at, created_at';

export async function POST(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const parsed = parseSupportInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    // Both ends must belong to this project.
    const claim = await auth.access.supabase.from('claims').select('id').eq('id', parsed.claimId).eq('project_id', auth.projectId).maybeSingle();
    if (claim.error) throw claim.error;
    const evidence = await auth.access.supabase.from('evidence_items').select('id').eq('id', parsed.evidenceItemId).eq('project_id', auth.projectId).maybeSingle();
    if (evidence.error) throw evidence.error;
    if (!claim.data || !evidence.data) return NextResponse.json({ error: 'Claim or evidence not found in this project' }, { status: 404 });
    const now = new Date().toISOString();
    const service = createServiceClient();
    const { data, error } = await service.from('claim_supports').insert({
      project_id: auth.projectId, claim_id: parsed.claimId, evidence_item_id: parsed.evidenceItemId, relation: parsed.relation,
      origin: 'researcher', confirmation: 'confirmed', rationale: parsed.rationale, created_by: auth.access.user.id,
      decided_by: auth.access.user.id, decided_at: now,
    }).select(COLUMNS).single();
    if (error?.code === '23505') return NextResponse.json({ error: 'This evidence is already linked to the claim. Remove that link to record a different relation.' }, { status: 409 });
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'claim_support', entityId: (data as { id: string }).id, action: 'created', details: { relation: parsed.relation, claimId: parsed.claimId, evidenceItemId: parsed.evidenceItemId } });
    return NextResponse.json({ success: true, support: data });
  } catch { return NextResponse.json({ error: 'Unable to link evidence' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !isUuid(body.supportId) || (body.decision !== 'confirm' && body.decision !== 'reject')) return NextResponse.json({ error: 'A link and a decision (confirm or reject) are required' }, { status: 400 });
    const current = await auth.access.supabase.from('claim_supports').select(COLUMNS).eq('id', body.supportId).eq('project_id', auth.projectId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    const link = current.data as { id: string; confirmation: string; relation: string };
    if (link.confirmation !== 'suggested') return NextResponse.json({ error: 'Only a suggested link can be confirmed or rejected' }, { status: 409 });
    const confirmation = body.decision === 'confirm' ? 'confirmed' : 'rejected';
    const now = new Date().toISOString();
    const service = createServiceClient();
    const { data, error } = await service.from('claim_supports').update({ confirmation, decided_by: auth.access.user.id, decided_at: now, updated_at: now })
      .eq('id', link.id).eq('project_id', auth.projectId).select(COLUMNS).single();
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'claim_support', entityId: link.id, action: confirmation, details: { relation: link.relation } });
    return NextResponse.json({ success: true, support: data });
  } catch { return NextResponse.json({ error: 'Unable to update link' }, { status: 500 }); }
}

export async function DELETE(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const supportId = new URL(request.url).searchParams.get('supportId');
    if (!isUuid(supportId)) return NextResponse.json({ error: 'A link is required' }, { status: 400 });
    const current = await auth.access.supabase.from('claim_supports').select('id, relation, origin, confirmation').eq('id', supportId).eq('project_id', auth.projectId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    const service = createServiceClient();
    const { error } = await service.from('claim_supports').delete().eq('id', supportId).eq('project_id', auth.projectId);
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'claim_support', entityId: supportId, action: 'deleted', details: current.data as Record<string, unknown> });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to remove link' }, { status: 500 }); }
}
