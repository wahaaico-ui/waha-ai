'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import {
  buildResultsDraft,
  researchResultsConsistencyIssue,
  type ResearchResultsOutput,
} from '@/lib/research-results';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;

function savedResults(output: Record<string, unknown> | undefined): ResearchResultsOutput | null {
  if (!output || !Array.isArray(output.results)) return null;
  return output as ResearchResultsOutput;
}

export default function ResearchResultsPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [form, setForm] = useState<ResearchResultsOutput | null>(null);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    loadJourney(projectId)
      .then((loaded) => {
        if (!active) return;
        setJourney(loaded);
        const saved = savedResults(loaded.outputs.results);
        setForm(saved || buildResultsDraft(loaded.outputs.analysis_input));
        setStatus(saved ? 'saved' : 'idle');
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.');
      })
      .finally(() => {
        if (active) setLoadedProjectId(projectId);
      });
    return () => { active = false; };
  }, [projectId]);

  const loading = Boolean(projectId) && loadedProjectId !== projectId;
  const analysisInputComplete = Boolean(journey && stageComplete('analysis_input', journey.outputs.analysis_input));
  const validationIssue = useMemo(() => journey && form
    ? researchResultsConsistencyIssue(form as unknown as Record<string, unknown>, journey.outputs.analysis_input)
    : 'جارٍ إعداد النتائج من مخرجات التحليل المعتمدة.', [form, journey]);

  function updateResult(index: number, resultStatement: string) {
    setStatus('idle');
    setForm((current) => current ? {
      ...current,
      results: current.results.map((result, resultIndex) => resultIndex === index ? { ...result, resultStatement } : result),
    } : current);
  }

  async function save() {
    if (!projectId || !form || validationIssue || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await saveJourneyStage(projectId, 'results', {
        ...form,
        results: form.results.map((result) => ({ ...result, resultStatement: result.resultStatement.trim() })),
        overallSummary: form.overallSummary.trim(),
        limitations: form.limitations.trim(),
      });
      setStatus('saved');
    } catch (reason) {
      setError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ النتائج.');
      setStatus('idle');
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="results" lang="ar" />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 13 · النتائج</div>
        <h1 className="mt-4 text-3xl font-black">حوّل المخرجات المعتمدة إلى نتائج واضحة</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">أنشأ النظام مسودة أولية من النص الذي أدخلته أنت في التحليل الخارجي. راجع الدقة واللغة فقط؛ لا تضف تفسيراً للأسباب ولا مقارنة بالدراسات السابقة هنا، فمكانهما مرحلة المناقشة.</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ إعداد النتائج…</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">اختر مشروعاً</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
      : !analysisInputComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">اعتمد مخرجات التحليل الخارجي أولاً</h2><p className="mt-3 text-sm leading-7 text-amber-900">لا يمكن كتابة نتائج موثوقة قبل ربط مخرج فعلي بكل سؤال وفرضية.</p><Link href={`/research/analysis-input?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى مخرجات التحليل</Link></section>
      : journey && form ? <>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">المصدر</p><p className="mt-2 text-sm font-black text-emerald-950">تحليلك الخارجي المعتمد</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">التغطية</p><p className="mt-2 text-sm font-black text-blue-950">{form.results.length} نتيجة مقابل {form.results.length} سؤال</p></div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">الحد المنهجي</p><p className="mt-2 text-sm font-black text-violet-950">عرض بلا تفسير أو توصيات</p></div>
        </section>

        <section className="space-y-4">
          {form.results.map((result, index) => <article key={result.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">السؤال {index + 1}</p><p className="mt-2 text-sm font-bold leading-7 text-blue-950">{result.questionText}</p>{result.hypothesisText ? <p className="mt-2 border-t border-blue-200 pt-2 text-xs leading-6 text-blue-800"><strong>الفرضية المقابلة:</strong> {result.hypothesisText}</p> : null}</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-7 text-slate-700"><p className="font-black text-slate-900">المخرج المقفل الذي تعتمد عليه الصياغة</p><p className="mt-2"><strong>ما ظهر:</strong> {result.sourceFindingSummary}</p><p className="mt-2"><strong>الدليل:</strong> {result.sourceEvidenceSummary}</p></div>
              <label className="space-y-2 text-sm font-bold">صياغة النتيجة
                <textarea value={result.resultStatement} onChange={(event) => updateResult(index, event.target.value)} maxLength={1800} rows={7} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
                <span className="block text-xs font-normal leading-6 text-slate-500">حافظ على كل الأرقام والقيم كما ظهرت. لا تكتب «بسبب» أو «نوصي» أو تقارن بدراسة أخرى.</span>
              </label>
            </div>
          </article>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="space-y-2 text-sm font-bold">الخلاصة العامة للنتائج
            <textarea value={form.overallSummary} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, overallSummary: event.target.value } : current); }} maxLength={2400} rows={5} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <label className="mt-5 block space-y-2 text-sm font-bold">حدود عرض النتائج
            <textarea value={form.limitations} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, limitations: event.target.value } : current); }} maxLength={1200} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <label className="mt-5 flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950"><input type="checkbox" checked={form.reportingOnlyConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, reportingOnlyConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أن هذا القسم يعرض ما أظهره التحليل فقط، وأن تفسير النتائج ومقارنتها بالأدبيات مؤجل إلى مرحلة المناقشة.</span></label>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{validationIssue}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ التحقق والحفظ…' : 'اعتماد النتائج'}</button>
          {status === 'saved' && !validationIssue ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-7 text-emerald-900">تم حفظ النتائج والتحقق من ارتباطها بمخرجات التحليل. المرحلة التالية في الخطة هي المناقشة، ولم تُفتح بعد ضمن هذه المرحلة.</p> : null}
        </section>
      </> : null}
    </main>
  </div>;
}
