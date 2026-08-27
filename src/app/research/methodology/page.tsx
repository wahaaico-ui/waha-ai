'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import QuestionsMethodologyConsistencyPanel from '@/components/QuestionsMethodologyConsistencyPanel';
import type { ConsistencyPanelStatus } from '@/components/ProblemObjectivesConsistencyPanel';
import SiteHeader from '@/components/SiteHeader';
import ResearchDraftAssistant from '@/components/ResearchDraftAssistant';
import { JourneyStageSaveError, loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import type { QuestionsMethodologyConsistencyReport, ResearchObjectViewWarning } from '@/lib/research-objects/types';

type Methodology = { approach: string; population: string; sample: string; instrument: string };
const EMPTY_METHOD: Methodology = { approach: '', population: '', sample: '', instrument: '' };

type ConsistencyResponse = {
  report?: QuestionsMethodologyConsistencyReport;
  inputWarnings?: ResearchObjectViewWarning[];
  error?: string;
};

async function loadQuestionsMethodologyConsistency(projectId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/consistency/questions-methodology`, {
    cache: 'no-store',
    signal,
  });
  const body: ConsistencyResponse = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'تعذر تحميل فحص الاتساق.');
  if (!body.report || body.report.checkType !== 'question_methodology_consistency') {
    throw new Error('وصلت نتيجة غير صالحة من محرك الاتساق.');
  }
  return { report: body.report, warnings: Array.isArray(body.inputWarnings) ? body.inputWarnings : [] };
}

const APPROACHES = [
  { value: 'quantitative', label: 'كمي', note: 'لقياس المتغيرات واختبار العلاقات أو الفروق بأداة كمية مناسبة.' },
  { value: 'qualitative', label: 'نوعي', note: 'لفهم الخبرات والمعاني بعمق عبر مقابلات أو ملاحظة أو تحليل نوعي.' },
  { value: 'mixed', label: 'مختلط', note: 'لدمج قياس كمي مع تفسير نوعي ضمن تصميم مترابط.' },
  { value: 'descriptive', label: 'وصفي/تحليلي', note: 'لوصف ظاهرة وتحليل خصائصها من دون ادعاء علاقة سببية غير مختبرة.' },
];

function compatibilityIssue(methodology: Methodology) {
  if (methodology.approach === 'qualitative' && /استبان|questionnaire|survey/i.test(methodology.instrument)) return 'الأداة المكتوبة تبدو كمية، بينما المنهج المختار نوعي. استخدم مقابلات أو ملاحظة أو غيّر المنهج.';
  if (methodology.approach === 'quantitative' && /مقابل|interview/i.test(methodology.instrument)) return 'المقابلات أداة نوعية غالباً. اختر منهجاً نوعياً أو مختلطاً، أو حدّد أداة كمية مناسبة.';
  return '';
}

export default function ResearchMethodologyPage() {
  const [projectId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('projectId') || '');
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [loadError, setLoadError] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsReady, setQuestionsReady] = useState(false);
  const [methodology, setMethodology] = useState<Methodology>(EMPTY_METHOD);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [consistencyStatus, setConsistencyStatus] = useState<ConsistencyPanelStatus>(() => projectId ? 'loading' : 'idle');
  const [consistencyReport, setConsistencyReport] = useState<QuestionsMethodologyConsistencyReport | null>(null);
  const [consistencyWarnings, setConsistencyWarnings] = useState<ResearchObjectViewWarning[]>([]);
  const [consistencyError, setConsistencyError] = useState('');

  const refreshConsistency = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return;
    try {
      const result = await loadQuestionsMethodologyConsistency(projectId, signal);
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
        const savedQuestions = journey.outputs.questions?.questions;
        setQuestions(Array.isArray(savedQuestions) ? savedQuestions.filter((item): item is string => typeof item === 'string') : []);
        setQuestionsReady(stageComplete('questions', journey.outputs.questions));
        const savedMethod = journey.outputs.methodology;
        if (savedMethod && typeof savedMethod === 'object') {
          setMethodology({
            approach: typeof savedMethod.approach === 'string' ? savedMethod.approach : '',
            population: typeof savedMethod.population === 'string' ? savedMethod.population : '',
            sample: typeof savedMethod.sample === 'string' ? savedMethod.sample : '',
            instrument: typeof savedMethod.instrument === 'string' ? savedMethod.instrument : '',
          });
        }
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    loadQuestionsMethodologyConsistency(projectId, controller.signal)
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

  const issue = useMemo(() => compatibilityIssue(methodology), [methodology]);
  const canSave = questions.length >= 2 && Boolean(methodology.approach) && methodology.population.trim().length >= 10 && methodology.sample.trim().length >= 10 && methodology.instrument.trim().length >= 10 && !issue;
  const markEdited = () => {
    setStatus('idle');
    setConsistencyStatus((current) => current === 'ready' ? 'stale' : current);
  };
  const update = (field: keyof Methodology, value: string) => {
    setMethodology((current) => ({ ...current, [field]: value }));
    markEdited();
  };

  const saveMethodology = async () => {
    if (!projectId || !canSave) return;
    setStatus('saving'); setSaveError('');
    try {
      const result = await saveJourneyStage(projectId, 'methodology', {
        approach: methodology.approach,
        population: methodology.population.trim(),
        sample: methodology.sample.trim(),
        instrument: methodology.instrument.trim(),
      });
      if (result.consistency?.checkType === 'question_methodology_consistency') {
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
        && reason.consistency?.checkType === 'question_methodology_consistency'
      ) {
        setConsistencyReport(reason.consistency);
        setConsistencyWarnings(reason.consistencyWarnings);
        setConsistencyStatus('ready');
      }
      setSaveError(reason instanceof Error ? reason.message : 'تعذر حفظ المنهجية.');
      setStatus('error');
    }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="method" lang="ar" /><main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 6 · المنهجية</div><h1 className="mt-4 text-3xl font-black">صمّم طريقة الإجابة عن الأسئلة</h1><p className="mt-3 text-sm leading-7 text-slate-600">نساعدك في اتساق التصميم ومجتمع الدراسة والعينة والأداة. لا تنفّذ الواحة التحليل الإحصائي ولا تدّعي نتائج لم تُجمع.</p></header>
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأسئلة المعتمدة…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : loadError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{loadError}</section>
    : !questionsReady || questions.length < 2 ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة المنهجية مغلقة</h2><p className="mt-3 text-sm leading-7 text-amber-900">أسئلة البحث المحفوظة لم تجتز فحص الوضوح والاتساق مع الأهداف.</p><Link href={`/research/questions?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">مراجعة الأسئلة</Link></section>
    : <><section className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">الأسئلة المعتمدة من سجل المشروع</div><ol className="mt-3 space-y-2 text-sm leading-7 text-emerald-950">{questions.map((question, index) => <li className="break-words [overflow-wrap:anywhere]" key={`${index}-${question}`}><strong>{index + 1}.</strong> {question}</li>)}</ol></section>
      <ResearchDraftAssistant projectId={projectId} stage="methodology" onDraft={(draft) => {
        setMethodology((current) => ({
          approach: typeof draft.approach === 'string' && APPROACHES.some((item) => item.value === draft.approach) ? draft.approach : current.approach,
          population: typeof draft.population === 'string' ? draft.population : current.population,
          sample: typeof draft.sample === 'string' ? draft.sample : current.sample,
          instrument: typeof draft.instrument === 'string' ? draft.instrument : current.instrument,
        }));
        markEdited();
      }} />
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><fieldset><legend className="text-sm font-black">المنهج البحثي</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{APPROACHES.map((approach) => <label key={approach.value} className={`cursor-pointer rounded-xl border p-4 transition ${methodology.approach === approach.value ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50'}`}><input type="radio" name="approach" value={approach.value} checked={methodology.approach === approach.value} onChange={() => update('approach', approach.value)} className="sr-only" /><span className="text-sm font-black">{approach.label}</span><span className="mt-1 block text-xs leading-6 text-slate-600">{approach.note}</span></label>)}</div></fieldset>
        {([['population', 'مجتمع الدراسة', 'من يشملهم البحث؟ حدّد الفئة والمكان والزمن إن أمكن.'], ['sample', 'العينة المقترحة', 'كيف ستختار المشاركين أو الحالات؟ لا تضع رقماً بلا مبرر.'], ['instrument', 'أداة جمع البيانات', 'مثال: استبانة محكّمة، مقابلات شبه منظمة، أو تحليل وثائق.']] as const).map(([field, label, placeholder]) => <div key={field}><label htmlFor={field} className="text-sm font-black">{label}</label><textarea id={field} value={methodology[field]} onChange={(event) => update(field, event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={placeholder} /><div className="mt-1 text-left text-xs text-slate-400">{methodology[field].trim().length}/10</div></div>)}
        {issue && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">{issue}</p>}{status === 'error' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{saveError || 'تعذر الحفظ؛ لم تُفتح الأدبيات.'}</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={() => void saveMethodology()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ الحفظ وفحص الاتساق…' : 'اعتماد المنهجية وفتح الأدبيات'}</button>{status === 'saved' && <Link href={`/research/literature?projectId=${encodeURIComponent(projectId)}`} className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">تم الحفظ والاتساق. انتقل إلى الأدبيات ←</Link>}</section></>}
      <QuestionsMethodologyConsistencyPanel status={consistencyStatus} report={consistencyReport} warnings={consistencyWarnings} error={consistencyError} onRetry={() => { setConsistencyStatus('loading'); setConsistencyError(''); void refreshConsistency(); }} />
  </main></div>;
}
