import type { SearchRunRecord } from './types';
import { formatDateTime } from '@/lib/research-intelligence-ui';

const CONTEXT_LABELS: Record<string, string> = { literature: 'مرحلة الأدبيات', evidence_panel: 'لوحة الأدلة' };

/** The searches recorded for this project: the basis of any gap assessment. Never presented as exhaustive. */
export default function SearchScopePanel({ runs }: { runs: SearchRunRecord[] }) {
  return <section aria-labelledby="scope-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 id="scope-title" className="text-lg font-black text-slate-950">نطاق البحث المسجل</h2>
    <p className="mt-1 text-sm leading-7 text-slate-600">هذه عمليات البحث التي أجرتها الواحة لهذا المشروع. تقييم الفجوات يستند إليها وحدها، ولا تمثل مراجعة شاملة لكل ما نُشر.</p>
    {runs.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm leading-7 text-slate-500">لا توجد عمليات بحث مسجلة بعد. ابحث من مرحلة الأدبيات أو لوحة الأدلة ليُسجَّل نطاق البحث.</p>
      : <ul className="mt-4 space-y-3">{runs.map((run) => {
        const providers = Array.isArray(run.providers) ? run.providers : [];
        const unavailable = providers.filter((provider) => provider && provider.available === false);
        return <li key={run.id} className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="break-words font-bold text-slate-900 [overflow-wrap:anywhere]" dir="auto">{run.query}</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">{CONTEXT_LABELS[run.context] || run.context} · {formatDateTime(run.executed_at)} · {run.result_count} نتيجة محفوظة{typeof run.candidate_count === 'number' ? ` من ${run.candidate_count} مسترجعة` : ''}</p>
          <p className="mt-1 text-xs leading-6 text-slate-600">المصادر المتاحة: {run.providers_available} من {run.providers_attempted}{providers.length ? ` (${providers.filter((provider) => provider?.available).map((provider) => provider.provider).filter(Boolean).join('، ') || 'لا شيء'})` : ' · تفاصيل المزوّدين غير مسجلة'}</p>
          {unavailable.length > 0 && <p className="mt-1 text-xs leading-6 text-amber-800">تعذّر الوصول إلى: {unavailable.map((provider) => provider.provider || 'مصدر غير معروف').join('، ')}</p>}
          {Array.isArray(run.limitations) && run.limitations.length > 0 && <details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">حدود هذا البحث</summary><ul className="mt-1 list-disc space-y-1 pe-4 ps-4">{run.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>}
        </li>;
      })}</ul>}
  </section>;
}
