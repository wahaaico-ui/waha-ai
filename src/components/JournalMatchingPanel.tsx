'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import type { JournalAngles, JournalMatch, JournalMatches } from '@/lib/journal-matching';

const yes = (value: boolean | null) => (value === null ? 'غير معروف' : value ? 'نعم' : 'لا');

/** One journal with what OpenAlex states about it; the acceptance rate is never estimated. */
export function JournalCard({ journal, years, onPlan, planning }: { journal: JournalMatch; years: [number, number]; onPlan: () => void; planning: boolean }) {
  const { text: ui } = useUiTranslation();
  return <li className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p dir="auto" className="font-bold text-slate-950">{journal.name}</p>{journal.publisher && <p dir="auto" className="text-xs text-slate-500">{journal.publisher}{journal.issn ? ` · ISSN ${journal.issn}` : ''}</p>}</div>
      {journal.homepage && <a href={journal.homepage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 underline">{ui('موقع المجلة')}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
    </div>
    <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs leading-6 sm:grid-cols-2">
      <div><dt className="inline text-slate-500">{ui('دراسات في موضوعك')} ({years[0]}–{years[1]}): </dt><dd className="inline font-bold">{journal.topicWorks}</dd></div>
      <div><dt className="inline text-slate-500">{ui('نسبة القبول')}: </dt><dd className="inline font-bold">{ui('غير متاحة؛ لا تنشرها OpenAlex')}</dd></div>
      <div><dt className="inline text-slate-500">{ui('وصول مفتوح')}: </dt><dd className="inline font-bold">{ui(yes(journal.openAccess))}</dd></div>
      <div><dt className="inline text-slate-500">{ui('مدرجة في DOAJ')}: </dt><dd className="inline font-bold">{ui(yes(journal.inDoaj))}</dd></div>
      <div><dt className="inline text-slate-500">{ui('رسوم النشر')}: </dt><dd className="inline font-bold">{journal.apcUsd ? `${journal.apcUsd.toLocaleString('en-US')} USD` : ui('غير معروفة')}</dd></div>
      <div><dt className="inline text-slate-500">{ui('مؤشر h')}: </dt><dd className="inline font-bold">{journal.hIndex ?? ui('غير معروف')}</dd></div>
    </dl>
    <button type="button" onClick={onPlan} disabled={planning} className="mt-3 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">{ui(planning ? 'جارٍ قراءة مجالات المجلة…' : 'خطّط من هذه المجلة')}</button>
  </li>;
}

/** Up to three angles from the journal's own topics, with the data behind each. */
export function JournalAnglesView({ journal, angles, topic }: { journal: string; angles: JournalAngles; topic: string }) {
  const { text: ui } = useUiTranslation();
  return <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm font-black text-blue-950">{ui('زوايا لبحثك من مجالات المجلة')}: <span dir="auto">{journal}</span></p>
    <p className="mt-1 text-xs leading-6 text-blue-900">{ui('مبنية على أكثر موضوعات المجلة نشرًا في {0}–{1}، بحسب OpenAlex في {2}.', [angles.years[0], angles.years[1], angles.checkedAt.slice(0, 10)])}</p>
    {angles.angles.length === 0
      ? <p className="mt-3 text-sm">{ui('لا تكفي بيانات المجلة لاقتراح زاوية؛ لم نقترح زاوية لا تسندها بياناتها.')}</p>
      : <ol className="mt-3 space-y-2 text-sm">{angles.angles.map((angle, index) => <li key={angle.topicId} className="rounded-lg bg-white p-3">
        <p className="font-bold">{index + 1}. <span dir="auto">{topic}</span> — {ui('من زاوية')} <span dir="auto">{angle.topic}</span></p>
        <p className="mt-1 text-xs text-slate-600">{ui('نشرت المجلة {0} دراسة في هذا الموضوع.', [angle.journalWorks])}</p>
        {angle.example && <p className="mt-1 text-xs text-slate-600">{ui('أحدثها')}: {angle.example.doi ? <a href={angle.example.doi} target="_blank" rel="noopener noreferrer" dir="auto" className="text-blue-700 underline">{angle.example.title}</a> : <span dir="auto">{angle.example.title}</span>}{angle.example.year ? ` (${angle.example.year})` : ''}</p>}
      </li>)}</ol>}
    {angles.angles.length > 0 && angles.angles.length < 3 && <p className="mt-2 text-xs text-blue-900">{ui('بيانات المجلة تسند {0} من الزوايا فقط.', [angles.angles.length])}</p>}
  </div>;
}

/** Journals that publish on the project's topic and reverse planning from one of them (DOC-29-02, DOC-29-03). */
export default function JournalMatchingPanel({ defaultTopic }: { defaultTopic: string }) {
  const { text: ui } = useUiTranslation();
  const [topic, setTopic] = useState(defaultTopic);
  const [matches, setMatches] = useState<JournalMatches | null>(null);
  const [angles, setAngles] = useState<{ journal: JournalMatch; data: JournalAngles } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function ask(body: Record<string, string>) {
    const response = await fetch('/api/journals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json() as { matches?: JournalMatches; angles?: JournalAngles; error?: string };
    if (!response.ok) throw new Error(data.error || 'تعذر الوصول إلى بيانات OpenAlex الآن.');
    return data;
  }
  async function search() {
    setBusy('search'); setMessage(''); setAngles(null);
    try { setMatches((await ask({ query: topic.trim() })).matches || null); } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.'); } finally { setBusy(null); }
  }
  async function plan(journal: JournalMatch) {
    setBusy(journal.id); setMessage('');
    try { const data = (await ask({ journalId: journal.id })).angles; if (data) setAngles({ journal, data }); } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم.'); } finally { setBusy(null); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-black">{ui('مجلات تنشر في موضوعك')}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-500">{ui('من بيانات OpenAlex الفعلية: المجلات التي نشرت أكثر في موضوعك خلال السنوات الخمس المكتملة الأخيرة. لا نعرض نسبة قبول لا تنشرها المصادر.')}</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="journal-topic" className="sr-only">{ui('موضوع البحث')}</label>
      <input id="journal-topic" dir="auto" value={topic} onChange={event => setTopic(event.target.value)} className="min-h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm" />
      <button type="button" onClick={() => void search()} disabled={busy !== null || topic.trim().length < 3} className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:opacity-50">{ui(busy === 'search' ? 'جارٍ البحث…' : 'اعرض المجلات')}</button>
    </div>
    {message && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{ui(message)}</p>}
    {matches && (matches.journals.length === 0
      ? <p className="mt-4 text-sm text-slate-600">{ui('لم نجد مجلات نشرت في هذا الموضوع خلال هذه السنوات. جرّب صياغة أعم.')}</p>
      : <ul className="mt-4 space-y-3">{matches.journals.map(journal => <li key={journal.id} className="list-none">
        <ul><JournalCard journal={journal} years={matches.years} onPlan={() => void plan(journal)} planning={busy === journal.id} /></ul>
        {angles?.journal.id === journal.id && <JournalAnglesView journal={journal.name} angles={angles.data} topic={topic.trim()} />}
      </li>)}</ul>)}
  </section>;
}
