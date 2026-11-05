'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useEffect, useState } from 'react';
import PdfReadingHistory from '@/components/PdfReadingHistory';

type Source = { id: string; raw_text?: string | null; title?: string | null };
type Analysis = { sourceId: string; output: string; documentId: string };
export default function PdfProjectResults({ projectId, sources, refreshKey, currentText, currentAnalysis, analysisSaved, partial }: { projectId: string; sources: Source[]; refreshKey: number; currentText: string; currentAnalysis: string; analysisSaved: boolean; partial: boolean }) {
  const { text: ui } = useUiTranslation();

  const [state, setState] = useState<{ projectId: string; analyses: Analysis[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);
  const [readingWarning, setReadingWarning] = useState<{ projectId: string; partial: boolean } | null>(null);
  const analyses = state?.projectId === projectId ? state.analyses : [];
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/academic/parse-pdf?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("تعذر استرجاع حدود القراءة؛ افتح تفاصيل القراءة وأعد المحاولة.");
      const body = await response.json();
      if (!controller.signal.aborted) setReadingWarning({ projectId, partial: (body.reports || []).some((report: { reading: { complete: boolean } }) => !report.reading.complete) });
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    fetch(`/api/academic/pdf-analyzer?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error("تعذر استرجاع التحليلات المحفوظة.");
      if (!controller.signal.aborted) { setState({ projectId, analyses: body.analyses || [] }); setError(''); }
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [projectId, refreshKey, revision]);
  const analyze = async (source: Source) => {
    setBusy(source.id); setError('');
    try {
      const response = await fetch('/api/academic/pdf-analyzer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, text: source.raw_text }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'تعذر حفظ التحليل؛ النص باقٍ.');
      if (!body.saved) throw new Error("التحليل غير متاح الآن. النص محفوظ؛ يمكنك إعادة المحاولة.");
      setRevision((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر التحليل.'); }
    finally { setBusy(''); }
  };
  return <section aria-label={ui("نتائج PDF")} className="rounded-xl bg-white p-5 shadow dark:bg-gray-800">
    <h2 className="text-lg font-bold">{ui("نصوص PDF ونتائجها")}</h2>
    <p className="mt-2 text-sm leading-7">{ui("راجع النص أولًا. التحليل الآلي مبني على النص المستخرج فقط، ولا يثبت نتائج الدراسة أو قراءة الأشكال والجداول. لا يُضاف النص تلقائيًا إلى مقارنة المستخلصات.")}</p>
    {(partial || (readingWarning?.projectId === projectId && readingWarning.partial)) && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{ui("توجد قراءة غير مكتملة أو تحتاج مراجعة؛ افتح تفاصيل القراءة قبل استخدام النص.")}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{ui(error)}</p>}
    {currentText && <article className="mt-4"><h3 className="font-bold">{ui("النص المستخرج الحالي")}</h3><pre dir="auto" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 text-sm">{currentText}</pre></article>}
    {currentAnalysis && !analysisSaved && <article className="mt-4 rounded-lg border border-amber-300 p-3"><h3 className="font-bold">{ui("تحليل حالي غير محفوظ — لا يمكن استعادته بعد المغادرة")}</h3><p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm">{currentAnalysis}</p></article>}
    {!sources.length && !currentText && <p className="mt-4 text-sm">{ui("ابدأ برفع ملف أدناه؛ ستظهر النصوص المحفوظة هنا عند العودة.")}</p>}
    {sources.map((source) => { const result = analyses.find((item) => item.sourceId === source.id); return <article key={source.id} className="mt-4 rounded-lg border p-4">
      <h3 className="font-bold">{source.title || ui("نص مستخرج محفوظ")}</h3><pre dir="auto" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm">{source.raw_text}</pre>
      <button type="button" onClick={() => void navigator.clipboard.writeText(source.raw_text || '')} className="mt-2 rounded-lg border px-3 py-2 text-sm">{ui("نسخ النص")}</button>
      {result ? <div className="mt-4"><h4 className="font-bold">{ui("تحليل آلي محفوظ — يحتاج مراجعة")}</h4><p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{result.output}</p></div> : <button type="button" disabled={Boolean(busy) || !source.raw_text} onClick={() => void analyze(source)} className="ms-2 mt-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-40">{busy === source.id ? ui("جارٍ التحليل…") : ui("حلّل النص المحفوظ")}</button>}
    </article>; })}
    <details className="mt-5 rounded-lg border p-3"><summary className="cursor-pointer font-bold">{ui("تفاصيل القراءة")}</summary><div className="mt-3"><PdfReadingHistory projectId={projectId} refreshKey={refreshKey} /></div></details>
  </section>;
}
