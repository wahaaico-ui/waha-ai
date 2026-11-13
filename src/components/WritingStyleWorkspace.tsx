'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PenLine } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { STYLE_MIN_WORDS, type ApprovedStyleProfile, type SentenceLength, type StyleProfile } from '@/lib/writing-style';

const CITATIONS = { 'author-year': 'المؤلف والسنة بين قوسين', numeric: 'أرقام بين معقوفين', none: 'لا استشهادات في العينة' } as const;
const VOICES = { first: 'المتكلم (نحن)', third: 'الغائب (الباحث، الدراسة)', mixed: 'مزيج من المتكلم والغائب', unstated: 'لا تظهر في العينة' } as const;
const LENGTHS: Record<SentenceLength, string> = { short: 'قصيرة', medium: 'متوسطة', long: 'طويلة' };
const countWords = (text: string) => text.match(/[\p{L}\p{M}\p{N}]+/gu)?.length ?? 0;
/** Only pages inside the research journey are offered as the way back. */
const safeNext = (value: string | null) => (value && /^\/research\/[a-z-]+(?:\?[\w=&%.-]*)?$/i.test(value) ? value : null);

/** What the style test measured, so it can be rendered and tested on its own. */
export function StyleMeasures({ profile }: { profile: StyleProfile }) {
  const { text: ui } = useUiTranslation();
  const rows: Array<[string, string]> = [
    [ui('طول الجملة'), ui('{0} كلمة في المتوسط ({1})، و{2}٪ من الجمل تتجاوز 30 كلمة', [profile.sentences.averageWords, ui(LENGTHS[profile.sentenceLength]), Math.round(profile.sentences.longShare * 100)])],
    [ui('الفقرات'), ui('{0} فقرة، في كل منها {1} جمل في المتوسط', [profile.paragraphs.count, profile.paragraphs.averageSentences])],
    [ui('تنوع المفردات'), ui('{0}٪ من الكلمات غير مكررة', [Math.round(profile.vocabulary.diversity * 100)])],
    [ui('الاستشهاد'), ui('{0}، بمعدل {1} لكل 100 كلمة', [ui(CITATIONS[profile.citations.format]), profile.citations.perHundredWords])],
    [ui('صيغة الكتابة'), ui(VOICES[profile.voice])],
  ];
  return <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl>;
}

/** The style test: measure a sample, review and edit, approve once (DOC-26-03, DOC-13-06). */
export default function WritingStyleWorkspace() {
  const { text: ui, direction } = useUiTranslation();
  const [approved, setApproved] = useState<ApprovedStyleProfile | null>(null);
  const [sample, setSample] = useState('');
  const [measured, setMeasured] = useState<StyleProfile | null>(null);
  const [terms, setTerms] = useState('');
  const [voice, setVoice] = useState<'first' | 'third'>('third');
  const [length, setLength] = useState<SentenceLength>('medium');
  const [busy, setBusy] = useState<'load' | 'measure' | 'approve' | null>('load');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string; values?: unknown[] } | null>(null);
  // Read once on the client; the link it feeds only shows after the profile loads, so the server render matches.
  const [next] = useState<string | null>(() => (typeof window === 'undefined' ? null : safeNext(new URLSearchParams(window.location.search).get('next'))));
  const words = useMemo(() => countWords(sample), [sample]);

  useEffect(() => {
    fetch('/api/writing-style', { cache: 'no-store' }).then(response => response.ok ? response.json() : { profile: null })
      .then((data: { profile?: ApprovedStyleProfile | null }) => setApproved(data.profile || null)).catch(() => undefined).finally(() => setBusy(null));
  }, []);

  async function send(method: 'POST' | 'PUT') {
    setBusy(method === 'POST' ? 'measure' : 'approve'); setMessage(null);
    try {
      const body = method === 'POST' ? { sample } : { sample, terms: terms.split('\n'), voice, sentenceLength: length };
      const response = await fetch('/api/writing-style', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as { profile?: StyleProfile & Partial<ApprovedStyleProfile>; error?: string; values?: unknown[] };
      if (!response.ok || !data.profile) { setMessage({ type: 'error', text: data.error || 'تعذر الاتصال بالخادم.', values: data.values }); return; }
      if (method === 'POST') {
        setMeasured(data.profile); setTerms(data.profile.terms.join('\n'));
        setVoice(data.profile.voice === 'first' ? 'first' : 'third'); setLength(data.profile.sentenceLength);
      } else {
        setApproved(data.profile as ApprovedStyleProfile); setMeasured(null); setSample('');
        setMessage({ type: 'success', text: 'اعتُمد ملف أسلوبك. المسودات المقترحة ستُكتب به، ويمكنك إعادة الاختبار متى شئت.' });
      }
    } catch { setMessage({ type: 'error', text: 'تعذر الاتصال بالخادم.' }); }
    finally { setBusy(null); }
  }

  return <div dir={direction} className="min-h-screen bg-slate-50 pb-20 text-slate-950"><SiteHeader /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white sm:p-10">
      <div className="flex items-center gap-3"><PenLine className="h-7 w-7" aria-hidden="true" /><h1 className="text-2xl font-black sm:text-3xl">{ui('اختبار الأسلوب')}</h1></div>
      <p className="mt-3 text-sm leading-7 text-blue-50">{ui('الصق نصًا كتبته أنت، فنقيس طول جملك وفقراتك ومفرداتك ومصطلحاتك وطريقة استشهادك. تراجع النتيجة وتعدّلها ثم تعتمدها، فتُكتب المسودات المقترحة بأسلوبك. لا نحفظ العينة نفسها.')}</p>
    </section>

    {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`mt-6 rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{ui(message.text, message.values)}</p>}
    {next && approved && <Link href={next} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white">{ui('عُد إلى صفحتك واقترح المسودة')}</Link>}

    {approved && !measured && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">{ui('ملف أسلوبك المعتمد')}</h2>
      <p className="mt-1 text-xs text-slate-500">{ui('اعتُمد في {0}.', [approved.approvedAt.slice(0, 10)])}</p>
      <div className="mt-4"><StyleMeasures profile={approved} /></div>
      {approved.terms.length > 0 && <p className="mt-3 text-sm"><strong>{ui('المصطلحات:')}</strong> <span dir="auto">{approved.terms.join('، ')}</span></p>}
    </section>}

    {!busy || busy !== 'load' ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <label htmlFor="style-sample" className="block text-sm font-bold">{ui(approved ? 'أعد الاختبار بعينة جديدة' : 'عينة من كتابتك')}</label>
      <p className="mt-1 text-xs leading-6 text-slate-500">{ui('{0} كلمة على الأقل من فصل أو مقال كتبته بنفسك، لا من نص منقول أو مولّد.', [STYLE_MIN_WORDS])}</p>
      <textarea id="style-sample" dir="auto" rows={10} value={sample} onChange={event => { setSample(event.target.value); setMeasured(null); }} className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-bold ${words >= STYLE_MIN_WORDS ? 'text-emerald-700' : 'text-slate-500'}`}>{ui('{0} من {1} كلمة', [words, STYLE_MIN_WORDS])}</span>
        <button type="button" onClick={() => void send('POST')} disabled={busy !== null || words < STYLE_MIN_WORDS} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">{ui(busy === 'measure' ? 'جارٍ القياس…' : 'حلّل عينتي')}</button>
      </div>
    </section> : <p role="status" className="mt-6 text-sm text-slate-500">{ui('جارٍ قراءة ملف أسلوبك…')}</p>}

    {measured && <section aria-label={ui('نتيجة اختبار الأسلوب')} className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">{ui('راجع النتيجة قبل اعتمادها')}</h2>
      <div className="mt-4"><StyleMeasures profile={measured} /></div>
      <label htmlFor="style-terms" className="mt-5 block text-sm font-bold">{ui('مصطلحاتك (مصطلح في كل سطر)')}</label>
      <p className="mt-1 text-xs text-slate-500">{ui('استخرجناها مما تكرر في عينتك. احذف ما ليس مصطلحًا، وأضف ما تريد أن يلتزم به النص.')}</p>
      <textarea id="style-terms" dir="auto" rows={5} value={terms} onChange={event => setTerms(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm" />
      <fieldset className="mt-4"><legend className="text-sm font-bold">{ui('صيغة الكتابة في المسودات')}</legend>
        <div className="mt-2 flex flex-wrap gap-4">{(['third', 'first'] as const).map(option => <label key={option} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="style-voice" checked={voice === option} onChange={() => setVoice(option)} />{ui(VOICES[option])}</label>)}</div>
      </fieldset>
      <fieldset className="mt-3"><legend className="text-sm font-bold">{ui('طول الجمل في المسودات')}</legend>
        <div className="mt-2 flex flex-wrap gap-4">{(['short', 'medium', 'long'] as const).map(option => <label key={option} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="style-length" checked={length === option} onChange={() => setLength(option)} />{ui(LENGTHS[option])}</label>)}</div>
      </fieldset>
      <button type="button" onClick={() => void send('PUT')} disabled={busy !== null} className="mt-5 min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white disabled:opacity-50">{ui(busy === 'approve' ? 'جارٍ الاعتماد…' : 'اعتمد ملف أسلوبي')}</button>
    </section>}
  </main></div>;
}
