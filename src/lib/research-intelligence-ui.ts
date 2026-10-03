// Labels and request builders for the Research Intelligence workspace
// (sources, evidence, claims, claim support, search scope, gap assessments).
//
// Backend values are used internally exactly as stored; these maps only turn
// them into careful Arabic labels. Nothing here says a source, claim or gap is
// verified or proven: evidence states describe how a record is grounded, and
// the strongest gap label is limited to the recorded search scope.
//
// The request builders send only the fields a researcher controls. Work ids,
// states set by the server, origins, classifications and coverage are never
// part of a request.

export type Tone = 'neutral' | 'info' | 'positive' | 'caution' | 'negative';

// ---- Sources (project library) -------------------------------------------------

export type ReferenceOrigin = 'server_discovered' | 'user_asserted' | 'zotero_import' | 'legacy_client_submitted';

export const SOURCE_ORIGIN_LABELS: Record<ReferenceOrigin, { label: string; tone: Tone; hint: string }> = {
  server_discovered: { label: 'مصدر اكتُشف عبر الواحة', tone: 'info', hint: 'بياناته من فهارس أكاديمية كما أعادتها، ولم تُراجع يدوياً.' },
  user_asserted: { label: 'مصدر أدخله الباحث', tone: 'neutral', hint: 'بياناته كما أدخلتها أنت، ولم تُطابق مع فهرس أكاديمي.' },
  zotero_import: { label: 'مستورد من Zotero', tone: 'neutral', hint: 'بياناته كما وردت من مكتبتك في Zotero.' },
  legacy_client_submitted: { label: 'مصدر محفوظ سابقاً', tone: 'neutral', hint: 'حُفظ قبل اعتماد مصدر البيانات من الخادم؛ راجع بياناته قبل الاستشهاد.' },
};

export function sourceOriginLabel(origin: string | null | undefined) {
  return SOURCE_ORIGIN_LABELS[(origin as ReferenceOrigin) in SOURCE_ORIGIN_LABELS ? origin as ReferenceOrigin : 'legacy_client_submitted'];
}

/**
 * What a discovered record's internal status means, in provenance terms. The
 * status counts which indexes returned the record and whether it carries a
 * persistent identifier. It says nothing about the content of the work, so it
 * is never shown as verification or as a confidence percentage.
 */
export const DISCOVERY_RECORD_LABELS: Record<string, { label: string; tone: Tone }> = {
  verified: { label: 'ورد في أكثر من فهرس مع معرّف ثابت', tone: 'info' },
  'cross-checked': { label: 'ورد في أكثر من فهرس', tone: 'info' },
  'partially-verified': { label: 'ورد في فهرس واحد مع معرّف ثابت', tone: 'neutral' },
  unverified: { label: 'ورد في فهرس واحد دون معرّف ثابت', tone: 'caution' },
};

export function discoveryRecordLabel(status: string | null | undefined) {
  return DISCOVERY_RECORD_LABELS[status || ''] || DISCOVERY_RECORD_LABELS.unverified;
}

export const CANONICAL_LINK_LABEL = 'مرتبط بسجل علمي موحّد';

// ---- Evidence -------------------------------------------------------------------

export const EVIDENCE_TYPE_LABELS = {
  finding: 'نتيجة', method: 'منهج أو إجراء', measure: 'أداة قياس', population: 'مجتمع أو عينة',
  context: 'سياق', definition: 'تعريف', limitation: 'قيد أو محدودية', other: 'أخرى',
} as const;
export type EvidenceTypeValue = keyof typeof EVIDENCE_TYPE_LABELS;

export const EVIDENCE_STATE_LABELS: Record<string, { label: string; tone: Tone; hint: string }> = {
  recorded: { label: 'مسجّل من مصدر مكتشف', tone: 'info', hint: 'سجّلته من مصدر اكتُشف عبر الواحة، ولم تؤكد بعد أن المصدر يقوله.' },
  user_asserted: { label: 'بإسناد الباحث', tone: 'neutral', hint: 'مستند إلى مصدر أدخلته بنفسك أو إلى ملاحظتك دون مصدر.' },
  source_supported: { label: 'أكّد الباحث وروده في المصدر', tone: 'positive', hint: 'أكدت أن المصدر يتضمن هذا الدليل. هذا تأكيد منك، وليس حكماً بصحته.' },
  insufficient_support: { label: 'المصدر لا يكفي لدعمه', tone: 'negative', hint: 'قررت أن المصدر لا يدعم هذا الدليل بما يكفي.' },
  needs_review: { label: 'يحتاج مراجعة', tone: 'caution', hint: 'عُدّل النص أو اقتُرح تلقائياً؛ راجعه مقابل المصدر.' },
};

export function evidenceStateLabel(state: string) {
  return EVIDENCE_STATE_LABELS[state] || { label: 'حالة غير معروفة', tone: 'neutral' as Tone, hint: '' };
}

/** States the researcher may choose (the API rejects any other). */
export const RESEARCHER_EVIDENCE_ACTIONS = [
  { state: 'source_supported', label: 'أؤكد ورود هذا في المصدر', requiresSource: true },
  { state: 'insufficient_support', label: 'المصدر لا يكفي', requiresSource: true },
  { state: 'needs_review', label: 'إعادة إلى المراجعة', requiresSource: false },
] as const;

// ---- Claims and claim support ---------------------------------------------------

export const CLAIM_TYPE_LABELS = {
  gap: 'فجوة بحثية', problem: 'مشكلة بحثية', background: 'خلفية', objective: 'هدف', question: 'سؤال بحثي',
  hypothesis: 'فرضية', methodological: 'منهجي', other: 'أخرى',
} as const;
export type ClaimTypeValue = keyof typeof CLAIM_TYPE_LABELS;

export const CLAIM_STATUS_LABELS: Record<string, string> = { draft: 'مسودة', active: 'قيد الفحص', retired: 'مستبعد' };

export const RELATIONS = ['supports', 'contradicts', 'contextual', 'unclear'] as const;
export type RelationValue = (typeof RELATIONS)[number];
export const RELATION_LABELS: Record<RelationValue, { label: string; plural: string; tone: Tone }> = {
  supports: { label: 'يدعم', plural: 'أدلة داعمة', tone: 'positive' },
  contradicts: { label: 'يعارض', plural: 'أدلة معارضة', tone: 'negative' },
  contextual: { label: 'يوفر سياقاً', plural: 'أدلة سياقية', tone: 'info' },
  unclear: { label: 'علاقة غير واضحة', plural: 'علاقة غير واضحة', tone: 'caution' },
};

export function supportOriginLabel(origin: string, confirmation: string) {
  if (origin === 'researcher') return { label: 'ربطه الباحث', tone: 'neutral' as Tone };
  if (confirmation === 'confirmed') return { label: 'اقتراح آلي أكده الباحث', tone: 'neutral' as Tone };
  if (confirmation === 'rejected') return { label: 'اقتراح آلي رفضه الباحث', tone: 'negative' as Tone };
  return { label: 'اقتراح آلي لم يُراجع', tone: 'caution' as Tone };
}

// ---- Gap assessments ------------------------------------------------------------

export const GAP_CLASSIFICATION_LABELS: Record<string, { label: string; tone: Tone; explanation: string }> = {
  SIGNAL: { label: 'إشارة بحثية', tone: 'neutral', explanation: 'لا توجد بعد أدلة أكدتها تدعم هذه الفجوة؛ هي مؤشر يستحق البحث.' },
  NEEDS_MORE_EVIDENCE: { label: 'تحتاج أدلة إضافية', tone: 'caution', explanation: 'الأدلة المعارضة تعادل الداعمة أو تزيد عليها؛ الفجوة موضع خلاف.' },
  POTENTIAL_GAP: { label: 'فجوة محتملة', tone: 'info', explanation: 'توجد أدلة داعمة مرتبطة، لكن الأدلة التي أكد الباحث ورودها في مصادرها دون الحد المطلوب، أو لا يوجد نطاق بحث مسجل.' },
  EVIDENCE_BACKED_GAP_WITHIN_RECORDED_SCOPE: { label: 'فجوة مدعومة بالأدلة ضمن نطاق البحث المسجل', tone: 'positive', explanation: 'دليلان على الأقل أكد الباحث ورودهما في مصدرين مختلفين، ضمن عمليات البحث المسجلة في هذا المشروع فقط.' },
};

export function gapClassificationLabel(classification: string) {
  return GAP_CLASSIFICATION_LABELS[classification] || { label: 'تصنيف غير معروف', tone: 'neutral' as Tone, explanation: '' };
}

export const RESEARCHER_DECISION_LABELS: Record<string, string> = { unreviewed: 'لم يُراجع بعد', accepted: 'قبله الباحث لمشروعه', rejected: 'رفضه الباحث' };

/** Whether linked evidence qualifies toward an evidence-backed gap: only the researcher-confirmed state does. */
export const QUALIFYING_EVIDENCE_STATE = 'source_supported';
export const QUALIFYING_EVIDENCE_LABEL = 'أكّد الباحث وروده في المصدر · مؤهل للتقييم';
export const NOT_QUALIFYING_EVIDENCE_LABEL = 'يحتاج تأكيد وروده في المصدر · غير مؤهل للتصنيف الأعلى';

export const GAP_SCOPE_NOTE = 'التقييم مبني على عمليات البحث المسجلة في هذا المشروع والأدلة المرتبطة بالادعاء فقط. لا يعني أن الموضوع لم يُدرس في أي مكان، وقبولك له قرار بحثي منك وليس تحققاً موضوعياً من الواحة.';

// ---- Request builders: only researcher-controlled fields --------------------------

export function evidenceCreateBody(input: { projectReferenceId: string | null; evidenceType: EvidenceTypeValue; content: string; locator: string }) {
  return { projectReferenceId: input.projectReferenceId, evidenceType: input.evidenceType, content: input.content.trim(), locator: input.locator.trim() || null };
}

export function evidenceUpdateBody(evidenceId: string, input: { content?: string; locator?: string; state?: string }) {
  return {
    evidenceId,
    ...(input.content !== undefined ? { content: input.content.trim() } : {}),
    ...(input.locator !== undefined ? { locator: input.locator.trim() || null } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
  };
}

export function claimCreateBody(input: { statement: string; claimType: ClaimTypeValue }) {
  return { statement: input.statement.trim(), claimType: input.claimType };
}

export function supportCreateBody(input: { claimId: string; evidenceItemId: string; relation: RelationValue; rationale: string }) {
  return { claimId: input.claimId, evidenceItemId: input.evidenceItemId, relation: input.relation, rationale: input.rationale.trim() || null };
}

export function gapAssessBody(claimId: string) {
  return { claimId };
}

export function gapDecisionBody(assessmentId: string, decision: 'accept' | 'reject') {
  return { assessmentId, decision };
}

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  caution: 'border-amber-200 bg-amber-50 text-amber-900',
  negative: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
}
