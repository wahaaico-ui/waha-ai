/** Only adopted research stages belong in methodological drafting input.
 * Translation tasks, review snapshots and uploaded raw datasets do not. */
export const DRAFT_CONTEXT_STAGES = ['verify', 'title', 'problem', 'objectives', 'questions', 'hypotheses', 'methodology', 'design', 'instrument', 'literature'] as const;
export const DRAFT_CONTEXT_CHARACTER_BUDGET = 160_000;
export const DRAFT_CONTEXT_TOO_LARGE = 'نصوص المشروع أكبر من معالجة واحدة. اختر مجموعة مراجع أقرب لسؤالك ثم أعد المحاولة؛ جميع المراجع تبقى محفوظة في مكتبتك.';

type ContextDocument = { type: string | null; content: unknown };

/** The caller supplies one latest, owned document per stage. Never splice JSON
 * or silently remove a paper, an abstract ending, or a contrary finding. */
export function buildResearchDraftContext(documents: ContextDocument[]) {
  const context: Record<string, Record<string, unknown>> = {};
  for (const stage of DRAFT_CONTEXT_STAGES) {
    const row = documents.find(document => document.type === `journey:${stage}`);
    if (!row) continue;
    let parsed: unknown;
    try { parsed = typeof row.content === 'string' ? JSON.parse(row.content) : row.content; }
    catch { return { ok: false as const, code: 'context_unreadable' as const }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false as const, code: 'context_unreadable' as const };
    context[stage] = parsed as Record<string, unknown>;
  }
  const serialized = JSON.stringify(context);
  if (serialized.length > DRAFT_CONTEXT_CHARACTER_BUDGET) return { ok: false as const, code: 'context_too_large' as const };
  return { ok: true as const, context, serialized };
}
