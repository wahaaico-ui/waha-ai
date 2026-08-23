'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';

type ProblemOutput = { problemStatement?: string; researchGap?: string; researcherNote?: string };

export default function ResearchObjectivesPage() {
  const [projectId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('projectId') || '');
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [problem, setProblem] = useState<ProblemOutput | null>(null);
  const [objectives, setObjectives] = useState<string[]>(['', '']);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        setProblem((journey.outputs.problem as ProblemOutput | undefined) || null);
        const saved = journey.outputs.objectives?.objectives;
        if (Array.isArray(saved) && saved.every((item) => typeof item === 'string')) setObjectives(saved.length >= 2 ? saved as string[] : ['', '']);
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const validObjectives = objectives.map((objective) => objective.trim()).filter((objective) => objective.length >= 20);
  const canSave = validObjectives.length >= 2;
  const updateObjective = (index: number, value: string) => setObjectives((current) => current.map((objective, objectiveIndex) => objectiveIndex === index ? value : objective));

  const saveObjectives = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving');
    try { await saveJourneyStage(projectId, 'objectives', { objectives: validObjectives }); setStatus('saved'); }
    catch { setStatus('error'); }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="objectives" lang="ar" /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 4 · الأهداف</div><h1 className="mt-4 text-3xl font-black">حوّل المشكلة إلى نتائج يمكن للبحث تحقيقها</h1><p className="mt-3 text-sm leading-7 text-slate-600">كل هدف يجب أن يكون محدداً وقابلاً للفحص، وأن يعالج جزءاً من المشكلة أو الفجوة المحفوظة.</p></header>
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل مشكلة البحث…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section>
    : !problem?.problemStatement || !problem.researchGap || !problem.researcherNote ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة الأهداف مغلقة</h2><p className="mt-3 text-sm text-amber-900">اعتمد المشكلة والفجوة وملاحظتك الشخصية أولاً.</p><Link href={`/research/problem?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى المشكلة والفجوة</Link></section>
    : <><section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">بوابة المشكلة مفتوحة من سجل المشروع</div><p className="mt-2 text-sm leading-7 text-emerald-950"><strong>المشكلة:</strong> {problem.problemStatement}</p><p className="mt-2 text-sm leading-7 text-emerald-950"><strong>الفجوة المحتملة:</strong> {problem.researchGap}</p></section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{objectives.map((objective, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-2 flex items-center justify-between"><label htmlFor={`objective-${index}`} className="text-sm font-black">الهدف {index + 1}</label>{objectives.length > 2 && <button type="button" onClick={() => setObjectives((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs font-bold text-rose-600">حذف</button>}</div><textarea id={`objective-${index}`} value={objective} onChange={(event) => updateObjective(index, event.target.value)} className="min-h-24 w-full bg-transparent text-sm leading-7 outline-none" placeholder="مثال: تحديد أثر ... على ... لدى ..." /><div className="mt-1 text-left text-xs text-slate-400">{objective.trim().length}/20</div></div>)}
        <button type="button" onClick={() => setObjectives((current) => [...current, ''])} className="w-full rounded-xl border border-dashed border-blue-300 py-3 text-sm font-bold text-blue-700">+ إضافة هدف</button><p className="text-xs leading-6 text-slate-500">المطلوب هدفان واضحان على الأقل. تجنب أفعال مثل “التعرف” وحدها؛ اذكر ماذا ستقيس أو تصف أو تقارن.</p>{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">تعذر الحفظ؛ لم تُفتح الأسئلة.</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveObjectives()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ والتحقق…' : 'اعتماد الأهداف وفتح الأسئلة'}</button>{status === 'saved' && <Link href={`/research/questions?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">تم الحفظ. انتقل إلى أسئلة البحث ←</Link>}</section></>}
  </main></div>;
}
