'use client';

import { useEffect, useState } from 'react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { EXTRACTION_FIELDS, EXTRACTION_LABELS, type ExtractionKey, type StudyExtraction } from '@/lib/writing-analysis';
import type { StudyComparisonPage, StudyComparisonRow } from '@/lib/study-comparison';
import type { WritingSourceKind } from '@/lib/evidence-writing';

const COPY = {
  ar: { title: 'قارن دراسات مشروعك', intro: 'قارن الهدف والمنهج والعينة والنتائج من الاستخراجات المحفوظة. افتح دليل كل معلومة أو أضفها إلى كتابتك مع مصدرها.', show: 'فتح مقارنة الدراسات', hide: 'إغلاق المقارنة', references: 'مراجع المكتبة', pdfs: 'ملفات المشروع', source: 'الدراسة والنص المستخدم', refresh: 'تحديث المقارنة', loading: 'جارٍ استرجاع الدراسات…', error: 'تعذر استرجاع المقارنة. مصادرك وكتابتك محفوظة؛ أعد المحاولة.', retry: 'إعادة المحاولة', empty: 'لا توجد مصادر من هذا النوع في المشروع. أضف مراجع أو ملفات، ثم استخرج معلوماتها من مساحة القراءة.', not_extracted: 'لا يوجد استخراج محفوظ للنص الحالي. افتح المصدر لاستكماله.', text_unavailable: 'النص غير متاح. أضف ملف الدراسة قبل استخراج معلوماتها.', needs_review: 'تحتاج المعلومات إلى مراجعة. افتح المصدر وراجع النسخة المحفوظة أو أعد التحليل.', missing: 'غير مذكور في النص المستخدم', quote: 'راجع الدليل', inspect: 'افتح المقطع في المصدر', open: 'افتح الدراسة', use: 'أضف إلى الكتابة مع الدليل', abstract: 'مستخلص متاح', file: 'نص ملف مستخرج', partial: 'يغطي الاستخراج أول جزء من النص المتاح فقط.', language: 'لغة الاستخراج', arabic: 'العربية', english: 'الإنجليزية', lines: 'الأسطر', pages: 'صفحات الملف', previous: 'السابق', next: 'التالي', paging: 'تُعرض الدراسات على صفحات دون تحديد عدد مراجع المشروع. مرّر الجدول أفقيًا لعرض بقية الحقول.', notice: 'هذه معلومات مستخرجة تحتاج مراجعتك، ولا تمثل حكمًا علميًا على الدراسة أو قراءة نصها الكامل إذا المتاح مستخلص فقط.' },
  en: { title: 'Compare your studies', intro: 'Compare objectives, methods, samples and findings from saved extractions. Inspect the evidence for each item or add it to your writing with its source.', show: 'Open study comparison', hide: 'Close comparison', references: 'Library references', pdfs: 'Project files', source: 'Study and available text', refresh: 'Refresh comparison', loading: 'Loading studies…', error: 'We could not load the comparison. Your sources and writing remain saved; please retry.', retry: 'Retry', empty: 'There are no sources of this type in the project. Add references or files, then extract their information in the reading workspace.', not_extracted: 'No extraction is saved for the current text. Open the source to continue.', text_unavailable: 'Text is unavailable. Add the study file before extracting information.', needs_review: 'This information needs review. Open the source and review its saved version or rerun the analysis.', missing: 'Not reported in the text used', quote: 'Inspect evidence', inspect: 'Open passage in source', open: 'Open study', use: 'Add to writing with evidence', abstract: 'Available abstract', file: 'Extracted file text', partial: 'Extraction covers only the first part of the available text.', language: 'Extraction language', arabic: 'Arabic', english: 'English', lines: 'Lines', pages: 'File pages', previous: 'Previous', next: 'Next', paging: 'Studies are paginated without limiting project references. Scroll the table horizontally to view all fields.', notice: 'Extracted information needs your review. It is not a scientific verdict or a full-text reading when only an abstract is available.' },
} as const;
type Actions = {
  disabled: boolean;
  onOpen: (source: StudyComparisonRow['source']) => void;
  onInspect: (record: StudyExtraction, key: ExtractionKey) => void;
  onUse: (record: StudyExtraction, key: ExtractionKey) => void;
};

export function StudyComparisonTable({ page, language, disabled, onOpen, onInspect, onUse }: Actions & { page: StudyComparisonPage; language: 'ar' | 'en' }) {
  const t = COPY[language];
  return <>
    <p role="status" className="mt-4 text-sm text-slate-600"><bdi dir="ltr">{page.items.length ? `${page.offset + 1}–${page.offset + page.items.length} / ${page.total}` : `0 / ${page.total}`}</bdi></p>
    <p className="mt-2 text-sm leading-7 text-slate-600">{t.paging}</p>
    {!page.items.length ? <p className="mt-4 text-sm leading-7">{t.empty}</p> : <div role="region" aria-label={t.title} tabIndex={0} className="mt-4 max-w-full overflow-x-auto rounded-xl border border-line focus-visible:outline-2 focus-visible:outline-primary">
      <table className="w-full min-w-[76rem] table-fixed border-collapse text-start text-sm">
        <caption className="sr-only">{t.title}</caption>
        <thead className="bg-primary-tint"><tr><th scope="col" className="w-60 border-b border-line p-4 text-start font-bold">{t.source}</th>{EXTRACTION_FIELDS.map(key => <th scope="col" key={key} className="border-b border-line p-4 text-start font-bold">{EXTRACTION_LABELS[language][key]}</th>)}</tr></thead>
        <tbody>{page.items.map(row => {
          const record = row.status === 'ready' ? row.record : null;
          return <tr key={`${row.source.kind}:${row.source.id}`} className="align-top">
            <th scope="row" className="border-b border-line p-4 text-start font-normal">
              <p dir="auto" className="break-words font-bold [overflow-wrap:anywhere]">{row.source.title}</p>
              {row.source.year !== null && <p className="mt-1">{row.source.year}</p>}
              <p className="mt-2 text-xs leading-6 text-slate-600">{row.source.kind === 'reference' ? t.abstract : t.file}</p>
              {record && <><p className="mt-2 text-xs leading-6">{t.language}: {record.language === 'ar' ? t.arabic : t.english}</p>{record.scopeEnd < record.sourceLength && <p className="mt-2 text-xs leading-6 text-slate-600">{t.partial}</p>}</>}
              <button type="button" onClick={() => onOpen(row.source)} className="mt-3 min-h-11 rounded-lg border px-3 py-2 font-bold text-primary-dark">{t.open}</button>
            </th>
            {!record ? <td colSpan={EXTRACTION_FIELDS.length} className="border-b border-line p-4 leading-7 text-slate-600">{row.status === 'ready' ? t.needs_review : t[row.status]}</td> : EXTRACTION_FIELDS.map(key => {
              const field = record.fields[key]; const location = row.locations[key];
              return <td key={key} className="border-b border-line p-4"><p dir="auto" className="whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">{field?.value || t.missing}</p>{field && <>
                <details className="mt-3"><summary className="cursor-pointer font-bold text-primary-dark">{t.quote}</summary><blockquote dir="auto" className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 leading-7 [overflow-wrap:anywhere]">{field.quoteText}</blockquote>
                  {location && <p className="mt-2 text-xs leading-6 text-slate-600">{t.lines} {location.firstLine}–{location.lastLine}{location.pages ? ` · ${t.pages} ${location.pages.first}–${location.pages.last}` : ''}</p>}
                  <button type="button" onClick={() => onInspect(record, key)} className="mt-2 min-h-11 rounded-lg border px-3 py-2 font-bold text-primary-dark">{t.inspect}</button>
                </details>
                <button type="button" disabled={disabled} onClick={() => onUse(record, key)} className="mt-3 min-h-11 rounded-lg border px-3 py-2 font-bold text-primary-dark disabled:opacity-50">{t.use}</button>
              </>}</td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </>;
}

function ComparisonPage({ projectId, kind, language, offset, onNext, ...actions }: Actions & { projectId: string; kind: WritingSourceKind; language: 'ar' | 'en'; offset: number; onNext: (offset: number) => void }) {
  const [page, setPage] = useState<StudyComparisonPage | null>(null);
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  const t = COPY[language];
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const timer = window.setTimeout(() => abort.abort(), 30_000);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/writing/comparison?${new URLSearchParams({ kind, language, offset: String(offset) })}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        const value = await response.json(); if (!active) return;
        if (!response.ok || !Array.isArray(value.items) || value.kind !== kind || value.offset !== offset || !Number.isSafeInteger(value.total) || (value.nextOffset !== null && (!Number.isSafeInteger(value.nextOffset) || value.nextOffset <= offset))) throw new Error('invalid_comparison');
        setPage(value); setFailed(false);
      }).catch(() => { if (active) setFailed(true); }).finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); abort.abort(); };
  }, [projectId, kind, language, offset, attempt]);
  return <>
    {!page && !failed && <p role="status" className="mt-4 text-sm">{t.loading}</p>}
    {failed && <div role="alert" className="mt-4"><p className="text-sm leading-7">{t.error}</p><button type="button" onClick={() => { setFailed(false); setAttempt(v => v + 1); }} className="mt-2 rounded-lg border px-3 py-2 text-sm font-bold">{t.retry}</button></div>}
    {page && <><StudyComparisonTable page={page} language={language} {...actions} />{page.nextOffset !== null && <button type="button" onClick={() => onNext(page.nextOffset!)} className="mt-4 rounded-xl border px-4 py-3 text-sm font-bold text-primary-dark">{t.next}</button>}</>}
  </>;
}

export default function StudyComparisonPanel({ projectId, revision, ...actions }: Actions & { projectId: string; revision: number }) {
  const { language } = useUiTranslation(); const t = COPY[language];
  const [open, setOpen] = useState(false); const [kind, setKind] = useState<WritingSourceKind>('reference');
  const [offsets, setOffsets] = useState([0]); const [refresh, setRefresh] = useState(0);
  const offset = offsets[offsets.length - 1];
  return <section className="min-w-0 rounded-2xl border border-line bg-white p-5" aria-label={t.title}>
    <h3 className="text-xl font-bold">{t.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{t.intro}</p>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="mt-4 rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary-dark">{open ? t.hide : t.show}</button>
    {open && <>
      <div className="mt-4 flex flex-wrap gap-3">{(['reference', 'pdf'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => { setKind(value); setOffsets([0]); }} className="rounded-xl border px-4 py-3 text-sm font-bold aria-pressed:border-primary aria-pressed:bg-primary-tint">{value === 'reference' ? t.references : t.pdfs}</button>)}
        <button type="button" onClick={() => { setOffsets([0]); setRefresh(v => v + 1); }} className="rounded-xl border px-4 py-3 text-sm font-bold">{t.refresh}</button>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">{t.notice}</p>
      {offsets.length > 1 && <button type="button" onClick={() => setOffsets(values => values.slice(0, -1))} className="mt-4 rounded-xl border px-4 py-3 text-sm font-bold">{t.previous}</button>}
      <ComparisonPage key={`${projectId}:${language}:${kind}:${offset}:${refresh}:${revision}`} projectId={projectId} language={language} kind={kind} offset={offset} onNext={value => setOffsets(values => [...values, value])} {...actions} />
    </>}
  </section>;
}
