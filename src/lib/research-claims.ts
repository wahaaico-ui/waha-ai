// Project claims and claim support (Slice 5, migration 20261009000000).
//
// A claim is an assertion under evaluation, not a conclusion. A support link
// records how one evidence item relates to it. Links the researcher makes are
// confirmed; links proposed by the system (for example a model) are stored as
// suggested and stay recognisable after the researcher confirms or rejects
// them. A link's relation is never changed in place.
import type { createServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/research-evidence';

export const CLAIM_TYPES = ['background', 'problem', 'gap', 'objective', 'question', 'hypothesis', 'methodological', 'other'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];
export const CLAIM_STATUSES = ['draft', 'active', 'retired'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const SUPPORT_RELATIONS = ['supports', 'contradicts', 'contextual', 'unclear'] as const;
export type SupportRelation = (typeof SUPPORT_RELATIONS)[number];

export function parseClaimInput(body: unknown): { ok: true; statement: string; claimType: ClaimType } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid request' };
  const fields = body as Record<string, unknown>;
  const statement = typeof fields.statement === 'string' ? fields.statement.trim() : '';
  if (statement.length < 1 || statement.length > 2000) return { ok: false, error: 'A claim must be 1 to 2000 characters' };
  if (!CLAIM_TYPES.includes(fields.claimType as ClaimType)) return { ok: false, error: 'Unknown claim type' };
  return { ok: true, statement, claimType: fields.claimType as ClaimType };
}

export function parseSupportInput(body: unknown): { ok: true; claimId: string; evidenceItemId: string; relation: SupportRelation; rationale: string | null } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid request' };
  const fields = body as Record<string, unknown>;
  if (!isUuid(fields.claimId) || !isUuid(fields.evidenceItemId)) return { ok: false, error: 'A claim and an evidence item are required' };
  if (!SUPPORT_RELATIONS.includes(fields.relation as SupportRelation)) return { ok: false, error: 'Unknown relation' };
  const rationale = typeof fields.rationale === 'string' && fields.rationale.trim() ? fields.rationale.trim().slice(0, 2000) : null;
  return { ok: true, claimId: fields.claimId, evidenceItemId: fields.evidenceItemId, relation: fields.relation as SupportRelation, rationale };
}

/**
 * Server-only: records a link proposed by the system (for example a model) as
 * a suggestion. It does not count as researcher-confirmed support until the
 * researcher confirms it. No browser route calls this with browser input.
 */
export async function recordSuggestedSupport(service: ReturnType<typeof createServiceClient>, input: {
  projectId: string; claimId: string; evidenceItemId: string; relation: SupportRelation; rationale: string | null; provenance: Record<string, unknown>;
}) {
  const { data, error } = await service.from('claim_supports').insert({
    project_id: input.projectId, claim_id: input.claimId, evidence_item_id: input.evidenceItemId, relation: input.relation,
    origin: 'system', confirmation: 'suggested', rationale: input.rationale, created_by: null, provenance: input.provenance,
  }).select('id').single();
  if (error || !data) throw new Error('SUGGESTED_SUPPORT_NOT_RECORDED');
  return (data as { id: string }).id;
}
