'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import type { ReactNode } from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';
import type { EvidenceRecord, GapRecord, LibrarySource } from './types';
import { formatDateTime, GAP_SCOPE_NOTE, gapClassificationLabel, NOT_QUALIFYING_EVIDENCE_LABEL, QUALIFYING_EVIDENCE_LABEL, QUALIFYING_EVIDENCE_STATE, RESEARCHER_DECISION_LABELS } from '@/lib/research-intelligence-ui';
import { systemTextArabic } from '@/lib/research-system-text';

/** A stored system text in Arabic when known; otherwise as stored, never hidden. */
export function SystemText({ text }: { text: string }) {
  const { language, text: ui } = useUiTranslation();
  if (language === 'en') return <span dir="auto">{ui(text)}</span>;
  const rendered = systemTextArabic(text);
  return rendered.translated ? <>{rendered.text}</> : <span dir="auto">{rendered.text}</span>;
}

function EvidenceList({ title, ids, evidenceById, sourcesById, projectId, tone, qualifying, summary }: {
  title: string; ids: string[]; evidenceById: Map<string, EvidenceRecord>; sourcesById?: Map<string, LibrarySource>; projectId?: string; tone: string; qualifying?: Set<string>; summary?: string;
}) {
  const { text: ui } = useUiTranslation();

  return <section className={`rounded-xl border p-3 ${tone}`}>
    <h4 className="text-xs font-black">{ui(title)} ({ids.length})</h4>
    {summary && <p className="mt-1 text-[11px] font-bold">{summary}</p>}
    {ids.length === 0 ? <p className="mt-1 text-[11px] opacity-80">{ui("لا يوجد.")}</p>
      : <ul className="mt-2 space-y-1.5 text-xs leading-6">{ids.map((id) => {
        const evidence = evidenceById.get(id);
        const referenceId = evidence?.project_reference_id;
        const source = referenceId ? sourcesById?.get(referenceId) : undefined;
        return <li key={id} data-qualifying={qualifying ? String(qualifying.has(id)) : undefined} className={`rounded-lg bg-white p-2 text-slate-800 ${qualifying && !qualifying.has(id) ? 'border border-dashed border-amber-300' : ''}`}>
        <p className="break-words [overflow-wrap:anywhere]">{evidence?.content || ui("دليل لم يعد متاحاً")}</p>
        {evidence?.locator && <p className="mt-1 text-[11px] text-slate-600">{ui("موضع الدليل:")}{' '}{evidence.locator}</p>}
        {projectId && referenceId && <Link className="mt-1 inline-block font-bold text-blue-700 underline" href={`/research/library?projectId=${encodeURIComponent(projectId)}#reference-${encodeURIComponent(referenceId)}`}>{source?.title || ui("مراجعة المرجع المرتبط")}</Link>}
        {qualifying && <div className="mt-1"><StatusBadge label={qualifying.has(id) ? QUALIFYING_EVIDENCE_LABEL : NOT_QUALIFYING_EVIDENCE_LABEL} tone={qualifying.has(id) ? 'positive' : 'caution'} /></div>}
      </li>;
      })}</ul>}
  </section>;
}

/** One gap assessment: classification within the recorded scope, its reasons, evidence both ways, scope and limitations. */
export default function GapAssessmentCard({ assessment, evidenceById, sourcesById, projectId, decisionActions }: { assessment: GapRecord; evidenceById: Map<string, EvidenceRecord>; sourcesById?: Map<string, LibrarySource>; projectId?: string; decisionActions?: ReactNode }) {
  const { text: ui, language } = useUiTranslation();

  const classification = gapClassificationLabel(assessment.classification);
  const basis = assessment.basis || {};
  const searches = assessment.scope?.searches || [];
  const inScope = new Set(assessment.search_run_ids || []);
  const supporting = basis.supportingEvidence || [];
  // Assessments since gap-rules-v2 record which supporting items qualified. For
  // older ones, the current evidence state is shown instead, with a notice.
  const recordedQualifying = Array.isArray(basis.qualifyingSupportingEvidence);
  const qualifying = new Set(recordedQualifying ? basis.qualifyingSupportingEvidence
    : supporting.filter((id) => evidenceById.get(id)?.state === QUALIFYING_EVIDENCE_STATE));
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge label={classification.label} tone={classification.tone} />
      <StatusBadge label={RESEARCHER_DECISION_LABELS[assessment.researcher_confirmation] || assessment.researcher_confirmation} tone={assessment.researcher_confirmation === 'accepted' ? 'positive' : assessment.researcher_confirmation === 'rejected' ? 'negative' : 'neutral'} />
      <span className="text-[11px] text-slate-400">{ui("قُيّم")}{' '}{formatDateTime(assessment.generated_at, language)}</span>
    </div>
    <p className="mt-3 text-sm leading-7 text-slate-700">{ui(classification.explanation)}</p>
    <ul className="mt-2 list-disc space-y-1 pe-5 ps-5 text-sm leading-7 text-slate-800">{assessment.rationale.map((reason) => <li key={reason}><SystemText text={reason} /></li>)}</ul>
    {!recordedQualifying && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs leading-6 text-amber-900">{ui("أُجري هذا التقييم وفق قواعد سابقة كانت تحتسب أدلة لم يؤكد الباحث ورودها في مصادرها. أعد التقييم ليُطبَّق الشرط الحالي.")}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <EvidenceList title={ui("أدلة داعمة مرتبطة")} ids={supporting} evidenceById={evidenceById} sourcesById={sourcesById} projectId={projectId} tone="border-emerald-200 bg-emerald-50 text-emerald-900" qualifying={qualifying} summary={ui("أدلة مؤكدة مؤهلة للتقييم: {0} من {1}", [supporting.filter((id) => qualifying.has(id)).length, supporting.length])} />
      <EvidenceList title={ui("أدلة معارضة")} ids={basis.contradictingEvidence || []} evidenceById={evidenceById} sourcesById={sourcesById} projectId={projectId} tone="border-rose-200 bg-rose-50 text-rose-900" />
    </div>
    {(basis.contextualEvidence?.length || basis.unclearEvidence?.length) ? <p className="mt-2 text-xs text-slate-500">{ui("أدلة سياقية:")}{' '}{basis.contextualEvidence?.length || 0} {ui("· علاقة غير واضحة:")}{' '}{basis.unclearEvidence?.length || 0}</p> : null}
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-xs font-black text-slate-800">{ui("نطاق البحث المسجل لهذا التقييم")}</h4>
      {searches.length === 0 ? <p className="mt-1 text-xs leading-6 text-slate-600">{ui("لم تُسجَّل عمليات بحث لهذا المشروع وقت التقييم.")}</p>
        : <ul className="mt-1 space-y-1 text-xs leading-6 text-slate-600">{searches.map((search) => <li key={search.id} dir="auto">{search.query} · {search.resultCount} {ui("نتيجة · مصادر متاحة")}{' '}{search.providersAvailable}/{search.providersAttempted}{inScope.has(search.id) ? '' : ui("· لم يُحتسب (لا مصدر متاح)")}</li>)}</ul>}
    </section>
    <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h4 className="text-xs font-black text-amber-900">{ui("حدود هذا التقييم")}</h4>
      <ul className="mt-1 list-disc space-y-1 pe-4 ps-4 text-xs leading-6 text-amber-900">{assessment.limitations.map((limitation) => <li key={limitation}><SystemText text={limitation} /></li>)}</ul>
    </section>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">{ui(GAP_SCOPE_NOTE)}</p>
    {decisionActions && <div className="mt-3 flex flex-wrap gap-2">{decisionActions}</div>}
  </article>;
}
