import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';
import type { EvidenceRecord, GapRecord } from './types';
import { formatDateTime, GAP_SCOPE_NOTE, gapClassificationLabel, RESEARCHER_DECISION_LABELS } from '@/lib/research-intelligence-ui';

function EvidenceList({ title, ids, evidenceById, tone }: { title: string; ids: string[]; evidenceById: Map<string, EvidenceRecord>; tone: string }) {
  return <section className={`rounded-xl border p-3 ${tone}`}>
    <h4 className="text-xs font-black">{title} ({ids.length})</h4>
    {ids.length === 0 ? <p className="mt-1 text-[11px] opacity-80">لا يوجد.</p>
      : <ul className="mt-2 space-y-1.5 text-xs leading-6">{ids.map((id) => <li key={id} className="rounded-lg bg-white p-2 text-slate-800">{evidenceById.get(id)?.content || 'دليل لم يعد متاحاً'}</li>)}</ul>}
  </section>;
}

/** One gap assessment: classification within the recorded scope, its reasons, evidence both ways, scope and limitations. */
export default function GapAssessmentCard({ assessment, evidenceById, decisionActions }: { assessment: GapRecord; evidenceById: Map<string, EvidenceRecord>; decisionActions?: ReactNode }) {
  const classification = gapClassificationLabel(assessment.classification);
  const basis = assessment.basis || {};
  const searches = assessment.scope?.searches || [];
  const inScope = new Set(assessment.search_run_ids || []);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge label={classification.label} tone={classification.tone} />
      <StatusBadge label={RESEARCHER_DECISION_LABELS[assessment.researcher_confirmation] || assessment.researcher_confirmation} tone={assessment.researcher_confirmation === 'accepted' ? 'positive' : assessment.researcher_confirmation === 'rejected' ? 'negative' : 'neutral'} />
      <span className="text-[11px] text-slate-400">قُيّم {formatDateTime(assessment.generated_at)}</span>
    </div>
    <p className="mt-3 text-sm leading-7 text-slate-700">{classification.explanation}</p>
    <ul className="mt-2 list-disc space-y-1 pe-5 ps-5 text-sm leading-7 text-slate-800">{assessment.rationale.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <EvidenceList title="أدلة داعمة" ids={basis.supportingEvidence || []} evidenceById={evidenceById} tone="border-emerald-200 bg-emerald-50 text-emerald-900" />
      <EvidenceList title="أدلة معارضة" ids={basis.contradictingEvidence || []} evidenceById={evidenceById} tone="border-rose-200 bg-rose-50 text-rose-900" />
    </div>
    {(basis.contextualEvidence?.length || basis.unclearEvidence?.length) ? <p className="mt-2 text-xs text-slate-500">أدلة سياقية: {basis.contextualEvidence?.length || 0} · علاقة غير واضحة: {basis.unclearEvidence?.length || 0}</p> : null}
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-xs font-black text-slate-800">نطاق البحث المسجل لهذا التقييم</h4>
      {searches.length === 0 ? <p className="mt-1 text-xs leading-6 text-slate-600">لم تُسجَّل عمليات بحث لهذا المشروع وقت التقييم.</p>
        : <ul className="mt-1 space-y-1 text-xs leading-6 text-slate-600">{searches.map((search) => <li key={search.id} dir="auto">{search.query} · {search.resultCount} نتيجة · مصادر متاحة {search.providersAvailable}/{search.providersAttempted}{inScope.has(search.id) ? '' : ' · لم يُحتسب (لا مصدر متاح)'}</li>)}</ul>}
    </section>
    <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h4 className="text-xs font-black text-amber-900">حدود هذا التقييم</h4>
      <ul className="mt-1 list-disc space-y-1 pe-4 ps-4 text-xs leading-6 text-amber-900">{assessment.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
    </section>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">{GAP_SCOPE_NOTE}</p>
    {decisionActions && <div className="mt-3 flex flex-wrap gap-2">{decisionActions}</div>}
  </article>;
}
