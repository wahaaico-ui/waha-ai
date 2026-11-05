'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { assessAcademicText, assessProblemDraft } from '@/lib/academic-content-quality';
import { useProjectId } from '@/lib/use-project-id';
import { useJourneyAutosave } from '@/lib/use-journey-autosave';

type VerifyOutput = {
  topic?: string;
  gaps?: string[];
  researcherInput?: { scenario?: 'uncertain' | 'idea' | 'rejected_title' | 'compare_titles' | 'references_only' };
};
type TitleOutput = { title?: string };
type ProblemOutput = { problemStatement?: string; researchGap?: string; researcherNote?: string };

export default function ResearchProblemPage() {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

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
        const savedProblem = (journey.drafts.problem?.content as ProblemOutput | undefined)
          || (journey.outputs.problem as ProblemOutput | undefined)
          || {};
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
  useJourneyAutosave({
    projectId,
    stage: 'problem',
    content: { problemStatement: statement, researchGap: gap, researcherNote },
    enabled: Boolean(projectId && !loading && title),
  });
  const titleStepLabel = verify?.researcherInput?.scenario === 'compare_titles'
    ? 'مقارنة عناوينك واعتماد أحدها'
    : verify?.researcherInput?.scenario === 'rejected_title'
      ? 'معالجة سبب الرفض واعتماد عنوان محسّن'
      : 'صياغة عنوان محدد واعتماده';

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
    } catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'تعذر حفظ صياغتك. حاول مجدداً.'); setStatus('error'); }
  };

  return (
    <div dir={uiDirection} className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950">
      <SiteHeader /><JourneyProgress current="problem" lang={uiLanguage} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
        <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ui("من العنوان إلى الفكرة")}</div><h1 className="mt-4 text-3xl font-black">{ui("ما الذي تريد أن تفهمه ببحثك؟")}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{ui("ابدأ من عنوانك المحفوظ، وصِف ما يستحق الدراسة. يمكنك الاستعانة بمسودة أولية، ثم تطويرها بالأدلة وبكلماتك.")}</p></header>

        {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تحميل العنوان ومؤشرات الفجوة…")}</section>
        : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("لنفتح مساحة لفكرتك")}</h2><p className="mt-3 text-sm text-amber-900">{ui("سجّل الدخول، ثم استكشف فكرتك واعتمد عنواناً داخل مشروعك أولاً.")}</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("تسجيل الدخول")}</Link></section>
        : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{ui(loadError)}</section>
        : !title ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("لنحدد عنوانك أولاً")}</h2><p className="mt-3 text-sm leading-7 text-amber-900">{ui("أكمل")}{' '}{titleStepLabel} {ui("أولاً؛ لا يمكن بناء مشكلة دقيقة قبل تثبيت نطاق البحث.")}</p><Link href={`/research?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">{ui("تطوير عنوان البحث")}</Link></section>
        : <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">{ui("نبني على عنوانك المحفوظ")}</div><p className="mt-2 text-sm leading-7 text-emerald-950"><strong>{ui("العنوان المعتمد:")}</strong> {title}</p></section>

          <ResearchDraftAssistant projectId={projectId} stage="problem" showTools={false} onDraft={(draft) => {
            if (typeof draft.problemStatement === 'string') setStatement(draft.problemStatement);
            if (typeof draft.researchGap === 'string') setGap(draft.researchGap);
            setStatus('idle');
          }} />

          {verify?.gaps && verify.gaps.length > 0 && <section className="rounded-2xl border border-amber-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">{ui("مؤشرات من تقرير الاستكشاف")}</h2><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{ui("استنتاجات تحتاج تحققاً")}</span></div><ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">{verify.gaps.map((item) => <li key={item} className="flex gap-2"><span className="text-amber-500">◆</span><span>{item}</span></li>)}</ul></section>}

          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-sm leading-7 text-slate-600">{ui("هذه مساحة لتطوير صياغتك، وليست إجابة نهائية يولّدها النظام. عدّل النص بما تعرفه، وميّز ما تدعمه الأدلة عمّا يحتاج إلى تحقق.")}</p>
            <div><label htmlFor="problem-statement" className="text-sm font-black">{ui("ما الذي يحتاج إلى فهم أو معالجة؟")}</label><p className="mt-1 text-xs leading-6 text-slate-500">{ui("يجب أن توضّح الواقع، ومن يتأثر، وما الذي لم يُفهم أو يُعالج بعد.")}</p><textarea dir="auto" id="problem-statement" value={statement} onChange={(event) => { setStatement(event.target.value); setStatus('idle'); }} className="mt-3 min-h-40 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={ui("استخدم المساعد لإعداد مسودة، أو اكتب المشكلة هنا…")} /><div className="mt-1 text-left text-xs text-slate-400">{statement.trim().length}{' '}{ui("/50 حرفاً · 8 كلمات على الأقل")}</div></div>
            <div><label htmlFor="research-gap" className="text-sm font-black">{ui("ما الذي لم تحسمه الأدلة بعد؟")}</label><p className="mt-1 text-xs leading-6 text-slate-500">{ui("توضح ما الذي لم تحسمه الأدلة أو ما السياق الذي يحتاج دراسة، دون ادعاء أن الموضوع لم يُدرس قط.")}</p><textarea dir="auto" id="research-gap" value={gap} onChange={(event) => { setGap(event.target.value); setStatus('idle'); }} className="mt-3 min-h-32 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={ui("تشير الأدلة المتاحة إلى محدودية… في سياق…")} /><div className="mt-1 text-left text-xs text-slate-400">{gap.trim().length}{' '}{ui("/35 حرفاً · 6 كلمات على الأقل")}</div></div>
            <div><label htmlFor="researcher-note" className="text-sm font-black">{ui("لماذا يهمك هذا البحث؟")}</label><p className="mt-1 text-xs leading-6 text-slate-500">{ui("اكتب 2–4 أسطر بكلماتك. نحفظها لإبراز صوتك وسبب اختيارك عند بناء المقدمة والسيمنار لاحقاً.")}</p><textarea dir="auto" id="researcher-note" value={researcherNote} onChange={(event) => { setResearcherNote(event.target.value); setStatus('idle'); }} className="mt-3 min-h-28 w-full rounded-xl border border-blue-200 bg-blue-50/40 p-4 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={ui("اخترت هذه المشكلة لأن…")} /><div className="mt-1 text-left text-xs text-slate-400">{researcherNote.trim().length}{' '}{ui("/20 حداً أدنى")}</div></div>
            <details className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">{ui("ما الذي تحتاجه الصياغة قبل المتابعة؟")}</summary>
            <div className="grid gap-2 sm:grid-cols-3">{fieldAssessments.map(({ label, assessment }) => <div key={label} className={`rounded-xl border p-3 text-xs font-bold ${assessment.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{assessment.valid ? '✓' : '○'} {ui(label)}</div>)}</div>
            {qualityIssue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">{ui(qualityIssue)}</p>}
            </details>

            {status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-800">{ui(saveError)}</p>}
            {!canSave && <p className="text-sm text-slate-600">{ui("طوّر الصياغة أولاً لتتمكن من المتابعة. افتح ملاحظات الصياغة أعلاه لمعرفة ما يحتاج إلى تعديل.")}</p>}
            <button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveProblem()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? ui("جارٍ الحفظ والتحقق…") : ui("حفظ الصياغة ومتابعة ما نريد معرفته")}</button>
          </section>
        </>}
      </main>
    </div>
  );
}
