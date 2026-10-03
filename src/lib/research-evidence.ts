// Project evidence items (Slice 4, migration 20261008000000).
//
// A scholarly work is a source; an evidence item is what a researcher recorded
// from a source for one project. Its state describes how it is grounded, never
// whether the point is true. The server derives the initial state from the
// cited reference; only the researcher can confirm (source_supported) or reject
// (insufficient_support), and no state, work or origin is taken from the browser.
import type { ReferenceOrigin } from '@/lib/research-references';

export const EVIDENCE_TYPES = ['finding', 'method', 'measure', 'population', 'context', 'definition', 'limitation', 'other'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceState = 'recorded' | 'user_asserted' | 'source_supported' | 'insufficient_support' | 'needs_review';
export type EvidenceSourceKind = 'server_discovered' | 'user_asserted' | 'zotero_import' | 'legacy' | 'none';

/** States a researcher may set. recorded and user_asserted are set only by the server. */
export const RESEARCHER_EVIDENCE_STATES = ['source_supported', 'insufficient_support', 'needs_review'] as const;
export type ResearcherEvidenceState = (typeof RESEARCHER_EVIDENCE_STATES)[number];

export function sourceKindOf(origin: ReferenceOrigin | null): EvidenceSourceKind {
  if (!origin) return 'none';
  return origin === 'legacy_client_submitted' ? 'legacy' : origin;
}

/** The state the server assigns when an item is created. */
export function initialEvidenceState(sourceKind: EvidenceSourceKind, origin: 'researcher' | 'system'): EvidenceState {
  if (origin === 'system') return 'needs_review';
  return sourceKind === 'server_discovered' ? 'recorded' : 'user_asserted';
}

export type EvidenceInput = { projectReferenceId: string | null; evidenceType: EvidenceType; content: string; locator: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Reads only the researcher-controlled fields of a create request. */
export function parseEvidenceInput(body: unknown): { ok: true; input: EvidenceInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid request' };
  const fields = body as Record<string, unknown>;
  const content = typeof fields.content === 'string' ? fields.content.trim() : '';
  if (content.length < 1 || content.length > 4000) return { ok: false, error: 'Evidence content must be 1 to 4000 characters' };
  if (!EVIDENCE_TYPES.includes(fields.evidenceType as EvidenceType)) return { ok: false, error: 'Unknown evidence type' };
  if (fields.projectReferenceId !== undefined && fields.projectReferenceId !== null && !isUuid(fields.projectReferenceId)) return { ok: false, error: 'Invalid reference' };
  const locator = typeof fields.locator === 'string' && fields.locator.trim() ? fields.locator.trim().slice(0, 200) : null;
  return { ok: true, input: { projectReferenceId: (fields.projectReferenceId as string | null | undefined) || null, evidenceType: fields.evidenceType as EvidenceType, content, locator } };
}

/**
 * Validates a researcher's state change. Confirming or rejecting support needs
 * a cited source; the server-only states cannot be chosen.
 */
export function researcherStateChange(requested: unknown, hasSource: boolean): { ok: true; state: ResearcherEvidenceState } | { ok: false; error: string } {
  if (!RESEARCHER_EVIDENCE_STATES.includes(requested as ResearcherEvidenceState)) return { ok: false, error: 'This state cannot be set by the researcher' };
  if ((requested === 'source_supported' || requested === 'insufficient_support') && !hasSource) return { ok: false, error: 'Support can only be judged against a cited source' };
  return { ok: true, state: requested as ResearcherEvidenceState };
}
