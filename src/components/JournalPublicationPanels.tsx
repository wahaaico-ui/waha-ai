'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { JOURNAL_CATALOG } from '@/lib/journal-catalog';
import { buildJournalFit, JOURNAL_PRESETS, MANUSCRIPT_SECTIONS, SECTION_LABELS, type JournalTemplate, type ManuscriptSection } from '@/lib/journal-template';
import { buildResponseLetter, COMMENT_STATUSES, REVIEW_DECISIONS, REVIEWERS, type JournalReview, type ReviewComment } from '@/lib/journal-review';

const CHECK_LABELS = { sections: 'الأقسام المطلوبة مكتوبة', words: 'عدد كلمات المخطوط', abstract: 'عدد كلمات الملخص', keywords: 'عدد الكلمات المفتاحية', references: 'عدد المراجع' } as const;
const DECISION_LABELS = { accept: 'قبول', minor: 'تعديلات طفيفة', major: 'تعديلات جوهرية', reject: 'رفض' } as const;
const STATUS_LABELS = { open: 'مفتوحة', addressed: 'عُدّل المخطوط', declined: 'لم يُعدّل، مع التوضيح' } as const;
const reviewerLabel = (r: string) => r === 'editor' ? 'المحرر' : `المحكم ${r.slice(-1)}`;
const field = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';

/** 4. Arrange the manuscript to the journal's own instructions and check it (DOC-29-05). */
export function JournalTemplatePanel({ projectId, outputs, publication }: {
  projectId: string;
  outputs: Partial<Record<string, unknown>>;
  publication: { structuredAbstract?: Record<string, string>; keywords?: string[] } | null;
}) {
  const { text: ui, language } = useUiTranslation();
  const [template, setTemplate] = useState<JournalTemplate>(JOURNAL_PRESETS.imrad);
  const [references, setReferences] = useState(0);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const catalogJournal = JOURNAL_CATALOG.find(journal => journal.id === catalogId) ?? null;

  useEffect(() => {
    let active = true;
    const id = encodeURIComponent(projectId);
    fetch(`/api/projects/${id}/journal-template`, { cache: 'no-store' }).then(r => r.json()).then((data: { template?: JournalTemplate | null }) => { if (active && data.template) setTemplate(data.template); }).catch(() => undefined);
    fetch(`/api/research/library?projectId=${id}&view=items`, { cache: 'no-store' }).then(r => r.json()).then((data: { total?: number }) => { if (active && Number.isSafeInteger(data.total)) setReferences(data.total!); }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  const fit = useMemo(() => buildJournalFit(template, outputs, publication, references), [template, outputs, publication, references]);
  const change = (next: Partial<JournalTemplate>) => { setStatus('idle'); setCatalogId(''); setTemplate(current => ({ ...current, ...next, preset: next.preset ?? 'custom' })); };
  const numberOrNull = (value: string) => value.trim() ? Math.max(1, Math.trunc(Number(value)) || 1) : null;
  const toggleSection = (section: ManuscriptSection) => change({ sections: template.sections.includes(section) ? template.sections.filter(s => s !== section) : MANUSCRIPT_SECTIONS.filter(s => s === section || template.sections.includes(s)) });

  async function save() {
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journal-template`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(template) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setStatus('error'); setMessage(data.error || 'تعذر الحفظ.'); return; }
      setStatus('saved');
    } catch { setStatus('error'); setMessage('تعذر الاتصال بالخادم.'); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-black">{ui('4. مطابقة قالب المجلة')}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600">{ui('أدخل تعليمات المجلة كما في دليل المؤلفين، أو ابدأ من مجلة قرأنا تعليماتها، فنرتب أقسام بحثك بترتيبها ونفحصه بحدودها. القالبان العامّان نقطة بداية لا تعليمات مجلة بعينها.')}</p>

    <div className="mt-5 grid gap-2 sm:grid-cols-2">{(['imrad', 'review'] as const).map(preset => <button key={preset} type="button" onClick={() => { setStatus('idle'); setCatalogId(''); setTemplate(JOURNAL_PRESETS[preset]); }}
      className={`rounded-xl border px-4 py-3 text-sm font-bold ${template.preset === preset ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>{ui(preset === 'imrad' ? 'مقال بحثي (IMRaD)' : 'مقال مراجعة')}</button>)}</div>

    <label className="mt-4 block text-sm font-bold">{ui('أو ابدأ من تعليمات مجلة قرأناها')}
      <select value={catalogId} onChange={event => { const journal = JOURNAL_CATALOG.find(item => item.id === event.target.value); setStatus('idle'); setCatalogId(journal?.id ?? ''); if (journal) setTemplate(journal.template); }} className={`mt-1 ${field}`}>
        <option value="">{ui('اختر مجلة')}</option>
        {JOURNAL_CATALOG.map(journal => <option key={journal.id} value={journal.id}>{journal.name} — {journal.articleType}</option>)}
      </select></label>
    {catalogJournal && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-950">
      <p>{ui('من تعليمات المؤلفين كما قرأناها في {0}. تحقق من الصفحة قبل الإرسال؛ تتغير التعليمات.', [new Date(`${catalogJournal.checkedAt}T00:00:00Z`).toLocaleDateString(language === 'en' ? 'en-GB' : 'ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })])} <a href={catalogJournal.source} target="_blank" rel="noopener noreferrer" className="font-bold underline">{ui(catalogJournal.sourceKind === 'journal' ? 'صفحة المجلة' : 'المصدر الناقل')}</a></p>
      {catalogJournal.notChecked.length > 0 && <><p className="mt-2 font-bold">{ui('قواعد في التعليمات لا يفحصها القالب:')}</p><ul className="list-disc ps-5">{catalogJournal.notChecked.map(rule => <li key={rule}>{ui(rule)}</li>)}</ul></>}
    </div>}

    <fieldset className="mt-5"><legend className="text-sm font-bold">{ui('الأقسام المطلوبة بترتيب المجلة')}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{MANUSCRIPT_SECTIONS.map(section => <label key={section} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <input type="checkbox" checked={template.sections.includes(section)} onChange={() => toggleSection(section)} />{ui(SECTION_LABELS[section])}</label>)}</div></fieldset>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {([['wordLimit', 'الحد الأقصى لكلمات المخطوط'], ['abstractMaxWords', 'الحد الأقصى لكلمات الملخص'], ['referenceLimit', 'الحد الأقصى للمراجع']] as const).map(([key, label]) => <label key={key} className="block space-y-1 text-sm font-bold">{ui(label)}
        <input type="number" min={1} inputMode="numeric" placeholder={ui('دون حد')} value={template[key] ?? ''} onChange={event => change({ [key]: numberOrNull(event.target.value) })} className={field} /></label>)}
      <label className="block space-y-1 text-sm font-bold">{ui('الكلمات المفتاحية: من … إلى')}
        <span className="flex gap-2"><input type="number" min={0} value={template.keywordsMin ?? ''} onChange={event => change({ keywordsMin: event.target.value === '0' ? 0 : numberOrNull(event.target.value) })} className={field} />
          <input type="number" min={1} value={template.keywordsMax ?? ''} onChange={event => change({ keywordsMax: numberOrNull(event.target.value) })} className={field} /></span></label>
    </div>

    <h3 className="mt-6 text-sm font-black">{ui('ترتيب المخطوط حسب القالب')}</h3>
    <ol className="mt-2 space-y-2">{fit.outline.map((item, index) => <li key={item.section} className={`rounded-xl border p-3 text-sm ${item.missing ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
      <span className="font-bold">{index + 1}. {ui(SECTION_LABELS[item.section])}</span> — {item.missing ? ui('لم يُكتب بعد في مراحل المشروع') : `${item.words.toLocaleString('en-US')} ${ui('كلمة')}`}
    </li>)}</ol>

    <h3 className="mt-6 text-sm font-black">{ui('الفحص مقابل تعليمات المجلة')}</h3>
    <ul className="mt-2 space-y-2">{fit.checks.map(check => <li key={check.id} className={`flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm ${check.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
      <span>{check.ok ? '✓' : '✗'} {ui(CHECK_LABELS[check.id])}</span><span className="tabular-nums">{check.actual.toLocaleString('en-US')} / {check.limit}</span>
    </li>)}</ul>

    <button type="button" onClick={() => void save()} disabled={status === 'saving'} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">{status === 'saving' ? ui('جارٍ الحفظ…') : ui('احفظ قالب المجلة')}</button>
    {status === 'saved' && <p role="status" className="mt-2 text-sm text-emerald-700">{ui('حُفظ قالب المجلة في المشروع.')}</p>}
    {status === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">{ui(message)}</p>}
  </section>;
}

const emptyComment = (): ReviewComment => ({ id: crypto.randomUUID(), reviewer: 'reviewer-1', comment: '', location: '', response: '', status: 'open' });

/** 5. Reviewer comments, responses and a point-by-point response letter (DOC-29-06). */
export function JournalReviewPanel({ projectId, journalName }: { projectId: string; journalName: string }) {
  const { text: ui, language } = useUiTranslation();
  const [review, setReview] = useState<JournalReview>({ journal: journalName, round: 1, decision: 'major', comments: [emptyComment()] });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/journal-review`, { cache: 'no-store' }).then(r => r.json())
      .then((data: { reviews?: JournalReview[] }) => { if (active && data.reviews?.[0]) setReview(data.reviews[0]); }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);

  const filled = review.comments.filter(c => c.comment.trim());
  const letter = useMemo(() => filled.length ? buildResponseLetter({ ...review, comments: filled }, language === 'en' ? 'en' : 'ar') : '', [review, filled, language]);
  const edit = (next: Partial<JournalReview>) => { setStatus('idle'); setCopied(false); setReview(current => ({ ...current, ...next })); };
  const editComment = (id: string, next: Partial<ReviewComment>) => edit({ comments: review.comments.map(c => c.id === id ? { ...c, ...next } : c) });

  async function save() {
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journal-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...review, comments: filled }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setStatus('error'); setMessage(data.error || 'تعذر الحفظ.'); return; }
      setStatus('saved');
    } catch { setStatus('error'); setMessage('تعذر الاتصال بالخادم.'); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-black">{ui('5. ملاحظات المحكّمين')}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600">{ui('سجّل قرار المجلة وكل ملاحظة من المحرر والمحكمين، واكتب ردك عليها: عدّلت المخطوط، أو لم تعدّله مع التوضيح. نبني لك رسالة الرد نقطة بنقطة.')}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="block space-y-1 text-sm font-bold">{ui('المجلة')}<input value={review.journal} maxLength={300} onChange={e => edit({ journal: e.target.value })} className={field} dir="auto" /></label>
      <label className="block space-y-1 text-sm font-bold">{ui('الجولة')}<input type="number" min={1} max={20} value={review.round} onChange={e => edit({ round: Math.min(20, Math.max(1, Math.trunc(Number(e.target.value)) || 1)) })} className={field} /></label>
      <label className="block space-y-1 text-sm font-bold">{ui('قرار المجلة')}<select value={review.decision} onChange={e => edit({ decision: e.target.value as JournalReview['decision'] })} className={field}>
        {REVIEW_DECISIONS.map(d => <option key={d} value={d}>{ui(DECISION_LABELS[d])}</option>)}</select></label>
    </div>

    <ol className="mt-5 space-y-4">{review.comments.map((c, index) => <li key={c.id} className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-black">{ui('الملاحظة')} {index + 1}</span>
        {review.comments.length > 1 && <button type="button" onClick={() => edit({ comments: review.comments.filter(x => x.id !== c.id) })} className="text-xs font-bold text-red-700 underline">{ui('احذف الملاحظة')}</button>}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1 text-xs font-bold">{ui('من')}<select value={c.reviewer} onChange={e => editComment(c.id, { reviewer: e.target.value as ReviewComment['reviewer'] })} className={field}>{REVIEWERS.map(r => <option key={r} value={r}>{ui(reviewerLabel(r))}</option>)}</select></label>
        <label className="block space-y-1 text-xs font-bold">{ui('الموضع في المخطوط')}<input value={c.location} maxLength={300} onChange={e => editComment(c.id, { location: e.target.value })} className={field} dir="auto" /></label>
        <label className="block space-y-1 text-xs font-bold">{ui('الحالة')}<select value={c.status} onChange={e => editComment(c.id, { status: e.target.value as ReviewComment['status'] })} className={field}>{COMMENT_STATUSES.map(s => <option key={s} value={s}>{ui(STATUS_LABELS[s])}</option>)}</select></label>
      </div>
      <label className="mt-3 block space-y-1 text-xs font-bold">{ui('نص الملاحظة')}<textarea rows={3} maxLength={4000} value={c.comment} onChange={e => editComment(c.id, { comment: e.target.value })} className={field} dir="auto" /></label>
      <label className="mt-3 block space-y-1 text-xs font-bold">{ui('ردك')}<textarea rows={3} maxLength={4000} value={c.response} onChange={e => editComment(c.id, { response: e.target.value })} className={field} dir="auto" /></label>
      {c.status !== 'open' && !c.response.trim() && <p className="mt-2 text-xs text-amber-700">{ui('اكتب ردك قبل الحفظ.')}</p>}
    </li>)}</ol>
    <button type="button" onClick={() => edit({ comments: [...review.comments, emptyComment()] })} className="mt-3 w-full rounded-xl border border-slate-300 py-3 text-sm font-bold">{ui('أضف ملاحظة')}</button>

    {letter && <div className="mt-6"><div className="flex items-center justify-between"><h3 className="text-sm font-black">{ui('رسالة الرد على المحكمين')}</h3>
      <button type="button" onClick={() => { void navigator.clipboard.writeText(letter).then(() => setCopied(true)); }} className="text-sm font-bold text-blue-700 underline">{copied ? ui('نُسخت') : ui('انسخ الرسالة')}</button></div>
      <pre dir="auto" className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7">{letter}</pre></div>}

    <button type="button" onClick={() => void save()} disabled={status === 'saving' || !filled.length} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">{status === 'saving' ? ui('جارٍ الحفظ…') : ui('احفظ جولة التحكيم')}</button>
    {status === 'saved' && <p role="status" className="mt-2 text-sm text-emerald-700">{ui('حُفظت جولة التحكيم في المشروع.')}</p>}
    {status === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">{ui(message)}</p>}
  </section>;
}
