import type { createServiceClient } from '@/lib/supabase/service';
import { after } from 'next/server';
import { logOperationalEvent } from '@/lib/observability';

export type IntegrityEntity = 'evidence_item' | 'claim' | 'claim_support' | 'gap_assessment';

/**
 * Appends to research_integrity_events (migration 20261008000000). The log is
 * append-only; a failed write is reported to the caller, which decides whether
 * to fail the request.
 */
export async function recordIntegrityEvent(service: ReturnType<typeof createServiceClient>, event: {
  projectId: string; actor: 'researcher' | 'system'; actorUserId: string | null; entityType: IntegrityEntity; entityId: string; action: string; details?: Record<string, unknown>;
}) {
  const { error } = await service.from('research_integrity_events').insert({
    project_id: event.projectId, actor: event.actor, actor_user_id: event.actorUserId, entity_type: event.entityType,
    entity_id: event.entityId, action: event.action, details: event.details || {},
  });
  if (error) throw new Error('INTEGRITY_EVENT_NOT_RECORDED');
}

/** Keep audit delivery within the server request lifecycle without delaying a committed result. */
export function recordIntegrityEventAfterResponse(service: ReturnType<typeof createServiceClient>, event: Parameters<typeof recordIntegrityEvent>[1]) {
  after(async () => {
    try { await recordIntegrityEvent(service, event); }
    catch { logOperationalEvent('warn', { event: 'research.audit.delivery_failed', route: 'research-integrity', outcome: 'failed', errorCode: 'INTEGRITY_EVENT_NOT_RECORDED' }); }
  });
}
