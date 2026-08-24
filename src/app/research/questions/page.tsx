'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { firstAcademicTextIssue } from '@/lib/academic-content-quality';

export default function ResearchQuestionsPage() {
  const [projectId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('projectId') || '');
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [objectivesReady, setObjectivesReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        const savedObjectives = journey.outputs.objectives?.objectives;
        const objectiveList = Array.isArray(savedObjectives) ? savedObjectives.filter((item): item is string => typeof item === 'string') : [];
        setObjectives(objectiveList);
        setObjectivesReady(stageComplete('objectives', journey.outputs.objectives));
        const savedQuestions = journey.outputs.questions?.questions;
        setQuestions(Array.isArray(savedQuestions) && savedQuestions.length === objectiveList.length ? savedQuestions.map((item) => typeof item === 'string' ? item : '') : objectiveList.map(() => ''));
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const qualityIssue = questions.length !== objectives.length ? 'يجب أن يقابل كل هدف سؤال واحد.' : firstAcademicTextIssue(questions, { minChars: 20, minWords: 5, label: 'السؤال', requireQuestion: true }, 2) || '';
  const canSave = objectives.length >= 2 && !qualityIssue;
  const saveQuestions = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving'); setSaveError('');
    try { await saveJourneyStage(projectId, 'questions', { questions: questions.map((question) => question.trim()) }); setStatus('saved'); }
    catch (reason) { setSaveError(reason instanceof Error ? reason.message : 'تعذر اعتماد الأسئلة.'); setStatus('error'); }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="questions" lang="ar" /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 5 · الأسئلة</div><h1 className="mt-4 text-3xl font-black">سؤال واضح مقابل كل هدف</h1><p className="mt-3 text-sm leading-7 text-slate-600">لا نضيف أسئلة لا تخدم هدفاً معتمداً. التطابق بين الأهداف والأسئلة يُفحص قبل فتح المنهجية.</p></header>
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأهداف…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section>
    : !objectivesReady || objectives.length < 2 ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة الأسئلة مغلقة</h2><p className="mt-3 text-sm leading-7 text-amber-900">الأهداف المحفوظة لم تجتز فحص الوضوح والجودة بعد.</p><Link href={`/research/objectives?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">مراجعة الأهداف</Link></section>
    : <><section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">بوابة الأهداف مفتوحة من سجل المشروع</div><p className="mt-2 text-sm text-emerald-950">عدد الأهداف المعتمدة: <strong>{objectives.length}</strong> — المطلوب العدد نفسه من الأسئلة.</p></section>
      <ResearchDraftAssistant projectId={projectId} stage="questions" onDraft={(draft) => {
        if (Array.isArray(draft.questions)) {
          const suggested = draft.questions.filter((item): item is string => typeof item === 'string');
          if (suggested.length === objectives.length) setQuestions(suggested);
        }
        setStatus('idle');
      }} />
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{objectives.map((objective, index) => <div key={`${index}-${objective}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-blue-700">الهدف {index + 1}</p><p className="mt-1 text-sm leading-7 text-slate-700">{objective}</p><label htmlFor={`question-${index}`} className="mt-4 block text-sm font-black">سؤال البحث المقابل</label><textarea id={`question-${index}`} value={questions[index] || ''} onChange={(event) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? event.target.value : question))} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="مثال: ما أثر ... على ... لدى ...؟" /><div className="mt-1 text-left text-xs text-slate-400">{(questions[index] || '').trim().length}/15</div></div>)}
        {qualityIssue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">{qualityIssue}</p>}{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-800">{saveError}</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveQuestions()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ وفحص الاتساق…' : 'اعتماد الأسئلة وفتح المنهجية'}</button>{status === 'saved' && <Link href={`/research/methodology?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">تم الحفظ والاتساق. انتقل إلى المنهجية ←</Link>}</section></>}
  </main></div>;
}
