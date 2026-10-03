import StatusBadge from '@/components/research-intelligence/StatusBadge';
import { MAX_REFERENCES, type ReferenceCheckReport, type ReferenceResult } from '@/lib/reference-check';
import { ARABIC_COVERAGE_NOTE, DIFFERENCE_FIELD_LABELS, REFERENCE_PROVIDER_NAMES, REFERENCE_STATUS_LABELS, referenceCheckLimitations, STATUS_ORDER } from '@/lib/reference-check-ui';
import { formatDateTime, TONE_CLASSES } from '@/lib/research-intelligence-ui';

const providerNames = (ids: string[]) => ids.map((id) => REFERENCE_PROVIDER_NAMES[id] || id).join('، ');

function ResultItem({ result }: { result: ReferenceResult }) {
  const status = REFERENCE_STATUS_LABELS[result.status];
  return <li data-status={result.status} className="rounded-xl border border-slate-200 bg-white p-4 text-sm break-inside-avoid">
    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-400">#{result.index}</span><StatusBadge label={status.label} tone={status.tone} /></div>
    <p className="mt-2 break-words text-xs leading-6 text-slate-600 [overflow-wrap:anywhere]" dir="auto">{result.raw}</p>
    <p className="mt-2 text-xs leading-6 text-slate-700">{status.explanation}</p>
    {result.status === 'not_found' && result.arabic && <p className="mt-1 text-xs leading-6 text-amber-800">{ARABIC_COVERAGE_NOTE}</p>}
    {result.differences.length > 0 && <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2.5 text-xs leading-6 text-amber-950">{result.differences.map((difference) => <li key={difference.field}><strong>{DIFFERENCE_FIELD_LABELS[difference.field]}:</strong> في المرجع <span dir="auto">«{difference.cited}»</span> · في الفهرس <span dir="auto">«{difference.found}»</span></li>)}</ul>}
    {result.record && <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs leading-6 text-slate-700">
      <p className="font-bold text-slate-500">السجل المقابل في {REFERENCE_PROVIDER_NAMES[result.record.provider]}:</p>
      <p dir="auto" className="break-words font-bold text-slate-900 [overflow-wrap:anywhere]">{result.record.title}</p>
      <p dir="auto">{result.record.authors.slice(0, 4).join('، ') || 'المؤلفون غير مذكورين في السجل'}{result.record.year ? ` · ${result.record.year}` : ''}</p>
      {result.record.doi && <a href={`https://doi.org/${result.record.doi}`} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 hover:underline" dir="ltr">doi.org/{result.record.doi}</a>}
    </div>}
    {result.closest && <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-2.5 text-xs leading-6 text-slate-600">
      <p className="font-bold">أقرب سجل أعادته الفهارس (ليس مطابقاً للمرجع):</p>
      <p dir="auto" className="break-words [overflow-wrap:anywhere]">{result.closest.title}{result.closest.year ? ` · ${result.closest.year}` : ''}</p>
    </div>}
    {(result.status === 'not_found' || result.status === 'not_checked') && <p className="mt-2 text-[11px] text-slate-500">{result.providersSearched.length ? `بُحث في: ${providerNames(result.providersSearched)}` : ''}{result.providersUnavailable.length ? `${result.providersSearched.length ? ' · ' : ''}تعذر الوصول إلى: ${providerNames(result.providersUnavailable)}` : ''}</p>}
  </li>;
}

/** The reference check report: counts first, then each reference in attention order, then the limitations. */
export default function ReferenceCheckReportView({ report }: { report: ReferenceCheckReport }) {
  const ordered = [...report.results].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.index - b.index);
  return <section aria-labelledby="report-title" className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="report-title" className="text-lg font-black text-slate-950">نتيجة فحص المراجع</h2>
      <p className="mt-1 text-xs text-slate-500">فُحص {report.results.length} مرجعاً في {providerNames(report.providers)} · {formatDateTime(report.checkedAt)}</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{STATUS_ORDER.filter((status) => report.counts[status] > 0 || ['doi_mismatch', 'not_found', 'matched_with_differences', 'matched'].includes(status)).map((status) => <li key={status} data-count={status} className={`rounded-xl border p-3 ${TONE_CLASSES[REFERENCE_STATUS_LABELS[status].tone]}`}><div className="text-2xl font-black">{report.counts[status]}</div><div className="mt-1 text-[11px] font-bold leading-5">{REFERENCE_STATUS_LABELS[status].label}</div></li>)}</ul>
    </div>
    <ol className="space-y-3">{ordered.map((result) => <ResultItem key={result.index} result={result} />)}</ol>
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-black text-amber-900">حدود هذا الفحص</h3>
      <ul className="mt-2 list-disc space-y-1 pe-4 ps-4 text-xs leading-6 text-amber-900">{referenceCheckLimitations(report, MAX_REFERENCES).map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
    </section>
  </section>;
}
