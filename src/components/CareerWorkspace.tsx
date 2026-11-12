'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { normalizeOrcid } from '@/lib/orcid';
import type { Career } from '@/lib/scholarly-career';

const card = 'rounded-3xl border border-[#27272a] bg-[#18181b] p-6';
const list = (rows: Array<{ name: string; count: number }>) => rows.map(row => `${row.name} (${row.count})`).join(' · ');

/** What OpenAlex holds for the researcher's ORCID iD: works, what cites them and where that leads (DOC-30-01..03). */
export function CareerView({ career }: { career: Career }) {
  const { text: ui } = useUiTranslation();
  return <div className="space-y-6">
    <section className={card}>
      <h2 className="text-xl font-bold">{ui('الباحث')}</h2>
      {career.author
        ? <><p dir="auto" className="mt-2 text-lg">{career.author.name}</p>
          <p className="mt-1 text-sm text-gray-400">{ui('الأعمال: {0}، الاستشهادات: {1}، مؤشر h: {2}.', [career.author.works, career.author.citations, career.author.hIndex ?? ui('غير معروف')])}</p></>
        : <p className="mt-2 text-sm text-gray-400">{ui('لم يُعثر على ملف باحث بهذا المعرّف في OpenAlex.')}</p>}
      <p className="mt-3 text-xs text-gray-500">{ui('من بيانات OpenAlex المرتبطة بمعرّف ORCID {0} بتاريخ {1}. الأعمال تُعرف بمعرفاتها لا بعناوينها.', [career.orcid, career.checkedAt.slice(0, 10)])}</p>
    </section>

    <section className={card}>
      <h2 className="text-xl font-bold">{ui('تتبع الاستشهادات')}</h2>
      <p className="mt-1 text-sm text-gray-400">{ui('أكثر أعمالك استشهادًا، ومن يستشهد بها حسب السنة والمجلة والدولة.')}</p>
      {career.citations.length === 0
        ? <p className="mt-4 text-sm text-gray-300">{ui('لا توجد استشهادات مسجلة لأعمالك بعد.')}</p>
        : <ul className="mt-4 space-y-4">{career.citations.map(item => <li key={item.workId} className="rounded-2xl border border-[#3f3f46] p-4">
          <p dir="auto" className="font-bold">{item.title}</p>
          <p className="mt-1 text-sm text-cyan-300">{ui('{0}: {1} استشهادًا.', [ui('المجموع'), item.citations])}</p>
          <dl className="mt-2 space-y-1 text-xs leading-6 text-gray-300">
            <div><dt className="inline text-gray-500">{ui('حسب السنة')}: </dt><dd className="inline">{item.byYear.map(year => `${year.year}: ${year.count}`).join(' · ') || '—'}</dd></div>
            <div><dt className="inline text-gray-500">{ui('أكثر المجلات استشهادًا')}: </dt><dd dir="auto" className="inline">{list(item.journals) || '—'}</dd></div>
            <div><dt className="inline text-gray-500">{ui('أكثر الدول استشهادًا')}: </dt><dd dir="auto" className="inline">{list(item.countries) || '—'}</dd></div>
            <div><dt className="inline text-gray-500">{ui('سياقات الاستشهاد')}: </dt><dd className="inline">{ui('غير متاحة؛ لا تنشرها OpenAlex')}</dd></div>
          </dl>
        </li>)}</ul>}
    </section>

    <section className={card}>
      <h2 className="text-xl font-bold">{ui('اتجاهات تالية مقترحة')}</h2>
      <p className="mt-1 text-sm text-gray-400">{ui('موضوعات تتجه إليها الدراسات التي تستشهد بعملك، ولم تنشر فيها بعد.')}</p>
      {career.directions.length === 0
        ? <p className="mt-4 text-sm text-gray-300">{ui('لا تكفي الاستشهادات الحالية لاقتراح اتجاه.')}</p>
        : <ol className="mt-4 space-y-3">{career.directions.map((item, index) => <li key={item.topicId} className="rounded-2xl border border-[#3f3f46] p-4 text-sm">
          <p className="font-bold">{index + 1}. <span dir="auto">{item.topic}</span></p>
          <p className="mt-1 text-xs text-gray-400">{ui('{0} دراسة استشهدت بعملك في هذا الموضوع.', [item.citingWorks])}</p>
          <p className="mt-1 text-xs text-gray-400">{ui('انطلاقًا من')}: <span dir="auto">{item.fromWorks.map(work => work.title).join(' · ')}</span></p>
        </li>)}</ol>}
    </section>

    <section className={card}>
      <h2 className="text-xl font-bold">{ui('الأعمال المنشورة')}</h2>
      {career.timeline.length === 0
        ? <p className="mt-4 text-sm text-gray-300">{ui('لا توجد أعمال مرتبطة بهذا المعرّف في OpenAlex.')}</p>
        : <ol className="mt-4 space-y-3 border-s border-[#3f3f46] ps-4">{career.timeline.map(item => <li key={item.id} className="text-sm">
          <p className="text-xs font-bold text-cyan-300">{item.year ?? '—'}</p>
          <p dir="auto" className="font-medium">{item.doi
            ? <a href={item.doi} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">{item.title}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
            : item.title}</p>
          <p className="text-xs text-gray-500"><span dir="auto">{item.venue || ''}</span>{item.venue ? ' · ' : ''}{ui('الاستشهادات: {0}', [item.citations])}</p>
        </li>)}</ol>}
    </section>
  </div>;
}

/** Saves the ORCID iD in the account and shows the career it leads to. */
export default function CareerWorkspace() {
  const { text: ui, language } = useUiTranslation();
  const [orcidInput, setOrcidInput] = useState('');
  const [career, setCareer] = useState<Career | null>(null);
  const [state, setState] = useState<'loading' | 'empty' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(() => {
    fetch('/api/career', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as { orcid?: string | null; career?: Career | null; error?: string };
        if (!response.ok) throw new Error(data.error || 'تعذر الوصول إلى بيانات OpenAlex الآن.');
        setOrcidInput(data.orcid || '');
        setCareer(data.career || null);
        setState(data.career ? 'ready' : 'empty');
      })
      .catch(error => { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.' }); setState('error'); });
  }, []);
  useEffect(load, [load]);

  async function save(value: string | null) {
    setMessage(null);
    const orcid = value === null ? null : normalizeOrcid(value);
    if (value !== null && !orcid) { setMessage({ type: 'error', text: 'معرّف ORCID غير صحيح. اكتبه كما يظهر في ملفك، مثل 0000-0002-1825-0097.' }); return; }
    setBusy('save');
    const { error } = await supabase.auth.updateUser({ data: { orcid } });
    setBusy(null);
    if (error) { setMessage({ type: 'error', text: 'تعذر حفظ المعرّف. أعد المحاولة.' }); return; }
    setMessage({ type: 'success', text: orcid ? 'حُفظ المعرّف. جارٍ قراءة أعمالك من OpenAlex…' : 'أُزيل المعرّف من حسابك.' });
    setState('loading'); load();
  }

  async function download(format: 'docx' | 'pdf') {
    setBusy(format); setMessage(null);
    try {
      const response = await fetch('/api/career', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format, language }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'تعذر التصدير.'); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `waha-career.${format}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر التصدير.' }); }
    finally { setBusy(null); }
  }

  return <div className="space-y-6">
    <section className={card}>
      <label htmlFor="career-orcid" className="block text-sm font-medium text-gray-300">{ui('معرّف ORCID')}</label>
      <p className="mt-1 text-xs text-gray-500">{ui('نقرأ أعمالك بمعرّفك لا باسمك، فلا تختلط بأعمال باحث يحمل الاسم نفسه.')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input id="career-orcid" dir="ltr" inputMode="text" placeholder="0000-0000-0000-0000" value={orcidInput} onChange={event => setOrcidInput(event.target.value)}
          className="min-h-11 flex-1 rounded-xl border border-[#3f3f46] bg-[#27272a] px-4 text-sm text-white focus:border-cyan-500 focus:outline-none" />
        <button type="button" onClick={() => void save(orcidInput)} disabled={busy !== null || !orcidInput.trim()} className="min-h-11 rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white disabled:opacity-50">{ui(busy === 'save' ? 'جارٍ الحفظ…' : 'احفظ المعرّف')}</button>
        {state === 'ready' && <button type="button" onClick={() => void save(null)} disabled={busy !== null} className="min-h-11 rounded-xl border border-[#3f3f46] px-5 text-sm text-gray-300 disabled:opacity-50">{ui('أزل المعرّف')}</button>}
      </div>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-red-500/20 bg-red-500/5 text-red-300' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'}`}>{ui(message.text)}</p>}
    </section>

    {state === 'loading' && <p role="status" className="text-sm text-gray-400">{ui('جارٍ قراءة أعمالك من OpenAlex…')}</p>}
    {state === 'empty' && <p className="text-sm text-gray-400">{ui('أضف معرّف ORCID لتظهر أعمالك واستشهاداتها هنا.')}</p>}
    {state === 'ready' && career && <>
      <section aria-label={ui('تصدير المسيرة')} className={card}>
        <p className="text-sm font-bold">{ui('تصدير المسيرة')}</p>
        <p className="mt-1 text-xs text-gray-500">{ui('رابط المشاركة العامة غير متاح بعد.')}</p>
        <div className="mt-3 flex flex-wrap gap-2">{(['docx', 'pdf'] as const).map(format => <button key={format} type="button" disabled={busy !== null} onClick={() => void download(format)} className="rounded-lg border border-cyan-500/40 px-4 py-2 text-sm font-bold text-cyan-300 disabled:opacity-40">{format.toUpperCase()}</button>)}</div>
      </section>
      <CareerView career={career} />
    </>}
  </div>;
}
