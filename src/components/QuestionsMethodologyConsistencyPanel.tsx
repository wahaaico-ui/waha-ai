import type {
  QuestionsMethodologyConsistencyReport,
  ResearchObjectViewWarning,
} from '@/lib/research-objects/types';
import type { ConsistencyPanelStatus } from './ProblemObjectivesConsistencyPanel';

type Props = {
  status: ConsistencyPanelStatus;
  report: QuestionsMethodologyConsistencyReport | null;
  warnings: ResearchObjectViewWarning[];
  error: string;
  onRetry: () => void;
};

const PRESENTATION = {
  passed: { label: 'متسق', shell: 'border-emerald-200 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' },
  warning: { label: 'يحتاج مراجعة', shell: 'border-amber-200 bg-amber-50', badge: 'bg-amber-100 text-amber-900', bar: 'bg-amber-500' },
  failed: { label: 'خلل يحتاج معالجة', shell: 'border-rose-200 bg-rose-50', badge: 'bg-rose-100 text-rose-900', bar: 'bg-rose-500' },
} as const;

const MODE_LABEL = {
  quantitative: 'كمي',
  qualitative: 'نوعي',
  descriptive: 'وصفي',
  unknown: 'غير محسوم',
} as const;

function Score({ label, value, color }: { label: string; value: number; color: string }) {
  return <div><div className="mb-1 flex justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{value}/100</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div></div>;
}

export default function QuestionsMethodologyConsistencyPanel({ status, report, warnings, error, onRetry }: Props) {
  if (status === 'idle') return null;
  if (status === 'loading') return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-live="polite"><div className="h-4 w-44 animate-pulse rounded bg-blue-100" /><p className="mt-4 text-sm text-slate-500">جارٍ فحص قدرة المنهجية على الإجابة عن الأسئلة…</p></section>;
  if (status === 'error' || !report) return <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert"><h2 className="font-black text-rose-950">تعذر تحميل فحص الاتساق</h2><p className="mt-2 text-sm leading-7 text-rose-800">{error || 'تعذر قراءة نتيجة الفحص.'}</p><button type="button" onClick={onRetry} className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-800">إعادة المحاولة</button></section>;

  const style = PRESENTATION[report.status];
  const hasMethodology = Boolean(report.methodologyId);
  return <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${style.shell}`} aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-bold text-blue-700">محرك الاتساق البحثي · الأسئلة ↔ المنهجية</div><h2 className="mt-2 text-xl font-black text-slate-950">{hasMethodology ? report.summary : 'احفظ تصميم المنهجية لبدء فحص قدرته على الإجابة عن الأسئلة.'}</h2></div>{hasMethodology ? <span className={`rounded-full px-3 py-1 text-xs font-black ${style.badge}`}>{style.label}</span> : null}</div>
    {status === 'stale' ? <p className="mt-4 rounded-xl border border-amber-300 bg-white/70 p-3 text-sm font-bold leading-7 text-amber-900">عدّلت المنهجية بعد آخر فحص. النتيجة تخص النسخة المحفوظة السابقة؛ احفظ التعديلات لتحديثها.</p> : null}
    {hasMethodology ? <><div className="mt-5 grid gap-4 sm:grid-cols-2"><Score label="الاتساق العام" value={report.overallScore} color={style.bar} /><Score label="الأسئلة التي تغطيها المنهجية" value={report.coverageScore} color={style.bar} /></div>
      {report.issues.length ? <ul className="mt-5 space-y-2 rounded-xl border border-white/80 bg-white/70 p-4 text-sm leading-7 text-slate-800">{report.issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : null}
      <div className="mt-5 space-y-3">{report.results.map((result, index) => <article key={result.id} className="rounded-xl border border-white/90 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-slate-950">السؤال {index + 1} · نمطه المستنتج: {MODE_LABEL[result.inferredQuestionMode]}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-black ${PRESENTATION[result.status].badge}`}>{result.score}/100</span></div><div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><Score label="ملاءمة المنهج" value={result.dimensions.approachFit} color={PRESENTATION[result.status].bar} /><Score label="اتساق المجتمع" value={result.dimensions.populationAlignment} color={PRESENTATION[result.status].bar} /><Score label="ملاءمة الأداة" value={result.dimensions.instrumentFit} color={PRESENTATION[result.status].bar} /><Score label="وضوح العينة" value={result.dimensions.sampleClarity} color={PRESENTATION[result.status].bar} /></div>{result.gapsFound.length ? <ul className="mt-4 space-y-1 text-sm leading-7 text-slate-700">{result.gapsFound.map((gap) => <li key={gap}>• {gap}</li>)}</ul> : null}<p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm leading-7 text-blue-950"><strong>الخطوة المقترحة:</strong> {result.suggestedAction}</p></article>)}</div>
    </> : null}
    {warnings.length ? <ul className="mt-4 space-y-1 text-xs leading-6 text-slate-600">{warnings.map((warning) => <li key={`${warning.code}:${warning.documentId || 'none'}`}>• {warning.message}</li>)}</ul> : null}
    <p className="mt-5 border-t border-slate-200/80 pt-4 text-xs leading-6 text-slate-600">هذا فحص استدلالي مساعد للعلاقات المنهجية في النسخة المحفوظة، وليس حكمًا نهائيًا على صلاحية التصميم أو بديلًا عن مراجعة المشرف ولجنة الأخلاقيات.</p>
  </section>;
}
