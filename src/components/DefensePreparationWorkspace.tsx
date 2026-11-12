'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { useProjectId } from '@/lib/use-project-id';
import { buildDefensePlan, REMINDER_DAYS, type DefensePlanView, type DefenseTaskId, type SavedDefensePlan } from '@/lib/defense-plan';

export const TASK_COPY: Record<DefenseTaskId, { title: string; detail: string; path: string | null }> = {
  stages: { title: 'أكمل مراحل البحث المفتوحة', detail: 'المناقشة تقوم على البحث كاملًا؛ أغلق كل مرحلة قبلها.', path: '/research/journey' },
  guide: { title: 'راجع الالتزام بدليل الجامعة', detail: 'افتح مؤشرات الالتزام في رحلة البحث وأصلح ما ينقص من حدود الكلمات والتنسيق.', path: '/research/journey' },
  slides: { title: 'جهّز عرض المناقشة', detail: 'ابنِ الشرائح من تقرير السيمنار: المشكلة والأهداف والمنهج والنتائج والتوصيات.', path: '/research/seminar' },
  questions: { title: 'تدرّب على الأسئلة الصعبة', detail: 'اكتب إجابة قصيرة لكل سؤال متوقع عن المنهج والعينة والحدود، مع الدليل من بحثك.', path: '/research/seminar' },
  references: { title: 'راجع المراجع والاستشهادات', detail: 'تأكد أن كل استشهاد في النص له مرجع في القائمة، وأن كل مرجع مذكور في النص.', path: '/research/library' },
  originality: { title: 'أجرِ فحص التشابه الأخير', detail: 'افحص النسخة النهائية واحفظ التقرير لتسلّمه إن طُلب منك.', path: '/research/originality' },
  rehearsal: { title: 'بروفة كاملة بالتوقيت', detail: 'اعرض أمام زميل أو مشرف في الوقت المحدد للمناقشة، ودوّن ما تعثّرت فيه.', path: null },
  files: { title: 'جهّز النسخ والملفات', detail: 'نزّل الرسالة بصيغتي Word وPDF، واحمل العرض على جهازين.', path: '/research/journey' },
};

/** The plan as laid out for a date, without loading, so it can be rendered and tested on its own. */
export function DefensePlanView({ view, projectId, onToggle, busy }: { view: DefensePlanView; projectId: string; onToggle?: (id: DefenseTaskId) => void; busy?: boolean }) {
  const { text: ui } = useUiTranslation();
  if (view.daysLeft < 0) return <p className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">{ui('مرّ موعد المناقشة. حدّث الموعد إن تغيّر.')}</p>;
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <p className={`rounded-xl border p-3 text-sm font-bold ${view.daysLeft <= REMINDER_DAYS ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-100 bg-blue-50 text-blue-900'}`}>
      {view.daysLeft === 0 ? ui('المناقشة اليوم. بالتوفيق.') : ui('بقي على المناقشة {0} يومًا.', [view.daysLeft])}
    </p>
    {view.compressed && <p className="mt-3 text-sm leading-7 text-amber-900">{ui('بدأت الخطة متأخرة، فوزّعنا المهام المفتوحة على الأيام الباقية بترتيبها.')}</p>}
    <ol className="mt-4 space-y-3">{view.tasks.map(task => {
      const copy = TASK_COPY[task.id];
      const done = task.state === 'done';
      return <li key={task.id} className={`rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50' : task.state === 'today' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => onToggle?.(task.id)} disabled={busy || !onToggle} aria-pressed={done} aria-label={ui(done ? 'ألغِ إنجاز: {0}' : 'علّم منجزة: {0}', [ui(copy.title)])} className="mt-0.5 min-h-6 min-w-6 disabled:opacity-60">
            {done ? <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" /> : <Circle className="h-6 w-6 text-slate-400" aria-hidden="true" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black">{ui(copy.title)}</p>
              <span className="text-xs font-bold text-slate-600"><bdi dir="ltr">{task.due}</bdi>{task.state === 'today' && !done ? ` · ${ui('موعدها اليوم')}` : ''}</span>
            </div>
            <p className="mt-1 text-sm leading-7 text-slate-600">{ui(copy.detail)}</p>
            {task.id === 'stages' && typeof task.count === 'number' && <p className="mt-1 text-sm font-bold text-slate-800">{task.count === 0 ? ui('كل المراحل مكتملة ومحفوظة.') : ui('بقيت {0} مراحل غير مكتملة.', [task.count])}</p>}
            {copy.path && projectId && <Link href={`${copy.path}?projectId=${encodeURIComponent(projectId)}`} className="mt-2 inline-block text-sm font-bold text-blue-700 underline">{ui('افتح الصفحة')}</Link>}
          </div>
        </div>
      </li>;
    })}</ol>
  </section>;
}

/** Saves the defense date and the ticked tasks, and shows the two-week plan (DOC-38-03). */
export default function DefensePreparationWorkspace() {
  const { text: ui, direction } = useUiTranslation();
  const projectId = useProjectId();
  const [saved, setSaved] = useState<SavedDefensePlan | null>(null);
  const [incompleteStages, setIncompleteStages] = useState(0);
  const [emailReminder, setEmailReminder] = useState(false);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(Boolean(projectId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/defense-plan`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as { plan?: SavedDefensePlan | null; incompleteStages?: number; emailReminder?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || 'تعذر الاتصال بالخادم.');
        setSaved(data.plan || null); setDate(data.plan?.defenseDate || ''); setIncompleteStages(data.incompleteStages ?? 0); setEmailReminder(data.emailReminder === true);
      })
      .catch(error => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.' }))
      .finally(() => setLoading(false));
  }, [projectId]);

  const save = useCallback(async (defenseDate: string, done: string[]) => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/defense-plan`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defenseDate, done }) });
      const data = await response.json() as { plan?: SavedDefensePlan; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error || 'تعذر الاتصال بالخادم.');
      setSaved(data.plan);
      return true;
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.' }); return false; }
    finally { setBusy(false); }
  }, [projectId]);

  const view = useMemo(() => saved ? buildDefensePlan(saved, new Date(), { incompleteStages }) : null, [saved, incompleteStages]);
  const toggle = (id: DefenseTaskId) => { if (saved) void save(saved.defenseDate, saved.done.includes(id) ? saved.done.filter(item => item !== id) : [...saved.done, id]); };

  return <div dir={direction} className="min-h-screen bg-slate-50 pb-20 text-slate-950"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white sm:p-10">
      <div className="flex items-center gap-3"><CalendarClock className="h-7 w-7" aria-hidden="true" /><h1 className="text-2xl font-black sm:text-3xl">{ui('الاستعداد للمناقشة')}</h1></div>
      <p className="mt-3 text-sm leading-7 text-blue-50">{ui('احفظ موعد مناقشتك لتحصل على خطة من ثماني مهام موزعة على الأسبوعين اللذين يسبقانها، وتذكير قبلها بأسبوعين.')}</p>
    </section>

    {!projectId && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{ui('افتح مشروعًا من')} <Link href="/dashboard" className="font-bold underline">{ui('مشاريعي البحثية')}</Link> {ui('لتخطط لمناقشته.')}</p>}
    {loading && <p role="status" className="mt-6 text-sm text-slate-500">{ui('جارٍ قراءة خطة الاستعداد…')}</p>}
    {projectId && !loading && <form onSubmit={async event => { event.preventDefault(); if (await save(date, saved?.defenseDate === date ? saved.done : [])) setMessage({ type: 'success', text: 'حُفظ موعد المناقشة.' }); }} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <label htmlFor="defense-date" className="block text-sm font-bold">{ui('موعد المناقشة')}</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input id="defense-date" type="date" required value={date} onChange={event => setDate(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm" />
        <button type="submit" disabled={busy || !date} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">{ui(busy ? 'جارٍ الحفظ…' : saved ? 'حدّث الموعد' : 'احفظ الموعد')}</button>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-500">{ui(emailReminder ? 'يظهر لك تذكير في لوحة مشاريعك، ويصلك بالبريد مرة واحدة قبل المناقشة بأسبوعين. تغيير الموعد يعيد ضبط التذكير ويبدأ الخطة من جديد.' : 'يظهر لك تذكير في لوحة مشاريعك قبل المناقشة بأسبوعين. تغيير الموعد يبدأ الخطة من جديد.')}</p>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{ui(message.text)}</p>}
    </form>}
    {view && <DefensePlanView view={view} projectId={projectId} onToggle={toggle} busy={busy} />}
  </main></div>;
}
