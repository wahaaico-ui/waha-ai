'use client';

import Link from 'next/link';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { useProjectId } from '@/lib/use-project-id';
import type { ResearchObjectViewWarning } from '@/lib/research-objects/types';

export type ConsistencyPanelStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export type AdvisoryProps = {
  status: ConsistencyPanelStatus;
  warnings: ResearchObjectViewWarning[];
  error: string;
  onRetry: () => void;
};

export default function ResearchConsistencyAdvisory({
  status, warnings, error, onRetry, hasReport, relationship, prompts,
}: AdvisoryProps & { hasReport: boolean; relationship: string; prompts: string[] }) {
  const { text: ui, direction: uiDirection } = useUiTranslation();
  const projectId = useProjectId();

  if (status === 'idle') return null;
  return (
    <section dir={uiDirection} aria-live="polite" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black text-slate-950">{ui("مراجعة أولية للعلاقات البحثية")}</h2>
      <p className="mt-2 text-sm font-bold text-blue-700">{ui(relationship)}</p>
      <p className="mt-3 text-sm leading-7 text-slate-600">{ui("هذه مراجعة آلية أولية، وليست قياساً لجودة البحث أو إثباتاً لصلاحية تصميمه.")}</p>
      {projectId && <Link href={`/research/consistency-map?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex text-sm font-bold text-blue-700 underline">{ui("اعرض خريطة الاتساق للبحث كله")}</Link>}
      {status === 'loading' ? <p className="mt-4 text-sm text-slate-500">{ui("جارٍ تحميل المراجعة…")}</p>
        : status === 'error' || !hasReport ? (
          <div role="alert" className="mt-4">
            <p className="text-sm leading-7 text-slate-700">{ui(error) || ui("تعذر تحميل المراجعة الأولية.")}</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-600">{ui("إعادة المحاولة")}</button>
          </div>
        ) : (
          <>
            {status === 'stale' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">{ui("المراجعة تخص النسخة المحفوظة السابقة؛ احفظ التعديلات لتحديثها.")}</p>}
            <p className="mt-4 text-sm leading-7 text-slate-600">{ui("أسئلة للمراجعة بقرار الباحث، وليست استنتاجات آلية:")}</p>
            <ul className="mt-2 list-inside list-disc space-y-2 text-sm leading-7 text-slate-800">
              {prompts.map((prompt) => <li key={ui(prompt)}>{ui(prompt)}</li>)}
            </ul>
            <p className="mt-4 text-xs leading-6 text-slate-500">{ui("التشابه اللفظي وحده لا يمنع اعتماد المرحلة. تبقى الحقول المطلوبة وشروط البنية وسلامة البيانات واجبة.")}</p>
          </>
        )}
      {warnings.length > 0 && <ul className="mt-4 space-y-1 text-xs leading-6 text-slate-600">{warnings.map((warning) => <li key={`${warning.code}:${warning.documentId || 'none'}`}>{ui(warning.message)}</li>)}</ul>}
    </section>
  );
}
