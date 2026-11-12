'use client';

import { useEffect, useState } from 'react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { SECTION_LABELS, SHARE_SECTIONS, sharePath, type CareerShareLink, type ShareSection } from '@/lib/career-share';

const card = 'rounded-3xl border border-[#27272a] bg-[#18181b] p-6';
type Reply = { link?: CareerShareLink | null; error?: string };

/** Creates, shows and revokes the public link to the career (DOC-30-03). */
export default function CareerSharePanel({ orcid }: { orcid: string }) {
  const { text: ui } = useUiTranslation();
  const [link, setLink] = useState<CareerShareLink | null>(null);
  const [sections, setSections] = useState<ShareSection[]>([...SHARE_SECTIONS]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/career/share', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as Reply;
        if (response.status === 503) { setState('unavailable'); setMessage(data.error || ''); return; }
        if (!response.ok) throw new Error(data.error || 'تعذر قراءة رابط المشاركة. أعد المحاولة.');
        setLink(data.link || null);
        if (data.link) setSections(data.link.sections);
        setState('ready');
      })
      .catch(error => { setMessage(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.'); setState('ready'); });
  }, []);

  async function send(method: 'POST' | 'DELETE') {
    setBusy(true); setMessage(''); setCopied(false);
    try {
      const response = await fetch('/api/career/share', { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify({ sections }) : undefined });
      const data = await response.json() as Reply;
      if (!response.ok) throw new Error(data.error || 'تعذر الاتصال بالخادم.');
      setLink(data.link || null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.'); }
    finally { setBusy(false); }
  }

  function revoke() {
    if (window.confirm(ui('سيتوقف الرابط فورًا عن العمل لكل من يملكه. هل تلغيه؟'))) void send('DELETE');
  }

  const url = link && typeof window !== 'undefined' ? `${window.location.origin}${sharePath(link.token)}` : '';
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setMessage('تعذر النسخ؛ انسخ الرابط يدويًا.'); }
  }
  const toggle = (section: ShareSection) => setSections(current => current.includes(section) ? current.filter(item => item !== section) : SHARE_SECTIONS.filter(item => item === section || current.includes(item)));

  return <section aria-label={ui('مشاركة المسيرة')} className={card}>
    <p className="text-sm font-bold">{ui('مشاركة المسيرة')}</p>
    <p className="mt-1 text-xs text-gray-500">{ui('يعرض الرابط بيانات OpenAlex العامة لمعرّفك فقط، ولا يكشف مشاريعك أو حسابك. يمكنك إلغاؤه في أي وقت.')}</p>
    {state === 'loading' && <p role="status" className="mt-3 text-sm text-gray-400">{ui('جارٍ قراءة رابط المشاركة…')}</p>}
    {state === 'unavailable' && <p className="mt-3 text-sm text-gray-400">{ui(message || 'رابط المشاركة غير مفعّل بعد على الموقع.')}</p>}
    {state === 'ready' && <>
      <fieldset className="mt-4">
        <legend className="text-xs text-gray-400">{ui('الأقسام الظاهرة في الرابط')}</legend>
        <div className="mt-2 flex flex-wrap gap-3">{SHARE_SECTIONS.map(section => <label key={section} className="flex min-h-11 items-center gap-2 text-sm text-gray-200">
          <input type="checkbox" checked={sections.includes(section)} onChange={() => toggle(section)} className="h-4 w-4 accent-cyan-500" />{ui(SECTION_LABELS[section])}
        </label>)}</div>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void send('POST')} disabled={busy || sections.length === 0} className="min-h-11 rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white disabled:opacity-50">{ui(busy ? 'جارٍ الحفظ…' : link ? 'أنشئ رابطًا جديدًا بدلًا منه' : 'أنشئ رابط المشاركة')}</button>
        {link && <button type="button" onClick={revoke} disabled={busy} className="min-h-11 rounded-xl border border-red-500/40 px-5 text-sm font-bold text-red-300 disabled:opacity-50">{ui('ألغِ الرابط')}</button>}
      </div>
      {link && <p className="mt-2 text-xs text-gray-500">{ui('إنشاء رابط جديد يوقف الرابط الحالي.')}</p>}
      {link && <div className="mt-4">
        <label htmlFor="career-share-url" className="text-xs text-gray-400">{ui('الرابط الحالي')}</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input id="career-share-url" dir="ltr" readOnly value={url} onFocus={event => event.currentTarget.select()} className="min-h-11 flex-1 rounded-xl border border-[#3f3f46] bg-[#27272a] px-3 text-xs text-white" />
          <button type="button" onClick={() => void copy()} className="min-h-11 rounded-xl border border-cyan-500/40 px-4 text-sm font-bold text-cyan-300">{ui(copied ? 'نُسخ الرابط' : 'انسخ الرابط')}</button>
        </div>
        {link.orcid !== orcid && <p role="alert" className="mt-2 text-xs text-amber-300">{ui('هذا الرابط يعرض معرّفك السابق. أنشئ رابطًا جديدًا ليعرض المعرّف الحالي.')}</p>}
      </div>}
    </>}
    {message && state === 'ready' && <p role="alert" className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{ui(message)}</p>}
  </section>;
}
