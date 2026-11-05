'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';
import type { EvidenceRecord, LibrarySource } from './types';
import { EVIDENCE_TYPE_LABELS, evidenceStateLabel, formatDateTime, type EvidenceTypeValue } from '@/lib/research-intelligence-ui';

/** One evidence item with its source. The state describes grounding, never truth. */
export default function EvidenceCard({ evidence, source, actions }: { evidence: EvidenceRecord; source?: LibrarySource; actions?: ReactNode }) {
  const { text: ui, language } = useUiTranslation();

  const state = evidenceStateLabel(evidence.state);
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge label={state.label} tone={state.tone} hint={state.hint} />
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{ui(EVIDENCE_TYPE_LABELS[evidence.evidence_type as EvidenceTypeValue] || evidence.evidence_type)}</span>
      {evidence.origin === 'system' && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">{ui("مقترح آلياً")}</span>}
    </div>
    <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-900 [overflow-wrap:anywhere]">{evidence.content}</p>
    {evidence.locator && <p className="mt-1 text-xs text-slate-500">{ui("الموضع في المصدر:")}{' '}{evidence.locator}</p>}
    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
      {evidence.project_reference_id
        ? source ? <><span className="font-bold text-slate-700">{ui("المصدر:")}</span>{source.title}{source.year ? ` (${source.year})` : ''}{source.doi && <span className="block" dir="ltr">DOI: {source.doi}</span>}</> : ui("المصدر محفوظ في مكتبة المشروع.")
        : ui("ملاحظة الباحث دون مصدر مرتبط.")}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] text-slate-400">{ui("سُجّل")}{' '}{formatDateTime(evidence.created_at, language)}</span>
      {actions}
    </div>
  </article>;
}
