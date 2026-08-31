import type { QuestionsHypothesesConsistencyReport, ResearchObjectViewWarning } from '@/lib/research-objects/types';
import type { ConsistencyPanelStatus } from './ProblemObjectivesConsistencyPanel';

export default function QuestionsHypothesesConsistencyPanel({ status, report, warnings, error, onRetry }: {
  status: ConsistencyPanelStatus;
  report: QuestionsHypothesesConsistencyReport | null;
  warnings: ResearchObjectViewWarning[];
  error: string;
  onRetry: () => void;
}) {
  if (status === 'idle') return null;
  if (status === 'loading') return <section className="rounded-2xl border border-blue-100 bg-white p-5 text-sm text-slate-500">جارٍ فحص قرار الفرضيات واتساقها مع الأسئلة…</section>;
  if (status === 'error' || !report) return <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert"><h2 className="font-black text-rose-950">تعذر تحميل فحص الاتساق</h2><p className="mt-2 text-sm text-rose-800">{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold">إعادة المحاولة</button></section>;
  const colors = report.status === 'passed' ? 'border-emerald-200 bg-emerald-50' : report.status === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50';
  return <section className={`rounded-2xl border p-5 shadow-sm ${colors}`} aria-live="polite"><div className="text-xs font-bold text-blue-700">محرك الاتساق البحثي · الأسئلة ↔ الفرضيات</div><h2 className="mt-2 text-xl font-black">{report.summary}</h2>{status === 'stale' && <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-bold">عدّلت المسودة؛ احفظها لتحديث نتيجة الفحص.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/80 p-4"><span className="text-xs text-slate-500">الاتساق العام</span><strong className="mt-1 block text-2xl">{report.overallScore}/100</strong></div><div className="rounded-xl bg-white/80 p-4"><span className="text-xs text-slate-500">التغطية</span><strong className="mt-1 block text-2xl">{report.coverageScore}/100</strong></div></div>{report.issues.length > 0 && <ul className="mt-4 space-y-1 text-sm leading-7">{report.issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul>}{warnings.length > 0 && <ul className="mt-3 text-xs text-slate-600">{warnings.map((warning) => <li key={`${warning.code}:${warning.documentId}`}>• {warning.message}</li>)}</ul>}<p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-6 text-slate-600">ليس كل بحث بحاجة إلى فرضيات. القرار يعتمد على نوع الأسئلة والتصميم، ويظل خاضعاً لمراجعة المشرف.</p></section>;
}
