// Shapes returned by the project Research Intelligence APIs (read side only).
export type LibrarySource = { id: string; title: string; authors: string[]; year: number | null; doi: string | null; url: string | null; origin?: string; canonicalLinked?: boolean };
export type EvidenceRecord = { id: string; project_reference_id: string | null; source_kind: string; evidence_type: string; content: string; locator: string | null; origin: string; state: string; state_set_by: string; created_at: string; updated_at: string };
export type SupportRecord = { id: string; claim_id: string; evidence_item_id: string; relation: string; origin: string; confirmation: string; rationale: string | null; created_at: string };
export type ClaimRecord = { id: string; statement: string; claim_type: string; origin: string; status: string; created_at: string; supports: SupportRecord[] };
export type SearchRunRecord = { id: string; context: string; query: string; domain: string | null; providers: Array<{ provider?: string; available?: boolean; returned?: number; error?: string }> | null; providers_attempted: number; providers_available: number; candidate_count: number | null; result_count: number; limitations: string[] | null; executed_at: string };
export type GapRecord = {
  id: string; claim_id: string; classification: string; rationale: string[]; limitations: string[];
  basis: { supportingEvidence?: string[]; contradictingEvidence?: string[]; contextualEvidence?: string[]; unclearEvidence?: string[]; excludedSuggestions?: number } | null;
  search_run_ids: string[]; scope: { searches?: Array<{ id: string; query: string; executedAt: string; providersAvailable: number; providersAttempted: number; resultCount: number }> } | null;
  origin: string; method_version: string; researcher_confirmation: string; confirmed_at: string | null; generated_at: string;
};
