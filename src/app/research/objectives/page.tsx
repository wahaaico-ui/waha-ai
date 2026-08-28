'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import ProblemObjectivesConsistencyPanel, { type ConsistencyPanelStatus } from '@/components/ProblemObjectivesConsistencyPanel';
import SiteHeader from '@/components/SiteHeader';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import { firstAcademicTextIssue } from '@/lib/academic-content-quality';
import type { ProblemObjectivesConsistencyReport, ResearchObjectViewWarning } from '@/lib/research-objects/types';
import { useProjectId } from '@/lib/use-project-id';

type ProblemOutput = { problemStatement?: string; researchGap?: string; researcherNote?: string };

type ConsistencyResponse = {
  report?: ProblemObjectivesConsistencyReport;
  inputWarnings?: ResearchObjectViewWarning[];
  error?: string;
};

async function loadProblemObjectivesConsistency(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/consistency/problem-objectives`, {
    cache: 'no-store',
    signal,
  });
  const body: ConsistencyResponse = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'تعذر تحميل فحص الاتساق.');
  if (!body.report || body.report.checkType !== 'problem_objective_consistency') {
    throw new Error('وصلت نتيجة غير صالحة من محرك الاتساق.');
  }
  return {
    report: body.report,
    warnings: Array.isArray(body.inputWarnings) ? body.inputWarnings : [],
  };
}

export default function ResearchObjectivesPage() {
  const projectId = useProjectId();
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [problem, setProblem] = useState<ProblemOutput | null>(null);
  const [problemReady, setProblemReady] = useState(false);
  const [objectives, setObjectives] = useState<string[]>(['', '']);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [consistencyStatus, setConsistencyStatus] = useState<ConsistencyPanelStatus>(() => projectId ? 'loading' : 'idle');
  const [consistencyReport, setConsistencyReport] = useState<ProblemObjectivesConsistencyReport | null>(null);
  const [consistencyWarnings, setConsistencyWarnings] = useState<ResearchObjectViewWarning[]>([]);
  const [consistencyError, setConsistencyError] = useState('');

  const refreshConsistency = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return;
    try {
      const result = await loadProblemObjectivesConsistency(projectId, signal);
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
        setProblem((journey.outputs.problem as ProblemOutput | undefined) || null);
        setProblemReady(stageComplete('problem', journey.outputs.problem));
        const saved = journey.outputs.objectives?.objectives;
        if (Array.isArray(saved) && saved.every((item) => typeof item === 'string')) setObjectives(saved.length >= 2 ? saved as string[] : ['', '']);
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    loadProblemObjectivesConsistency(projectId, controller.signal)
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

  const validObjectives = objectives.map((objective) => objective.trim()).filter((objective) => objective.length >= 20);
  const qualityIssue = firstAcademicTextIssue(validObjectives, { minChars: 25, minWords: 5, label: 'الهدف' }, 2) || '';
  const canSave = !qualityIssue;
  const markConsistencyStale = () => setConsistencyStatus((current) => current === 'ready' ? 'stale' : current);
  const updateObjective = (index: number, value: string) => {
    setObjectives((current) => current.map((objective, objectiveIndex) => objectiveIndex === index ? value : objective));
    markConsistencyStale();
  };

  const saveObjectives = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving'); setSaveError('');
    try {
      const result = await saveJourneyStage(projectId, 'objectives', { objectives: validObjectives });
      if (result.consistency?.checkType === 'problem_objective_consistency') {
        setConsistencyReport(result.consistency);
        setConsistencyWarnings(result.consistencyWarnings);
        setConsistencyStatus('ready');
      } else {
        setConsistencyStatus('loading');
        setConsistencyError('');
        await refreshConsistency();
      }
      setStatus('saved');
    }
    catch (reason) {
      if (
        reason instanceof JourneyStageSaveError
        && reason.consistency?.checkType === 'problem_objective_consistency'
      ) {
        setConsistencyReport(reason.consistency);
        setConsistencyWarnings(reason.consistencyWarnings);
        setConsistencyStatus('ready');
      }
      setSaveError(reason instanceof Error ? reason.message : 'تعذر اعتماد الأهداف.');
      setStatus('error');
    }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="objectives" lang="ar" /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 4 · الأهداف</div><h1 className="mt-4 text-3xl font-black">حوّل المشكلة إلى نتائج يمكن للبحث تحقيقها</h1><p className="mt-3 text-sm leading-7 text-slate-600">كل هدف يجب أن يكون محدداً وقابلاً للفحص، وأن يعالج جزءاً من المشكلة أو الفجوة المحفوظة.</p></header>
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل مشكلة البحث…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section>
    : !problemReady || !problem ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة الأهداف مغلقة</h2><p className="mt-3 text-sm leading-7 text-amber-900">المشكلة أو الفجوة المحفوظة لم تجتز فحص الجودة. ارجع إلى المرحلة السابقة واستخدم المسودة المساعدة ثم راجعها.</p><Link href={`/research/problem?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">مراجعة المشكلة والفجوة</Link></section>
    : <><section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">بوابة المشكلة مفتوحة من سجل المشروع</div><p className="mt-2 break-words text-sm leading-7 text-emerald-950 [overflow-wrap:anywhere]"><strong>المشكلة:</strong> {problem.problemStatement}</p><p className="mt-2 break-words text-sm leading-7 text-emerald-950 [overflow-wrap:anywhere]"><strong>الفجوة المحتملة:</strong> {problem.researchGap}</p></section>
      <ResearchDraftAssistant projectId={projectId} stage="objectives" onDraft={(draft) => {
        if (Array.isArray(draft.objectives)) {
          const suggested = draft.objectives.filter((item): item is string => typeof item === 'string');
          if (suggested.length >= 2) {
            setObjectives(suggested);
            markConsistencyStale();
          }
        }
        setStatus('idle');
      }} />
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{objectives.map((objective, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-2 flex items-center justify-between"><label htmlFor={`objective-${index}`} className="text-sm font-black">الهدف {index + 1}</label>{objectives.length > 2 && <button type="button" onClick={() => { setObjectives((current) => current.filter((_, itemIndex) => itemIndex !== index)); markConsistencyStale(); }} className="text-xs font-bold text-rose-600">حذف</button>}</div><textarea id={`objective-${index}`} value={objective} onChange={(event) => updateObjective(index, event.target.value)} className="min-h-24 w-full bg-transparent text-sm leading-7 outline-none" placeholder="مثال: تحديد أثر ... على ... لدى ..." /><div className="mt-1 text-left text-xs text-slate-400">{objective.trim().length}/20</div></div>)}
        <button type="button" onClick={() => { setObjectives((current) => [...current, '']); markConsistencyStale(); }} className="w-full rounded-xl border border-dashed border-blue-300 py-3 text-sm font-bold text-blue-700">+ إضافة هدف</button><p className="text-xs leading-6 text-slate-500">المطلوب هدفان واضحان على الأقل. تجنب أفعال مثل “التعرف” وحدها؛ اذكر ماذا ستقيس أو تصف أو تقارن.</p>{qualityIssue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">{qualityIssue}</p>}{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-800">{saveError}</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveObjectives()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ والتحقق…' : 'اعتماد الأهداف وفتح الأسئلة'}</button>{status === 'saved' && <Link href={`/research/questions?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">تم الحفظ. انتقل إلى أسئلة البحث ←</Link>}</section></>}
      <ProblemObjectivesConsistencyPanel
        status={consistencyStatus}
        report={consistencyReport}
        warnings={consistencyWarnings}
        error={consistencyError}
        onRetry={() => {
          setConsistencyStatus('loading');
          setConsistencyError('');
          void refreshConsistency();
        }}
      />
  </main></div>;
}
