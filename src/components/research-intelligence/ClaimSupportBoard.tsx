import type { ReactNode } from 'react';
import StatusBadge from './StatusBadge';
import type { ClaimRecord, EvidenceRecord } from './types';
import { RELATIONS, RELATION_LABELS, supportOriginLabel, TONE_CLASSES } from '@/lib/research-intelligence-ui';

/**
 * How the evidence relates to one claim, grouped by relation. Supporting and
 * contradicting evidence are shown side by side; unreviewed suggestions are
 * marked and kept apart from links the researcher made or confirmed.
 */
export default function ClaimSupportBoard({ claim, evidenceById, renderLinkActions }: {
  claim: ClaimRecord; evidenceById: Map<string, EvidenceRecord>; renderLinkActions?: (supportId: string, confirmation: string) => ReactNode;
}) {
  if (!claim.supports.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm leading-7 text-slate-500">اربط الأدلة بالادعاء وحدد ما إذا كانت تدعمه أو تعارضه أو توفر سياقاً له.</p>;
  }
  return <div className="grid gap-3 sm:grid-cols-2">
    {RELATIONS.map((relation) => {
      const links = claim.supports.filter((support) => support.relation === relation);
      const meta = RELATION_LABELS[relation];
      return <section key={relation} data-relation={relation} className={`rounded-xl border p-3 ${TONE_CLASSES[meta.tone]}`}>
        <h4 className="text-xs font-black">{meta.plural} ({links.length})</h4>
        {links.length === 0 ? <p className="mt-2 text-[11px] opacity-80">لا يوجد.</p> : <ul className="mt-2 space-y-2">
          {links.map((support) => {
            const origin = supportOriginLabel(support.origin, support.confirmation);
            const evidence = evidenceById.get(support.evidence_item_id);
            return <li key={support.id} data-confirmation={support.confirmation} className={`rounded-lg bg-white p-2.5 text-xs leading-6 text-slate-800 ${support.confirmation === 'suggested' ? 'border border-dashed border-amber-300' : support.confirmation === 'rejected' ? 'opacity-60' : ''}`}>
              <p className="break-words [overflow-wrap:anywhere]">{evidence ? evidence.content : 'دليل غير متاح'}</p>
              {support.rationale && <p className="mt-1 text-[11px] text-slate-500">المبرر: {support.rationale}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusBadge label={origin.label} tone={origin.tone} />{renderLinkActions?.(support.id, support.confirmation)}</div>
            </li>;
          })}
        </ul>}
      </section>;
    })}
  </div>;
}
