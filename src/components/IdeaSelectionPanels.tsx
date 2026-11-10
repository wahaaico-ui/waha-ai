'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUiTranslation } from '@/lib/use-ui-translation';
import type { IdeaInsights } from '@/lib/idea-selection/openalex-insights';
import type { TimingStage } from '@/lib/idea-selection/timing';
import { OPEN_QUESTIONS, type Answers, type QuestionId } from '@/lib/idea-selection/questions';
import { placeOnMatrix, type PathRating, type Quadrant } from '@/lib/idea-selection/matrix';
import type { ResearchPath } from '@/lib/research-exploration';

const STAGE_TEXT: Record<TimingStage, { label: string; note: string }> = {
  insufficient: { label: 'بيانات غير كافية للحكم', note: 'عدد الدراسات المنشورة قليل جدًا فلا يصح الحكم على توقيت الموضوع.' },
  emerging: { label: 'موضوع ناشئ', note: 'دراساته قليلة لكنها تتزايد بسرعة؛ فرصة للإضافة، مع مراجع سابقة أقل.' },
  peak: { label: 'موضوع في ذروته', note: 'الدراسات كثيرة وما زالت تتزايد؛ تحتاج زاوية محددة تميّز بحثك.' },
  saturated: { label: 'موضوع مشبع', note: 'الدراسات كثيرة ولا تنمو؛ ابحث عن سياق أو فئة لم تُدرس بعد.' },
  limited: { label: 'موضوع محدود ومستقر', note: 'الدراسات قليلة ولا تتزايد؛ تأكد من أهمية المشكلة وتوفر المراجع.' },
};

const QUADRANTS: Array<{ id: Quadrant; title: string; hint: string }> = [
  { id: 'pursue', title: 'امضِ فيه', hint: 'شغف عالٍ وجدوى عالية' },
  { id: 'make-feasible', title: 'اجعله ممكنًا', hint: 'شغف عالٍ وجدوى أقل: ضيّق النطاق أو غيّر العيّنة' },
  { id: 'reconsider-interest', title: 'راجع اهتمامك', hint: 'ممكن التنفيذ لكن شغفك به أقل' },
  { id: 'set-aside', title: 'أجّله', hint: 'شغف أقل وجدوى أقل' },
];

/** Timing indicator and recent directions, from real OpenAlex counts.
 * Render with `key={query}` so a new query starts from the loading state. */
export function TopicTimingPanel({ query }: { query: string }) {
  const { text: ui } = useUiTranslation();
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; insights?: IdeaInsights; error?: string }>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch('/api/idea-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }), signal: controller.signal })
      .then(async response => {
        const data = await response.json() as { insights?: IdeaInsights; error?: string };
        if (!active) return;
        setState(response.ok && data.insights ? { status: 'ready', insights: data.insights } : { status: 'error', error: data.error || 'تعذر حساب المؤشر.' });
      })
      .catch(() => { if (active) setState({ status: 'error', error: 'تعذر الاتصال بالخادم.' }); });
    return () => { active = false; controller.abort(); };
  }, [query]);

  if (state.status === 'loading') return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{ui('جارٍ حساب توقيت الموضوع من أعداد الدراسات المنشورة…')}</div>;
  if (state.status === 'error' || !state.insights) return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm">{ui(state.error || 'تعذر حساب المؤشر.')}</div>;

  const { timing, directions, recentYears, priorYears } = state.insights;
  const peakYear = Math.max(1, ...timing.years.map(y => y.count));
  return <section className="space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold text-slate-900">{ui('توقيت الموضوع')}</h3>
      <p className="mt-2 text-lg font-black text-slate-900">{ui(STAGE_TEXT[timing.stage].label)}</p>
      <p className="mt-1 text-sm leading-7 text-slate-600">{ui(STAGE_TEXT[timing.stage].note)}</p>
      <ol className="mt-4 space-y-2" aria-label={ui('عدد الدراسات المنشورة في كل سنة مكتملة')}>
        {timing.years.map(({ year, count }) => <li key={year} className="grid grid-cols-[3.5rem_1fr_5rem] items-center gap-3 text-xs">
          <span className="font-bold text-slate-700">{year}</span>
          <span className="h-3 rounded-full bg-slate-100"><span className="block h-3 rounded-full bg-blue-600" style={{ width: `${Math.max(2, (count / peakYear) * 100)}%` }} /></span>
          <span className="text-end tabular-nums text-slate-600">{count.toLocaleString('en-US')}</span>
        </li>)}
      </ol>
      <p className="mt-3 text-xs leading-6 text-slate-500">{ui(state.insights.basis === 'title' ? 'عُدّت الدراسات التي يرد الموضوع في عناوينها.' : 'عناوين الدراسات قليلة، فعُدّت الدراسات التي يرد الموضوع في نصوصها؛ هذا العدّ يميل قليلًا إلى السنوات الحديثة.')}</p>
      <p className="mt-1 text-xs leading-6 text-slate-500">{ui('المصدر: OpenAlex، السنوات المكتملة فقط. نمو حصة الموضوع من كل الأبحاث')}: {timing.growth} ({ui('نمو الموضوع')} {timing.rawGrowth} ÷ {ui('نمو كل الأبحاث')} {timing.baseGrowth})</p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold text-slate-900">{ui('أحدث الاتجاهات حول فكرتك')}</h3>
      <p className="mt-1 text-xs leading-6 text-slate-500">{ui('الموضوعات الفرعية التي نمت أسرع من الأبحاث عمومًا')} ({recentYears[0]}–{recentYears[1]} {ui('مقارنة بـ')} {priorYears[0]}–{priorYears[1]})</p>
      {directions.length === 0
        ? <p className="mt-4 text-sm text-slate-600">{ui('لا توجد موضوعات فرعية نمت بوضوح في هذه الفترة.')}</p>
        : <ol className="mt-4 grid gap-2 sm:grid-cols-2">{directions.map(direction => <li key={direction.id} className="rounded-xl border border-slate-200 p-3 text-sm">
          <a href={direction.id} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 hover:underline" dir="auto">{direction.name}</a>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">{direction.prior.toLocaleString('en-US')} → {direction.recent.toLocaleString('en-US')} ({ui('زيادة فوق المتوقع')} +{direction.increase.toLocaleString('en-US')})</p>
        </li>)}</ol>}
    </div>
  </section>;
}

/** The five open questions and the passion-feasibility matrix, saved in the project. */
export function IdeaQuestionsAndMatrix({ paths, projectId, isAuthenticated }: { paths: ResearchPath[]; projectId: string | null; isAuthenticated: boolean }) {
  const { text: ui } = useUiTranslation();
  const [answers, setAnswers] = useState<Answers>({});
  const [ratings, setRatings] = useState<Record<string, Pick<PathRating, 'passion' | 'feasibility'>>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const canSave = Boolean(projectId) && isAuthenticated;

  useEffect(() => {
    if (!canSave || !projectId) return;
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/idea-selection`, { cache: 'no-store' }).then(async response => {
      const data = await response.json() as { answers?: Answers; ratings?: PathRating[] };
      if (!active || !response.ok) return;
      setAnswers(data.answers || {});
      setRatings(Object.fromEntries((data.ratings || []).map(r => [r.pathId, { passion: r.passion, feasibility: r.feasibility }])));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [canSave, projectId]);

  const rated = paths.flatMap(path => ratings[path.id] ? [{ path, quadrant: placeOnMatrix(ratings[path.id]) }] : []);

  async function save() {
    if (!projectId) return;
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/idea-selection`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, ratings: Object.entries(ratings).filter(([id]) => paths.some(p => p.id === id)).map(([pathId, r]) => ({ pathId, ...r })) }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setStatus('error'); setMessage(data.error || 'تعذر الحفظ.'); return; }
      setStatus('saved');
    } catch { setStatus('error'); setMessage('تعذر الاتصال بالخادم.'); }
  }

  const rate = (pathId: string, key: 'passion' | 'feasibility', value: number) => {
    setStatus('idle');
    setRatings(current => ({ ...current, [pathId]: { passion: current[pathId]?.passion ?? 3, feasibility: current[pathId]?.feasibility ?? 3, [key]: value } }));
  };

  return <section className="space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold text-slate-900">{ui('خمسة أسئلة قبل أن تختار')}</h3>
      <p className="mt-1 text-xs leading-6 text-slate-500">{ui('أجب بصدق؛ إجاباتك لك وحدك ولا يقيّمها النظام.')}</p>
      <div className="mt-4 space-y-4">{OPEN_QUESTIONS.map(question => <label key={question.id} className="block text-sm">
        <span className="font-bold text-slate-800">{ui(question.text)}</span>
        <textarea dir="auto" rows={2} maxLength={1000} value={answers[question.id] || ''} onChange={event => { setStatus('idle'); setAnswers(current => ({ ...current, [question.id as QuestionId]: event.target.value })); }} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" />
      </label>)}</div>
    </div>

    {paths.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-bold text-slate-900">{ui('مصفوفة الشغف والجدوى')}</h3>
      <p className="mt-1 text-xs leading-6 text-slate-500">{ui('قيّم كل مسار من 1 إلى 5: كم تحبه، وكم يمكنك تنفيذه بالبيانات والعيّنة والوقت والمهارات المتاحة لك.')}</p>
      <div className="mt-4 space-y-3">{paths.map(path => <div key={path.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:grid-cols-[1fr_8rem_8rem] sm:items-center">
        <span className="font-bold" dir="auto">{path.title}</span>
        {(['passion', 'feasibility'] as const).map(key => <label key={key} className="flex items-center gap-2 text-xs">
          <span className="text-slate-600">{ui(key === 'passion' ? 'الشغف' : 'الجدوى')}</span>
          <select value={ratings[path.id]?.[key] ?? ''} onChange={event => rate(path.id, key, Number(event.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5">
            <option value="" disabled>—</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>)}
      </div>)}</div>
      {rated.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{QUADRANTS.map(quadrant => <div key={quadrant.id} className={`rounded-xl border p-4 ${quadrant.id === 'pursue' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
        <p className="text-sm font-black">{ui(quadrant.title)}</p><p className="text-xs text-slate-500">{ui(quadrant.hint)}</p>
        <ul className="mt-2 space-y-1 text-sm">{rated.filter(r => r.quadrant === quadrant.id).map(r => <li key={r.path.id} dir="auto">{r.path.title}</li>)}</ul>
      </div>)}</div>}
    </div>}

    {canSave
      ? <div><button type="button" onClick={() => void save()} disabled={status === 'saving'} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">{status === 'saving' ? ui('جارٍ الحفظ…') : ui('احفظ إجاباتك وتقييمك في المشروع')}</button>
        {status === 'saved' && <p role="status" className="mt-2 text-sm text-emerald-700">{ui('حُفظت إجاباتك وتقييمك في المشروع.')}</p>}
        {status === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">{ui(message)}</p>}</div>
      : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">{ui('إجاباتك تبقى في هذه الصفحة فقط.')} <Link href={`/login?redirect=${encodeURIComponent('/verify-idea')}`} className="font-bold text-blue-700 underline">{ui('سجّل الدخول')}</Link> {ui('واعتمد مسارًا لحفظها في مشروعك.')}</p>}
  </section>;
}
