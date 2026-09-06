'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import {
  buildConclusionsDraft,
  researchConclusionsConsistencyIssue,
  type ResearchConclusionsOutput,
} from '@/lib/research-conclusions';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;

function savedConclusions(output: Record<string, unknown> | undefined): ResearchConclusionsOutput | null {
  if (!output || !Array.isArray(output.conclusions)) return null;
  return output as ResearchConclusionsOutput;
}

export default function ResearchConclusionsPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [form, setForm] = useState<ResearchConclusionsOutput | null>(null);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    loadJourney(projectId)
      .then((loaded) => {
        if (!active) return;
        setJourney(loaded);
        const saved = savedConclusions(loaded.outputs.conclusions);
        setForm(saved || buildConclusionsDraft(loaded.outputs.discussion));
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
  const discussionComplete = Boolean(journey && stageComplete('discussion', journey.outputs.discussion));
  const validationIssue = useMemo(() => journey && form
    ? researchConclusionsConsistencyIssue(form as unknown as Record<string, unknown>, journey.outputs.discussion)
    : 'جارٍ إعداد الاستنتاجات من المناقشة المعتمدة.', [form, journey]);

  function updateConclusion(index: number, conclusionStatement: string) {
    setStatus('idle');
    setForm((current) => current ? {
      ...current,
      conclusions: current.conclusions.map((item, itemIndex) => itemIndex === index ? { ...item, conclusionStatement } : item),
    } : current);
  }

  async function save() {
    if (!projectId || !form || validationIssue || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await saveJourneyStage(projectId, 'conclusions', {
        ...form,
        conclusions: form.conclusions.map((item) => ({ ...item, conclusionStatement: item.conclusionStatement.trim() })),
        overallConclusion: form.overallConclusion.trim(),
        scopeStatement: form.scopeStatement.trim(),
      });
      setStatus('saved');
    } catch (reason) {
      setError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ الاستنتاجات.');
      setStatus('idle');
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="conclusions" lang="ar" />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 15 · الاستنتاجات</div>
        <h1 className="mt-4 text-3xl font-black">استخلص ما تجيب عنه الدراسة فعلاً</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">حوّل كل نتيجة مُناقشة إلى استنتاج مباشر يجيب عن سؤال البحث، مع الالتزام بحدود العينة والمنهج. لا تضف دليلاً جديداً ولا تكتب ما ينبغي فعله؛ مكان ذلك مرحلة التوصيات.</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ إعداد الاستنتاجات…</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">اختر مشروعاً</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
      : !discussionComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">اعتمد المناقشة أولاً</h2><p className="mt-3 text-sm leading-7 text-amber-900">الاستنتاج ليس رأياً جديداً؛ يجب اشتقاقه من نتيجة جرى تفسيرها ومقارنتها بالأدلة.</p><Link href={`/research/discussion?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى المناقشة</Link></section>
      : journey && form ? <>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">التغطية</p><p className="mt-2 text-sm font-black text-emerald-950">{form.conclusions.length} استنتاجات مطلوبة</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">المرجع</p><p className="mt-2 text-sm font-black text-blue-950">النتائج والمناقشة المعتمدتان</p></div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">الحد المنهجي</p><p className="mt-2 text-sm font-black text-violet-950">خلاصة بلا توصيات جديدة</p></div>
        </section>

        <section className="space-y-5">
          {form.conclusions.map((item, index) => <article key={item.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">سؤال البحث {index + 1}</p><p className="mt-2 text-sm font-bold leading-7 text-blue-950">{item.questionText}</p></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-7 text-emerald-950"><p className="font-black">النتيجة المعتمدة</p><p className="mt-2">{item.resultStatement}</p></div><div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs leading-7 text-violet-950"><p className="font-black">التفسير المعتمد</p><p className="mt-2">{item.discussionInterpretation}</p></div></div>
            <label className="mt-4 block space-y-2 text-sm font-bold">الاستنتاج الذي يجيب عن السؤال
              <textarea value={item.conclusionStatement} onChange={(event) => updateConclusion(index, event.target.value)} maxLength={2200} rows={6} placeholder="اكتب خلاصة مباشرة ومتحفظة توضّح ما يمكن استنتاجه ضمن حدود الدراسة…" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              <span className="block text-xs font-normal leading-6 text-slate-500">لا تضف نسبة أو قيمة جديدة، ولا تستخدم «نوصي» أو «يجب تطبيق».</span>
            </label>
          </article>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="space-y-2 text-sm font-bold">الاستنتاج العام للدراسة
            <textarea value={form.overallConclusion} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, overallConclusion: event.target.value } : current); }} maxLength={3000} rows={6} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <label className="mt-5 block space-y-2 text-sm font-bold">حدود انطباق الاستنتاجات
            <textarea value={form.scopeStatement} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, scopeStatement: event.target.value } : current); }} maxLength={1800} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><input type="checkbox" checked={form.noNewEvidenceConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, noNewEvidenceConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أن الاستنتاجات لا تضيف دليلاً أو نتيجة جديدة.</span></label><label className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950"><input type="checkbox" checked={form.noRecommendationsConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, noRecommendationsConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أن ما ينبغي فعله مؤجل إلى مرحلة التوصيات.</span></label></div>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{validationIssue}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ التحقق والحفظ…' : 'اعتماد الاستنتاجات'}</button>
          {status === 'saved' && !validationIssue ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold leading-7 text-emerald-900">تم حفظ الاستنتاجات والتحقق من ارتباطها بالمناقشة. المرحلة التالية هي التوصيات.</p> : null}
        </section>
      </> : null}
    </main>
  </div>;
}
