'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ScanSearch } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { useProjectId } from '@/lib/use-project-id';
import type { OriginalityReport } from '@/lib/originality/report';

type Input = 'draft' | 'text';

const ORIGIN_LABELS = {
  'project-pdf': 'ملف PDF في المشروع',
  'project-reference': 'مرجع في مكتبة المشروع',
  'open-source': 'مصدر علمي مفتوح',
} as const;

export default function OriginalityWorkspace() {
  const { text: ui, direction } = useUiTranslation();
  const projectId = useProjectId();
  const [input, setInput] = useState<Input>('draft');
  const [text, setText] = useState('');
  const [includeOpenSources, setIncludeOpenSources] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<OriginalityReport | null>(null);

  const canRun = Boolean(projectId) && status !== 'loading' && (input === 'draft' || text.trim().length >= 50);

  async function runCheck() {
    if (!projectId) return;
    setStatus('loading'); setMessage(''); setReport(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch('/api/academic/originality', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ projectId, input, ...(input === 'text' ? { text } : {}), includeOpenSources }),
      });
      const data = await response.json() as { report?: OriginalityReport; error?: string };
      if (!response.ok || !data.report) { setMessage(data.error || 'تعذر إكمال الفحص.'); setStatus('error'); return; }
      setReport(data.report); setStatus('idle');
    } catch {
      setMessage('تعذر الاتصال بالخادم. حاول مرة أخرى.'); setStatus('error');
    } finally { window.clearTimeout(timeout); }
  }

  return <div dir={direction} className="min-h-screen bg-slate-50 pb-20 text-slate-950"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white sm:p-10">
      <div className="flex items-center gap-3"><ScanSearch className="h-7 w-7" aria-hidden="true" /><h1 className="text-2xl font-black sm:text-3xl">{ui('فحص التشابه مع المصادر')}</h1></div>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50">{ui('يجد المقاطع التي تتطابق حرفيًا مع مصادر مشروعك أو مع مستخلصات أبحاث منشورة، ويعرض كل مصدر ورابطه، ويميّز ما وثّقته مما لم توثّقه.')}</p>
    </section>

    {!projectId && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{ui('افتح مشروعًا من')} <Link href="/" className="font-bold underline">{ui('مدخل المهام')}</Link> {ui('لفحص نصه مع مصادره.')}</p>}

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <fieldset>
        <legend className="text-sm font-black">{ui('ماذا تريد أن تفحص؟')}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(['draft', 'text'] as const).map(option => <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm ${input === option ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
            <input type="radio" name="originality-input" value={option} checked={input === option} onChange={() => setInput(option)} className="mt-1" />
            <span><span className="block font-bold">{ui(option === 'draft' ? 'آخر مسودة في الكتابة بالدليل' : 'نص ألصقه هنا')}</span>
              <span className="mt-1 block text-slate-600">{ui(option === 'draft' ? 'تُحتسب استشهاداتك المحفوظة، فيُميَّز المقطع الموثّق من غير الموثّق.' : 'لا توجد استشهادات مرتبطة بالنص الملصق، فتظهر كل المطابقات غير موثّقة.')}</span></span>
          </label>)}
        </div>
      </fieldset>

      {input === 'text' && <><label htmlFor="originality-text" className="mt-5 block text-sm font-black">{ui('النص')}</label>
        <textarea id="originality-text" dir="auto" value={text} onChange={event => setText(event.target.value.slice(0, 50_000))} rows={10} className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7" />
        <p className="mt-1 text-xs text-slate-500">{ui('50 حرفًا على الأقل.')}</p></>}

      <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm">
        <input type="checkbox" checked={includeOpenSources} onChange={event => setIncludeOpenSources(event.target.checked)} className="mt-1" />
        <span><span className="block font-bold">{ui('قارن أيضًا بمستخلصات الأبحاث المنشورة')}</span>
          <span className="mt-1 block text-slate-600">{ui('سنرسل حتى ثلاث عبارات قصيرة من نصك كاستعلامات بحث إلى قواعد علمية مفتوحة. لا يُرسل نصك كاملًا، ونصوص مصادر مشروعك لا تخرج من الواحة.')}</span></span>
      </label>

      <button type="button" disabled={!canRun} onClick={() => void runCheck()} className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-50">
        {status === 'loading' ? ui('جارٍ الفحص…') : ui('ابدأ الفحص')}
      </button>
      {status === 'error' && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{ui(message)}</p>}
    </section>

    {report && <section aria-live="polite" className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{ui('نسبة النص المطابق للمصادر المفحوصة')}</p><p className="mt-1 text-2xl font-black">{report.coveragePercent}%</p><p className="mt-1 text-xs text-slate-500">{report.matchedWords} / {report.totalWords} {ui('كلمة')}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{ui('مقاطع غير موثّقة')}</p><p className="mt-1 text-2xl font-black">{report.uncitedPassages}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{ui('المصادر المفحوصة')}</p><p className="mt-1 text-sm leading-6">{ui('مصادر المشروع')}: {report.checked.projectSources}<br />{ui('مصادر مفتوحة')}: {report.checked.openSources}</p></div>
      </div>

      {report.passages.length === 0
        ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">{ui('لم يُعثر على مقاطع تتطابق حرفيًا مع المصادر المفحوصة.')}</p>
        : <ol className="space-y-3">{report.passages.map((passage, index) => {
          const uncited = passage.matches.some(match => !match.cited);
          return <li key={`${passage.start}-${index}`} className={`rounded-2xl border bg-white p-5 ${uncited ? 'border-amber-300' : 'border-slate-200'}`}>
            <p className="text-xs font-bold text-slate-500">{ui(uncited ? 'مقطع غير موثّق' : 'مقطع موثّق')} · {passage.wordCount} {ui('كلمة')}</p>
            <blockquote dir="auto" className="mt-2 border-s-4 border-slate-300 ps-3 text-sm leading-7">{passage.text}</blockquote>
            <ul className="mt-3 space-y-2 text-sm">{passage.matches.map(match => <li key={`${match.origin}-${match.sourceId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span dir="auto" className="font-bold">{match.title}</span>
              {match.year && <span className="text-slate-500">{match.year}</span>}
              <span className="text-slate-500">{ui(ORIGIN_LABELS[match.origin])}</span>
              <span className={match.cited ? 'text-emerald-700' : 'text-amber-700'}>{ui(match.cited ? 'موثّق' : 'غير موثّق')}</span>
              {match.url && <a href={match.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline">{ui('المصدر')}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
            </li>)}</ul>
          </li>;
        })}</ol>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-black">{ui('حدود هذا الفحص')}</h2>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm leading-7 text-slate-700">{report.limitations.map(item => <li key={item}>{ui(item)}</li>)}</ul></div>
    </section>}
  </main></div>;
}
