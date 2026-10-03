import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { referenceOrigin } from '@/lib/research-references';
import { recordIntegrityEvent } from '@/lib/research-audit';
import { initialEvidenceState, isUuid, parseEvidenceInput, researcherStateChange, sourceKindOf } from '@/lib/research-evidence';

// Project evidence items (Slice 4). Reads use the caller's session (RLS limits
// them to the caller's projects). Writes use the server client only after the
// project is verified as the caller's; project, author, source, canonical work,
// origin and state are set here, never taken from the request.

type Context = ProjectRouteContext;
const COLUMNS = 'id, project_id, project_reference_id, work_id, source_kind, evidence_type, content, locator, origin, state, state_set_by, state_set_at, created_at, updated_at';
const authorise = authoriseProject;

export async function GET(_request: Request, context: Context) {
  try {
    const auth = await authorise(context);
    if (!auth.ok) return auth.response;
    const { data, error } = await auth.access.supabase.from('evidence_items').select(COLUMNS).eq('project_id', auth.projectId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, items: data || [] });
  } catch { return NextResponse.json({ error: 'Unable to load evidence' }, { status: 500 }); }
}

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authorise(context);
    if (!auth.ok) return auth.response;
    const parsed = parseEvidenceInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { input } = parsed;

    // The cited reference must belong to this project; its origin and canonical
    // work come from the stored row.
    type ReferenceRow = { id: string; provider: string; citation_data: unknown; work_id: string | null };
    let reference: ReferenceRow | null = null;
    if (input.projectReferenceId) {
      const { data, error } = await auth.access.supabase.from('project_references').select('id, provider, citation_data, work_id')
        .eq('id', input.projectReferenceId).eq('project_id', auth.projectId).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Reference not found in this project' }, { status: 404 });
      reference = data as ReferenceRow;
    }
    const origin = reference ? referenceOrigin(reference) : null;
    const sourceKind = sourceKindOf(origin);
    const row = {
      project_id: auth.projectId, created_by: auth.access.user.id,
      project_reference_id: reference?.id || null, work_id: reference?.work_id || null, source_kind: sourceKind,
      evidence_type: input.evidenceType, content: input.content, locator: input.locator,
      origin: 'researcher', state: initialEvidenceState(sourceKind, 'researcher'), state_set_by: 'system',
      provenance: { referenceOrigin: origin, workId: reference?.work_id || null },
    };
    const service = createServiceClient();
    const { data, error } = await service.from('evidence_items').insert(row).select(COLUMNS).single();
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'evidence_item', entityId: (data as { id: string }).id, action: 'created', details: { state: row.state, sourceKind } });
    return NextResponse.json({ success: true, item: data });
  } catch { return NextResponse.json({ error: 'Unable to save evidence' }, { status: 500 }); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await authorise(context);
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !isUuid(body.evidenceId)) return NextResponse.json({ error: 'Evidence item is required' }, { status: 400 });
    const { data: current, error: readError } = await auth.access.supabase.from('evidence_items').select(COLUMNS).eq('id', body.evidenceId).eq('project_id', auth.projectId).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Evidence item not found' }, { status: 404 });
    const item = current as { id: string; project_reference_id: string | null; state: string; content: string; locator: string | null };

    const changes: Record<string, unknown> = {};
    const now = new Date().toISOString();
    if (typeof body.content === 'string') {
      const content = body.content.trim();
      if (content.length < 1 || content.length > 4000) return NextResponse.json({ error: 'Evidence content must be 1 to 4000 characters' }, { status: 400 });
      if (content !== item.content) {
        changes.content = content;
        // A researcher judgement applied to the old text no longer holds.
        if (item.state === 'source_supported' || item.state === 'insufficient_support') Object.assign(changes, { state: 'needs_review', state_set_by: 'system', state_set_at: now });
      }
    }
    if (body.locator !== undefined) changes.locator = typeof body.locator === 'string' && body.locator.trim() ? body.locator.trim().slice(0, 200) : null;
    if (body.state !== undefined) {
      const change = researcherStateChange(body.state, Boolean(item.project_reference_id));
      if (!change.ok) return NextResponse.json({ error: change.error }, { status: 422 });
      Object.assign(changes, { state: change.state, state_set_by: 'researcher', state_set_at: now });
    }
    if (!Object.keys(changes).length) return NextResponse.json({ success: true, item: current });
    changes.updated_at = now;

    const service = createServiceClient();
    const { data, error } = await service.from('evidence_items').update(changes).eq('id', item.id).eq('project_id', auth.projectId).select(COLUMNS).single();
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'evidence_item', entityId: item.id, action: 'updated', details: { fromState: item.state, toState: (changes.state as string | undefined) || item.state, contentChanged: 'content' in changes } });
    return NextResponse.json({ success: true, item: data });
  } catch { return NextResponse.json({ error: 'Unable to update evidence' }, { status: 500 }); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await authorise(context);
    if (!auth.ok) return auth.response;
    const evidenceId = new URL(request.url).searchParams.get('evidenceId');
    if (!isUuid(evidenceId)) return NextResponse.json({ error: 'Evidence item is required' }, { status: 400 });
    const { data: current, error: readError } = await auth.access.supabase.from('evidence_items').select('id, state').eq('id', evidenceId).eq('project_id', auth.projectId).maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'Evidence item not found' }, { status: 404 });
    const service = createServiceClient();
    const { error } = await service.from('evidence_items').delete().eq('id', evidenceId).eq('project_id', auth.projectId);
    // Evidence linked to a claim is kept until the link is removed (Slice 5).
    if (error?.code === '23503') return NextResponse.json({ error: 'This evidence is linked to a claim. Remove the link first.' }, { status: 409 });
    if (error) throw error;
    await recordIntegrityEvent(service, { projectId: auth.projectId, actor: 'researcher', actorUserId: auth.access.user.id, entityType: 'evidence_item', entityId: evidenceId, action: 'deleted', details: { state: (current as { state: string }).state } });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to delete evidence' }, { status: 500 }); }
}
