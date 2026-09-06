'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import {
  buildDiscussionDraft,
  researchDiscussionConsistencyIssue,
  type ResearchDiscussionOutput,
} from '@/lib/research-discussion';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;
type Paper = { id: string; title: string; year?: number | string };
type Theme = { title: string; synthesis: string; supportingPaperIds: string[] };

function savedDiscussion(output: Record<string, unknown> | undefined): ResearchDiscussionOutput | null {
  if (!output || !Array.isArray(output.discussions)) return null;
  return output as ResearchDiscussionOutput;
}

export default function ResearchDiscussionPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [form, setForm] = useState<ResearchDiscussionOutput | null>(null);
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
        const saved = savedDiscussion(loaded.outputs.discussion);
        setForm(saved || buildDiscussionDraft(loaded.outputs.results));
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

  const papers = useMemo(() => {
    const value = journey?.outputs.literature?.papers;
    return Array.isArray(value)
      ? value.filter((paper): paper is Paper => Boolean(paper && typeof paper === 'object' && typeof paper.id === 'string' && typeof paper.title === 'string'))
      : [];
  }, [journey]);
  const themes = useMemo(() => {
    const value = journey?.outputs.analysis?.themes;
    return Array.isArray(value)
      ? value.filter((theme): theme is Theme => Boolean(theme && typeof theme === 'object' && typeof theme.title === 'string' && typeof theme.synthesis === 'string' && Array.isArray(theme.supportingPaperIds)))
      : [];
  }, [journey]);
  const groundedPaperIds = useMemo(() => new Set(themes.flatMap((theme) => theme.supportingPaperIds)), [themes]);
  const availablePapers = useMemo(() => papers.filter((paper) => groundedPaperIds.has(paper.id)), [groundedPaperIds, papers]);
  const paperById = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers]);
  const resultsComplete = Boolean(journey && stageComplete('results', journey.outputs.results));
  const validationIssue = useMemo(() => journey && form
    ? researchDiscussionConsistencyIssue(form as unknown as Record<string, unknown>, journey.outputs.results, journey.outputs.analysis)
    : 'جارٍ إعداد المناقشة من النتائج المعتمدة.', [form, journey]);
  const loading = Boolean(projectId) && loadedProjectId !== projectId;

  function updateItem(index: number, field: 'interpretation' | 'literatureComparison', value: string) {
    setStatus('idle');
    setForm((current) => current ? {
      ...current,
      discussions: current.discussions.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    } : current);
  }

  function togglePaper(index: number, paperId: string) {
    setStatus('idle');
    setForm((current) => current ? {
      ...current,
      discussions: current.discussions.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const selected = item.supportingPaperIds.includes(paperId)
          ? item.supportingPaperIds.filter((id) => id !== paperId)
          : [...item.supportingPaperIds, paperId];
        return { ...item, supportingPaperIds: selected };
      }),
    } : current);
  }

  async function save() {
    if (!projectId || !form || validationIssue || status === 'saving') return;
    setStatus('saving');
    setError('');
    try {
      await saveJourneyStage(projectId, 'discussion', {
        ...form,
        discussions: form.discussions.map((item) => ({
          ...item,
          interpretation: item.interpretation.trim(),
          literatureComparison: item.literatureComparison.trim(),
          supportingPaperIds: [...new Set(item.supportingPaperIds)],
        })),
        overallSynthesis: form.overallSynthesis.trim(),
        limitationsInterpretation: form.limitationsInterpretation.trim(),
      });
      setStatus('saved');
    } catch (reason) {
      setError(reason instanceof JourneyStageSaveError || reason instanceof Error ? reason.message : 'تعذر حفظ المناقشة.');
      setStatus('idle');
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950">
    <SiteHeader />
    <JourneyProgress current="discussion" lang="ar" />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 14 · المناقشة</div>
        <h1 className="mt-4 text-3xl font-black">فسّر النتائج في حدود ما تسمح به الأدلة</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">ناقش معنى كل نتيجة، ثم قارنها بدراسة أو أكثر من الأدلة التي اخترتها سابقاً. لا تضف رقماً جديداً، ولا تحوّل التفسير إلى توصية تنفيذية.</p>
      </header>

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ إعداد المناقشة…</section>
      : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">اختر مشروعاً</Link></section>
      : error && !journey ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
      : !resultsComplete ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">اعتمد النتائج أولاً</h2><p className="mt-3 text-sm leading-7 text-amber-900">لا يمكن مناقشة نتيجة قبل تثبيت صيغتها وربطها بمخرج التحليل.</p><Link href={`/research/results?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى النتائج</Link></section>
      : !availablePapers.length ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">لا توجد أدلة مخُلَّقة للمقارنة</h2><p className="mt-3 text-sm leading-7 text-amber-900">أعد تحليل الأدبيات حتى يحتوي على محاور مسندة بالدراسات المختارة.</p><Link href={`/research/analysis?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى تحليل الأدبيات</Link></section>
      : journey && form ? <>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">النتائج المقفلة</p><p className="mt-2 text-sm font-black text-emerald-950">{form.discussions.length} نتيجة معتمدة</p></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-bold text-blue-700">الأدلة المتاحة</p><p className="mt-2 text-sm font-black text-blue-950">{availablePapers.length} دراسة موثقة</p></div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-xs font-bold text-violet-700">الحد المنهجي</p><p className="mt-2 text-sm font-black text-violet-950">تفسير ومقارنة بلا توصيات</p></div>
        </section>

        <section className="space-y-5">
          {form.discussions.map((item, index) => <article key={item.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">النتيجة المعتمدة للسؤال {index + 1}</p><p className="mt-2 text-sm font-bold leading-7 text-emerald-950">{item.resultStatement}</p><p className="mt-2 border-t border-emerald-200 pt-2 text-xs leading-6 text-emerald-800">{item.questionText}</p></div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">ماذا تعني هذه النتيجة في سياق الدراسة؟
                <textarea value={item.interpretation} onChange={(event) => updateItem(index, 'interpretation', event.target.value)} maxLength={2400} rows={7} placeholder="فسّر المعنى المحتمل بحذر، واربطه بالسياق والمنهج دون ادعاء سببية غير مثبتة…" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              </label>
              <label className="space-y-2 text-sm font-bold">كيف تتفق أو تختلف مع الأدبيات المختارة؟
                <textarea value={item.literatureComparison} onChange={(event) => updateItem(index, 'literatureComparison', event.target.value)} maxLength={2400} rows={7} placeholder="قارن اتجاه النتيجة بما ورد في الأدلة المحددة، واذكر حدود المقارنة…" className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
              </label>
            </div>
            <fieldset className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4"><legend className="px-2 text-sm font-black text-blue-950">اختر الأدلة المستخدمة فعلاً في المقارنة</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{availablePapers.map((paper) => <label key={paper.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-blue-100 bg-white p-3 text-xs leading-6 text-slate-700"><input type="checkbox" checked={item.supportingPaperIds.includes(paper.id)} onChange={() => togglePaper(index, paper.id)} className="mt-1 h-4 w-4" /><span><strong>{paper.title}</strong>{paper.year ? ` (${paper.year})` : ''}</span></label>)}</div></fieldset>
            {item.supportingPaperIds.length ? <div className="mt-4 space-y-2">{themes.filter((theme) => theme.supportingPaperIds.some((id) => item.supportingPaperIds.includes(id))).map((theme) => <div key={theme.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-7 text-slate-700"><strong>{theme.title}:</strong> {theme.synthesis}<div className="mt-2 text-[11px] font-bold text-blue-700">{theme.supportingPaperIds.filter((id) => item.supportingPaperIds.includes(id)).map((id) => paperById.get(id)?.title || id).join('، ')}</div></div>)}</div> : null}
          </article>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label className="space-y-2 text-sm font-bold">الخلاصة التفسيرية للمناقشة
            <textarea value={form.overallSynthesis} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, overallSynthesis: event.target.value } : current); }} maxLength={3000} rows={6} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <label className="mt-5 block space-y-2 text-sm font-bold">كيف تؤثر حدود الدراسة في تفسير النتائج؟
            <textarea value={form.limitationsInterpretation} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, limitationsInterpretation: event.target.value } : current); }} maxLength={1600} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-3 font-normal leading-7" />
          </label>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><input type="checkbox" checked={form.evidenceGroundingConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, evidenceGroundingConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أن المقارنات مبنية على الأدلة المحددة داخل المشروع.</span></label><label className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950"><input type="checkbox" checked={form.noNewResultsConfirmed} onChange={(event) => { setStatus('idle'); setForm((current) => current ? { ...current, noNewResultsConfirmed: event.target.checked as true } : current); }} className="mt-1 h-4 w-4" /><span>أؤكد أنني لم أضف نتائج أو قيماً جديدة أثناء التفسير.</span></label></div>
          {validationIssue ? <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{validationIssue}</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p> : null}
          <button type="button" onClick={() => void save()} disabled={Boolean(validationIssue) || status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ التحقق والحفظ…' : 'اعتماد مناقشة النتائج'}</button>
          {status === 'saved' && !validationIssue ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold leading-7 text-emerald-900">تم حفظ المناقشة والتحقق من ارتباطها بالنتائج والأدلة. المرحلة التالية هي الاستنتاجات.</p> : null}
        </section>
      </> : null}
    </main>
  </div>;
}
