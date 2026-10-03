// Conservative gap assessment (Slice 6, migration 20261010000000).
//
// A deterministic, explainable rule set: no model is involved. It classifies a
// gap claim from its researcher-confirmed evidence links and the project's
// recorded search scope, and always states its limitations. It never says a
// gap is verified, proven or absent from the literature as a whole: the
// strongest result is EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE, and the
// researcher decides whether to accept it.

export const GAP_METHOD_VERSION = 'gap-rules-v1';
export const GAP_CLASSIFICATIONS = ['SIGNAL', 'NEEDS_MORE_EVIDENCE', 'POTENTIAL_GAP', 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE'] as const;
export type GapClassification = (typeof GAP_CLASSIFICATIONS)[number];

export type GapLink = {
  id: string;
  relation: 'supports' | 'contradicts' | 'contextual' | 'unclear';
  origin: 'researcher' | 'system';
  confirmation: 'suggested' | 'confirmed' | 'rejected';
  evidence: { id: string; state: string; project_reference_id: string | null; work_id: string | null; source_kind: string } | null;
};

export type GapSearchRun = { id: string; query: string; executed_at: string; providers_attempted: number; providers_available: number; result_count: number; limitations: string[] };

export type GapAssessment = {
  classification: GapClassification;
  rationale: string[];
  limitations: string[];
  basis: {
    confirmedSupportingEvidence: number;
    groundedSupportingEvidence: number;
    distinctSupportingSources: number;
    searchRunsWithAvailableProviders: number;
    supportingEvidence: string[];
    contradictingEvidence: string[];
    contextualEvidence: string[];
    unclearEvidence: string[];
    excludedSuggestions: number;
    excludedRejected: number;
    excludedInsufficient: number;
  };
  searchRunIds: string[];
  scope: { searches: Array<{ id: string; query: string; executedAt: string; providersAvailable: number; providersAttempted: number; resultCount: number }> };
};

/** Evidence grounded in a source the researcher or the server tied to the item. */
const GROUNDED_STATES = new Set(['recorded', 'source_supported']);

export function assessGap(links: GapLink[], runs: GapSearchRun[]): GapAssessment {
  const counted = links.filter((link) => link.confirmation === 'confirmed' && link.evidence);
  const usable = counted.filter((link) => link.evidence?.state !== 'insufficient_support');
  const ids = (relation: GapLink['relation']) => usable.filter((link) => link.relation === relation).map((link) => (link.evidence as NonNullable<GapLink['evidence']>).id);
  const supporting = usable.filter((link) => link.relation === 'supports');
  const grounded = supporting.filter((link) => GROUNDED_STATES.has((link.evidence as NonNullable<GapLink['evidence']>).state));
  const sources = new Set(grounded.map((link) => link.evidence?.work_id || link.evidence?.project_reference_id).filter(Boolean));
  const contradicting = ids('contradicts');
  const usableRuns = runs.filter((run) => run.providers_available >= 1);

  const basis: GapAssessment['basis'] = {
    confirmedSupportingEvidence: supporting.length,
    groundedSupportingEvidence: grounded.length,
    distinctSupportingSources: sources.size,
    searchRunsWithAvailableProviders: usableRuns.length,
    supportingEvidence: ids('supports'),
    contradictingEvidence: contradicting,
    contextualEvidence: ids('contextual'),
    unclearEvidence: ids('unclear'),
    excludedSuggestions: links.filter((link) => link.confirmation === 'suggested').length,
    excludedRejected: links.filter((link) => link.confirmation === 'rejected').length,
    excludedInsufficient: counted.length - usable.length,
  };

  const rationale: string[] = [];
  let classification: GapClassification;
  if (supporting.length === 0) {
    classification = 'SIGNAL';
    rationale.push('No researcher-confirmed evidence supports this gap yet; it is recorded as a signal to investigate.');
  } else if (contradicting.length > 0 && contradicting.length >= supporting.length) {
    classification = 'NEEDS_MORE_EVIDENCE';
    rationale.push(`Contradicting evidence (${contradicting.length}) is at least as frequent as supporting evidence (${supporting.length}); the gap is contested.`);
  } else if (usableRuns.length === 0) {
    classification = 'POTENTIAL_GAP';
    rationale.push('There is confirmed supporting evidence, but no recorded search with an available provider defines the scope, so it cannot be evidence-backed.');
  } else if (grounded.length >= 2 && sources.size >= 2) {
    classification = 'EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE';
    rationale.push(`${grounded.length} source-grounded supporting evidence items from ${sources.size} distinct sources, within ${usableRuns.length} recorded search(es).`);
  } else {
    classification = 'POTENTIAL_GAP';
    rationale.push(`Supporting evidence is limited: ${grounded.length} source-grounded item(s) from ${sources.size} distinct source(s); at least two of each are needed for an evidence-backed gap.`);
  }
  if (contradicting.length > 0 && classification !== 'NEEDS_MORE_EVIDENCE') rationale.push(`${contradicting.length} contradicting evidence item(s) are recorded and must be addressed.`);

  const limitations = ['This assessment covers only the recorded searches and the evidence linked to the claim. It is not an exhaustive review and does not establish that no study exists.'];
  if (!usableRuns.length) limitations.push('No recorded search with an available provider exists for this project.');
  for (const run of usableRuns) for (const limitation of run.limitations.slice(1)) if (!limitations.includes(limitation)) limitations.push(limitation);
  if (basis.excludedSuggestions) limitations.push(`${basis.excludedSuggestions} system-suggested link(s) not confirmed by the researcher were not counted.`);
  const asserted = supporting.length - grounded.length;
  if (asserted > 0) limitations.push(`${asserted} supporting item(s) rely on researcher-asserted or unreviewed sources and were not counted toward an evidence-backed gap.`);
  if (basis.excludedInsufficient) limitations.push(`${basis.excludedInsufficient} linked item(s) marked insufficient support by the researcher were not counted.`);
  if (contradicting.length) limitations.push(`${contradicting.length} contradicting evidence item(s) are part of this record.`);

  return {
    classification, rationale, limitations, basis,
    searchRunIds: usableRuns.map((run) => run.id),
    scope: { searches: runs.map((run) => ({ id: run.id, query: run.query, executedAt: run.executed_at, providersAvailable: run.providers_available, providersAttempted: run.providers_attempted, resultCount: run.result_count })) },
  };
}
