'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { assessAcademicText, assessProblemDraft } from '@/lib/academic-content-quality';
import { useProjectId } from '@/lib/use-project-id';

type VerifyOutput = { topic?: string; gaps?: string[] };
type TitleOutput = { title?: string };
type ProblemOutput = { problemStatement?: string; researchGap?: string; researcherNote?: string };

export default function ResearchProblemPage() {
  const router = useRouter();
  const projectId = useProjectId();
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [verify, setVerify] = useState<VerifyOutput | null>(null);
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [gap, setGap] = useState('');
  const [researcherNote, setResearcherNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        setVerify((journey.outputs.verify as VerifyOutput | undefined) || null);
        const savedTitle = (journey.outputs.title as TitleOutput | undefined)?.title;
        if (savedTitle) setTitle(savedTitle);
        const savedProblem = (journey.outputs.problem as ProblemOutput | undefined) || {};
        setStatement(savedProblem.problemStatement || '');
        setGap(savedProblem.researchGap || '');
        setResearcherNote(savedProblem.researcherNote || '');
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const fieldAssessments = [
    { label: 'مشكلة واضحة', assessment: assessAcademicText(statement, { minChars: 50, minWords: 8, label: 'مشكلة البحث' }) },
    { label: 'فجوة محددة', assessment: assessAcademicText(gap, { minChars: 35, minWords: 6, label: 'الفجوة البحثية' }) },
    { label: 'صوت الباحث', assessment: assessAcademicText(researcherNote, { minChars: 20, minWords: 4, label: 'سبب اهتمامك' }) },
  ];
  const problemAssessment = assessProblemDraft({ title, problemStatement: statement, researchGap: gap, researcherNote });
  const qualityIssue = problemAssessment.reason || '';
  const canSave = !qualityIssue;

  const saveProblem = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving'); setSaveError('');
    try {
      await saveJourneyStage(projectId, 'problem', {
        problemStatement: statement.trim(),
        researchGap: gap.trim(),
        researcherNote: researcherNote.trim(),
      });
      setStatus('saved');
      router.push(`/research/objectives?projectId=${encodeURIComponent(projectId)}`);
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'تعذر اعتماد المرحلة.'); setStatus('error'); }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950">
      <SiteHeader /><JourneyProgress current="problem" lang="ar" />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
        <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 3 · المشكلة والفجوة</div><h1 className="mt-4 text-3xl font-black">حوّل العنوان إلى مشكلة بحث قابلة للدراسة</h1><p className="mt-3 text-sm leading-7 text-slate-600">الواحة تقترح المشكلة والفجوة من مشروعك. مهمتك أن تراجع الاقتراح، ثم تكتب سبب اهتمامك بالموضوع بكلماتك.</p></header>

        {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل العنوان ومؤشرات الفجوة…</section>
        : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><p className="mt-3 text-sm text-amber-900">سجّل الدخول وأكمل مقارنة العناوين داخل مشروعك أولاً.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
        : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section>
        : !title ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة المشكلة مغلقة</h2><p className="mt-3 text-sm leading-7 text-amber-900">قارن العناوين واعتمد أحدها أولاً؛ لا يمكن تحديد مشكلة دقيقة قبل تثبيت نطاق البحث.</p><Link href={`/research?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى مقارنة العناوين</Link></section>
        : <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">بوابة العنوان مفتوحة من سجل المشروع</div><p className="mt-2 text-sm leading-7 text-emerald-950"><strong>العنوان المعتمد:</strong> {title}</p></section>

          <ResearchDraftAssistant projectId={projectId} stage="problem" showTools={false} onDraft={(draft) => {
            if (typeof draft.problemStatement === 'string') setStatement(draft.problemStatement);
            if (typeof draft.researchGap === 'string') setGap(draft.researchGap);
            setStatus('idle');
          }} />

          {verify?.gaps && verify.gaps.length > 0 && <section className="rounded-2xl border border-amber-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">مؤشرات من تقرير الاستكشاف</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">استنتاجات تحتاج تحققاً</span></div><ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">{verify.gaps.map((item) => <li key={item} className="flex gap-2"><span className="text-amber-500">◆</span><span>{item}</span></li>)}</ul></section>}

          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-7 text-blue-950"><strong>كيف تستخدم هذه الصفحة؟</strong><ol className="mt-2 list-decimal space-y-1 pr-5"><li>اضغط «اقترح مسودة من مشروعي».</li><li>راجع المشكلة والفجوة وعدّلهما إن لزم.</li><li>اكتب سبب اهتمامك، ثم اعتمد للانتقال إلى الأهداف.</li></ol></div>
            <div><label htmlFor="problem-statement" className="text-sm font-black">1. مشكلة البحث المقترحة</label><p className="mt-1 text-xs leading-6 text-slate-500">يجب أن توضّح الواقع، ومن يتأثر، وما الذي لم يُفهم أو يُعالج بعد.</p><textarea id="problem-statement" value={statement} onChange={(event) => { setStatement(event.target.value); setStatus('idle'); }} className="mt-3 min-h-40 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="استخدم المساعد لإعداد مسودة، أو اكتب المشكلة هنا…" /><div className="mt-1 text-left text-xs text-slate-400">{statement.trim().length}/50 حرفاً · 8 كلمات على الأقل</div></div>
            <div><label htmlFor="research-gap" className="text-sm font-black">2. الفجوة التي سيختبرها البحث</label><p className="mt-1 text-xs leading-6 text-slate-500">توضح ما الذي لم تحسمه الأدلة أو ما السياق الذي يحتاج دراسة، دون ادعاء أن الموضوع لم يُدرس قط.</p><textarea id="research-gap" value={gap} onChange={(event) => { setGap(event.target.value); setStatus('idle'); }} className="mt-3 min-h-32 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="تشير الأدلة المتاحة إلى محدودية… في سياق…" /><div className="mt-1 text-left text-xs text-slate-400">{gap.trim().length}/35 حرفاً · 6 كلمات على الأقل</div></div>
            <div><label htmlFor="researcher-note" className="text-sm font-black">3. لماذا ترى هذه المشكلة مهمة؟</label><p className="mt-1 text-xs leading-6 text-slate-500">اكتب 2–4 أسطر بكلماتك. نحفظها لإبراز صوتك وسبب اختيارك عند بناء المقدمة والسيمنار لاحقاً.</p><textarea id="researcher-note" value={researcherNote} onChange={(event) => setResearcherNote(event.target.value)} className="mt-3 min-h-28 w-full rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="اخترت هذه المشكلة لأن…" /><div className="mt-1 text-left text-xs text-slate-400">{researcherNote.trim().length}/20 حداً أدنى</div></div>
            <div className="grid gap-2 sm:grid-cols-3">{fieldAssessments.map(({ label, assessment }) => <div key={label} className={`rounded-xl border p-3 text-xs font-bold ${assessment.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{assessment.valid ? '✓' : '○'} {label}</div>)}</div>
            {qualityIssue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">{qualityIssue}</p>}
            {status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-800">{saveError}</p>}
            <button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveProblem()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ والتحقق…' : 'حفظ واعتماد ثم الانتقال إلى الأهداف'}</button>
          </section>
        </>}
      </main>
    </div>
  );
}
