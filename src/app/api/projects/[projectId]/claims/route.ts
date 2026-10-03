import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { recordIntegrityEvent } from '@/lib/research-audit';
import { CLAIM_STATUSES, parseClaimInput, type ClaimStatus } from '@/lib/research-claims';
import { isUuid } from '@/lib/research-evidence';

// Project claims (Slice 5). Reads use the caller's session (RLS); writes use the
// server client after the ownership check. A claim made here is the
// researcher's; origin, author and confirmation are set on the server.

const CLAIM_COLUMNS = 'id, project_id, statement, claim_type, origin, status, confirmed_at, created_at, updated_at';
const SUPPORT_COLUMNS = 'id, claim_id, evidence_item_id, relation, origin, confirmation, rationale, decided_at, created_at';

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const claims = await auth.access.supabase.from('claims').select(CLAIM_COLUMNS).eq('project_id', auth.projectId).order('created_at', { ascending: false });
    if (claims.error) throw claims.error;
    const supports = await auth.access.supabase.from('claim_supports').select(SUPPORT_COLUMNS).eq('project_id', auth.projectId);
    if (supports.error) throw supports.error;
    const byClaim = new Map<string, unknown[]>();
    for (const support of (supports.data || []) as Array<{ claim_id: string }>) byClaim.set(support.claim_id, [...(byClaim.get(support.claim_id) || []), support]);
    return NextResponse.json({ success: true, claims: ((claims.data || []) as Array<{ id: string }>).map((claim) => ({ ...claim, supports: byClaim.get(claim.id) || [] })) });
  } catch { return NextResponse.json({ error: 'Unable to load claims' }, { status: 500 }); }
}

export async function POST(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const parsed = parseClaimInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const service = createServiceClient();
    const { data, error } = await service.from('claims').insert({
      project_id: auth.projectId, created_by: auth.access.user.id, statement: parsed.statement, claim_type: parsed.claimType,
      origin: 'researcher', status: 'active',
    }).select(CLAIM_COLUMNS).single();
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'claim', entityId: (data as { id: string }).id, action: 'created', details: { claimType: parsed.claimType } });
    return NextResponse.json({ success: true, claim: data });
  } catch { return NextResponse.json({ error: 'Unable to save claim' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !isUuid(body.claimId)) return NextResponse.json({ error: 'A claim is required' }, { status: 400 });
    const current = await auth.access.supabase.from('claims').select(CLAIM_COLUMNS).eq('id', body.claimId).eq('project_id', auth.projectId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    const claim = current.data as { id: string; origin: string; status: string; confirmed_at: string | null };
    const now = new Date().toISOString();
    const changes: Record<string, unknown> = {};
    if (typeof body.statement === 'string') {
      const statement = body.statement.trim();
      if (statement.length < 1 || statement.length > 2000) return NextResponse.json({ error: 'A claim must be 1 to 2000 characters' }, { status: 400 });
      changes.statement = statement;
    }
    if (body.status !== undefined) {
      if (!CLAIM_STATUSES.includes(body.status as ClaimStatus)) return NextResponse.json({ error: 'Unknown status' }, { status: 422 });
      changes.status = body.status;
      // Activating a system-proposed claim is the researcher's confirmation of it.
      if (claim.origin === 'system' && body.status === 'active' && !claim.confirmed_at) Object.assign(changes, { confirmed_by: auth.access.user.id, confirmed_at: now });
    }
    if (!Object.keys(changes).length) return NextResponse.json({ success: true, claim: current.data });
    changes.updated_at = now;
    const service = createServiceClient();
    const { data, error } = await service.from('claims').update(changes).eq('id', claim.id).eq('project_id', auth.projectId).select(CLAIM_COLUMNS).single();
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'claim', entityId: claim.id, action: 'updated', details: { fromStatus: claim.status, toStatus: (changes.status as string | undefined) || claim.status, statementChanged: 'statement' in changes } });
    return NextResponse.json({ success: true, claim: data });
  } catch { return NextResponse.json({ error: 'Unable to update claim' }, { status: 500 }); }
}

export async function DELETE(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) return auth.response;
    const claimId = new URL(request.url).searchParams.get('claimId');
    if (!isUuid(claimId)) return NextResponse.json({ error: 'A claim is required' }, { status: 400 });
    const current = await auth.access.supabase.from('claims').select('id').eq('id', claimId).eq('project_id', auth.projectId).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    const service = createServiceClient();
    const { error } = await service.from('claims').delete().eq('id', claimId).eq('project_id', auth.projectId);
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'claim', entityId: claimId, action: 'deleted' });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to delete claim' }, { status: 500 }); }
}
