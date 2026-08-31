'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import QuestionsHypothesesConsistencyPanel from '@/components/QuestionsHypothesesConsistencyPanel';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import SiteHeader from '@/components/SiteHeader';
import type { ConsistencyPanelStatus } from '@/components/ProblemObjectivesConsistencyPanel';
import { firstAcademicTextIssue } from '@/lib/academic-content-quality';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import type { QuestionsHypothesesConsistencyReport, ResearchObjectViewWarning } from '@/lib/research-objects/types';
import { stageComplete } from '@/lib/research-workflow';
import { useProjectId } from '@/lib/use-project-id';

type Mode = 'required' | 'not_applicable';
type ResponseBody = { report?: QuestionsHypothesesConsistencyReport; inputWarnings?: ResearchObjectViewWarning[]; error?: string };

async function fetchConsistency(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/consistency/questions-hypotheses`, { cache: 'no-store', signal });
  const body: ResponseBody = await response.json().catch(() => ({}));
  if (!response.ok || !body.report) throw new Error(body.error || 'تعذر تحميل فحص الاتساق.');
  return { report: body.report, warnings: body.inputWarnings || [] };
}

export default function ResearchHypothesesPage() {
  const projectId = useProjectId();
  const [loading, setLoading] = useState(Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [mode, setMode] = useState<Mode>('required');
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [rationale, setRationale] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [consistencyStatus, setConsistencyStatus] = useState<ConsistencyPanelStatus>(projectId ? 'loading' : 'idle');
  const [report, setReport] = useState<QuestionsHypothesesConsistencyReport | null>(null);
  const [warnings, setWarnings] = useState<ResearchObjectViewWarning[]>([]);
  const [consistencyError, setConsistencyError] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return;
    try { const result = await fetchConsistency(projectId, signal); if (!signal?.aborted) { setReport(result.report); setWarnings(result.warnings); setConsistencyStatus('ready'); } }
    catch (reason) { if (!signal?.aborted) { setConsistencyError(reason instanceof Error ? reason.message : 'تعذر الفحص.'); setConsistencyStatus('error'); } }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId).then((journey) => {
      const savedQuestions = journey.outputs.questions?.questions;
      const list = Array.isArray(savedQuestions) ? savedQuestions.filter((item): item is string => typeof item === 'string') : [];
      setQuestions(list); setQuestionsReady(stageComplete('questions', journey.outputs.questions));
      const saved = journey.outputs.hypotheses;
      const savedMode: Mode = saved?.mode === 'not_applicable' ? 'not_applicable' : 'required';
      setMode(savedMode); setRationale(typeof saved?.rationale === 'string' ? saved.rationale : '');
      const savedHypotheses = Array.isArray(saved?.hypotheses) ? saved.hypotheses.map((item) => typeof item === 'string' ? item : '') : [];
      setHypotheses(savedHypotheses.length === list.length ? savedHypotheses : list.map(() => ''));
    }).catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.')).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    fetchConsistency(projectId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setReport(result.report);
        setWarnings(result.warnings);
        setConsistencyStatus('ready');
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setConsistencyError(reason instanceof Error ? reason.message : 'تعذر الفحص.');
        setConsistencyStatus('error');
      });
    return () => controller.abort();
  }, [projectId]);

  const edit = () => { setStatus('idle'); setConsistencyStatus((value) => value === 'ready' ? 'stale' : value); };
  const qualityIssue = (() => {
    if (mode === 'not_applicable') {
      return rationale.trim().length < 30
        ? 'اشرح في 30 حرفاً على الأقل لماذا لا تتطلب طبيعة الدراسة فرضيات.'
        : '';
    }
    if (hypotheses.length !== questions.length) return 'يجب أن تقابل كل سؤال فرضية واحدة.';
    const academicIssue = firstAcademicTextIssue(hypotheses, { minChars: 20, minWords: 5, label: 'الفرضية' }, 1);
    if (academicIssue) return academicIssue;
    return hypotheses.some((item) => /[؟?]\s*$/u.test(item))
      ? 'اكتب كل فرضية كعبارة تقريرية قابلة للاختبار، لا كسؤال.'
      : '';
  })();
  const canSave = questionsReady && !qualityIssue;
  const save = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving'); setSaveError('');
    try {
      const result = await saveJourneyStage(projectId, 'hypotheses', { mode, hypotheses: mode === 'required' ? hypotheses.map((item) => item.trim()) : [], rationale: rationale.trim() });
      if (result.consistency?.checkType === 'question_hypothesis_consistency') { setReport(result.consistency); setWarnings(result.consistencyWarnings); setConsistencyStatus('ready'); } else await refresh();
      setStatus('saved');
    } catch (reason) {
      if (reason instanceof JourneyStageSaveError && reason.consistency?.checkType === 'question_hypothesis_consistency') { setReport(reason.consistency); setWarnings(reason.consistencyWarnings); setConsistencyStatus('ready'); }
      setSaveError(reason instanceof Error ? reason.message : 'تعذر حفظ قرار الفرضيات.'); setStatus('error');
    }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="hypotheses" lang="ar" /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 6 · قرار الفرضيات</div><h1 className="mt-4 text-3xl font-black">هل يحتاج بحثك إلى فرضيات؟</h1><p className="mt-3 text-sm leading-7 text-slate-600">الدراسات الكمية التي تختبر أثراً أو علاقة تحتاج غالباً فرضيات. الدراسات النوعية والاستكشافية قد تعتمد الأسئلة فقط، لكن يجب توثيق القرار.</p></header>
    {loading ? <section className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأسئلة…</section> : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-white">تسجيل الدخول</Link></section> : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">{loadError}</section> : !questionsReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black">بوابة الفرضيات مغلقة</h2><Link href={`/research/questions?projectId=${encodeURIComponent(projectId)}`} className="mt-4 inline-flex rounded-xl bg-amber-300 px-5 py-3 font-bold">مراجعة الأسئلة</Link></section> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="font-black">اختر القرار المنهجي</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => { setMode('required'); edit(); }} className={`rounded-xl border p-4 text-right ${mode === 'required' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200'}`}><strong>الدراسة تحتاج فرضيات</strong><span className="mt-1 block text-xs text-slate-600">عندما تختبر الأسئلة أثراً أو علاقة أو فروقاً.</span></button><button type="button" onClick={() => { setMode('not_applicable'); edit(); }} className={`rounded-xl border p-4 text-right ${mode === 'not_applicable' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200'}`}><strong>لا تحتاج فرضيات</strong><span className="mt-1 block text-xs text-slate-600">عندما تكون الدراسة نوعية أو استكشافية ولا تختبر علاقة محددة.</span></button></div></section>
      <ResearchDraftAssistant projectId={projectId} stage="hypotheses" showTools={false} onDraft={(draft) => { const nextMode: Mode = draft.mode === 'not_applicable' ? 'not_applicable' : 'required'; setMode(nextMode); setRationale(typeof draft.rationale === 'string' ? draft.rationale : ''); if (Array.isArray(draft.hypotheses)) { const items = draft.hypotheses.map((item) => typeof item === 'string' ? item : ''); if (items.length === questions.length) setHypotheses(items); } edit(); }} />
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{mode === 'required' ? questions.map((question, index) => <div key={question} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-blue-700">السؤال {index + 1}</p><p className="mt-1 text-sm leading-7">{question}</p><label htmlFor={`hypothesis-${index}`} className="mt-4 block text-sm font-black">الفرضية المقابلة</label><textarea id={`hypothesis-${index}`} value={hypotheses[index] || ''} onChange={(event) => { setHypotheses((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); edit(); }} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="مثال: يوجد أثر ذو دلالة لـ... على..." /></div>) : <div><label htmlFor="rationale" className="text-sm font-black">مبرر القرار المنهجي</label><textarea id="rationale" value={rationale} onChange={(event) => { setRationale(event.target.value); edit(); }} className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="مثال: الدراسة نوعية استكشافية وتهدف إلى فهم الخبرات، لذلك تعتمد أسئلة مفتوحة بدلاً من اختبار فرضيات مسبقة." /></div>}{qualityIssue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{qualityIssue}</p>}{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{saveError}</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={() => void save()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ وفحص الاتساق…' : 'اعتماد قرار الفرضيات وفتح المنهجية'}</button>{status === 'saved' && <Link href={`/research/methodology?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">تم الحفظ. انتقل إلى المنهجية ←</Link>}</section>
    </>}
    <QuestionsHypothesesConsistencyPanel status={consistencyStatus} report={report} warnings={warnings} error={consistencyError} onRetry={() => { setConsistencyStatus('loading'); void refresh(); }} />
  </main></div>;
}
