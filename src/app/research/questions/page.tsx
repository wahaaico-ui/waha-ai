'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import ObjectivesQuestionsConsistencyPanel from '@/components/ObjectivesQuestionsConsistencyPanel';
import type { ConsistencyPanelStatus } from '@/components/ProblemObjectivesConsistencyPanel';
import SiteHeader from '@/components/SiteHeader';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { firstAcademicTextIssue } from '@/lib/academic-content-quality';
import type { ObjectivesQuestionsConsistencyReport, ResearchObjectViewWarning } from '@/lib/research-objects/types';
import { useProjectId } from '@/lib/use-project-id';
import { useJourneyAutosave } from '@/lib/use-journey-autosave';

type ConsistencyResponse = {
  report?: ObjectivesQuestionsConsistencyReport;
  inputWarnings?: ResearchObjectViewWarning[];
  error?: string;
};

async function loadObjectivesQuestionsConsistency(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/consistency/objectives-questions`, {
    cache: 'no-store',
    signal,
  });
  const body: ConsistencyResponse = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'تعذر تحميل فحص الاتساق.');
  if (!body.report || body.report.checkType !== 'objective_question_consistency') {
    throw new Error('وصلت نتيجة غير صالحة من محرك الاتساق.');
  }
  return { report: body.report, warnings: Array.isArray(body.inputWarnings) ? body.inputWarnings : [] };
}

export default function ResearchQuestionsPage() {
  const projectId = useProjectId();
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [objectivesReady, setObjectivesReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [consistencyStatus, setConsistencyStatus] = useState<ConsistencyPanelStatus>(() => projectId ? 'loading' : 'idle');
  const [consistencyReport, setConsistencyReport] = useState<ObjectivesQuestionsConsistencyReport | null>(null);
  const [consistencyWarnings, setConsistencyWarnings] = useState<ResearchObjectViewWarning[]>([]);
  const [consistencyError, setConsistencyError] = useState('');

  const refreshConsistency = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return;
    try {
      const result = await loadObjectivesQuestionsConsistency(projectId, signal);
      if (signal?.aborted) return;
      setConsistencyReport(result.report);
      setConsistencyWarnings(result.warnings);
      setConsistencyStatus('ready');
    } catch (reason) {
      if (signal?.aborted) return;
      setConsistencyError(reason instanceof Error ? reason.message : 'تعذر تحميل فحص الاتساق.');
      setConsistencyStatus('error');
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        const savedObjectives = journey.outputs.objectives?.objectives;
        const objectiveList = Array.isArray(savedObjectives) ? savedObjectives.filter((item): item is string => typeof item === 'string') : [];
        setObjectives(objectiveList);
        setObjectivesReady(stageComplete('objectives', journey.outputs.objectives));
        const savedQuestions = journey.drafts.questions?.content.questions ?? journey.outputs.questions?.questions;
        setQuestions(Array.isArray(savedQuestions) && savedQuestions.length === objectiveList.length ? savedQuestions.map((item) => typeof item === 'string' ? item : '') : objectiveList.map(() => ''));
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    loadObjectivesQuestionsConsistency(projectId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setConsistencyReport(result.report);
        setConsistencyWarnings(result.warnings);
        setConsistencyStatus('ready');
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setConsistencyError(reason instanceof Error ? reason.message : 'تعذر تحميل فحص الاتساق.');
        setConsistencyStatus('error');
      });
    return () => controller.abort();
  }, [projectId]);

  const qualityIssue = questions.length !== objectives.length ? 'يجب أن يقابل كل هدف سؤال واحد.' : firstAcademicTextIssue(questions, { minChars: 20, minWords: 5, label: 'السؤال', requireQuestion: true }, 2) || '';
  const canSave = objectives.length >= 2 && !qualityIssue;
  useJourneyAutosave({
    projectId,
    stage: 'questions',
    content: { questions },
    enabled: Boolean(projectId && !loading && objectives.length >= 2),
  });
  const updateQuestion = (index: number, value: string) => {
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? value : question));
    setStatus('idle');
    setConsistencyStatus((current) => current === 'ready' ? 'stale' : current);
  };
  const saveQuestions = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving'); setSaveError('');
    try {
      const result = await saveJourneyStage(projectId, 'questions', { questions: questions.map((question) => question.trim()) });
      if (result.consistency?.checkType === 'objective_question_consistency') {
        setConsistencyReport(result.consistency);
        setConsistencyWarnings(result.consistencyWarnings);
        setConsistencyStatus('ready');
      } else {
        setConsistencyStatus('loading');
        await refreshConsistency();
      }
      setStatus('saved');
    } catch (reason) {
      if (
        reason instanceof JourneyStageSaveError
        && reason.consistency?.checkType === 'objective_question_consistency'
      ) {
        setConsistencyReport(reason.consistency);
        setConsistencyWarnings(reason.consistencyWarnings);
        setConsistencyStatus('ready');
      }
      setSaveError(reason instanceof Error ? reason.message : 'تعذر حفظ الأسئلة.');
      setStatus('error');
    }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="questions" lang="ar" /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">ما الذي سيجيب عنه بحثك؟</div><h1 className="mt-4 text-3xl font-black">حوّل أهدافك إلى أسئلة تقود البحث</h1><p className="mt-3 text-sm leading-7 text-slate-600">لكل هدف سؤال واضح يساعدك لاحقاً في اختيار المنهج والأداة. راجع الصياغة وتأكد أنها تسأل ولا تفترض النتيجة.</p></header>
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأهداف…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">افتح مشروعك لنكمل من أهدافك</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section>
    : !objectivesReady || objectives.length < 2 ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">لنوضح وجهة البحث أولاً</h2><p className="mt-3 text-sm leading-7 text-amber-900">نحتاج هدفين واضحين على الأقل حتى تكون الأسئلة مرتبطة بما تريد الوصول إليه.</p><Link href={`/research/objectives?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">تطوير أهداف البحث</Link></section>
    : <><section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">نبني على وجهة بحثك المحفوظة</div><p className="mt-2 text-sm text-emerald-950">لديك <strong>{objectives.length}</strong> أهداف؛ سنصوغ سؤالاً واضحاً لكل هدف.</p></section>
      <ResearchDraftAssistant projectId={projectId} stage="questions" onDraft={(draft) => {
        if (Array.isArray(draft.questions)) {
          const suggested = draft.questions.filter((item): item is string => typeof item === 'string');
          if (suggested.length === objectives.length) {
            setQuestions(suggested);
            setConsistencyStatus((current) => current === 'ready' ? 'stale' : current);
          }
        }
        setStatus('idle');
      }} />
      <section aria-label="معاينة أسئلة البحث" className="rounded-3xl border border-blue-200 bg-blue-50/60 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-blue-950">الأسئلة التي سيقود بها البحث</h2><span role="status" className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">{status === 'saved' ? 'هذه الصياغة محفوظة' : status === 'saving' ? 'جارٍ الحفظ…' : 'معاينة تحريرية — احفظ لتثبيتها'}</span></div>
        {questions.some((question) => question.trim()) ? <ol className="mt-4 space-y-3">{questions.map((question, index) => question.trim() ? <li key={index} className="break-words rounded-xl bg-white p-4 text-sm leading-7 text-slate-800 [overflow-wrap:anywhere]">{question}</li> : null)}</ol> : <p className="mt-4 text-sm leading-7 text-slate-600">ستظهر أسئلتك هنا أثناء الكتابة، أو بعد طلب مسودة مساعدة. لا يضيف النظام إجابات أو نتائج مفترضة.</p>}
      </section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{objectives.map((objective, index) => <div key={`${index}-${objective}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-blue-700">الهدف {index + 1}</p><p className="mt-1 text-sm leading-7 text-slate-700">{objective}</p><label htmlFor={`question-${index}`} className="mt-4 block text-sm font-black">سؤال البحث المقابل</label><textarea id={`question-${index}`} value={questions[index] || ''} onChange={(event) => updateQuestion(index, event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="مثال: ما أثر ... على ... لدى ...؟" /><div className="mt-1 text-left text-xs text-slate-400">{(questions[index] || '').trim().length}/15</div></div>)}
        {qualityIssue && <details className="rounded-xl border border-amber-200 bg-amber-50 p-3"><summary className="cursor-pointer text-sm font-medium text-amber-900">ما الذي تحتاجه الأسئلة قبل المتابعة؟</summary><p className="mt-2 text-sm leading-7 text-amber-900">{qualityIssue}</p></details>}{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-800">{saveError}</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveQuestions()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ وفحص الاتساق…' : 'حفظ الأسئلة ومتابعة تصميم البحث'}</button>{status === 'saved' && <Link href={`/research/hypotheses?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">حُفظت أسئلتك. لنحدد ما إذا كانت تحتاج فرضيات ←</Link>}</section></>}
      <ObjectivesQuestionsConsistencyPanel status={consistencyStatus} report={consistencyReport} warnings={consistencyWarnings} error={consistencyError} onRetry={() => { setConsistencyStatus('loading'); setConsistencyError(''); void refreshConsistency(); }} />
  </main></div>;
}
