'use client';

import { useDeferredValue, useMemo } from 'react';
import { buildWritingCitationPlan, citationIssueText, writingCitationDisplay, WRITING_STYLE_LABELS } from '@/lib/citations/writing-citations';
import type { WritingCitation, WritingDraft, WritingSource } from '@/lib/evidence-writing';
import { richWritingCitationBlocks } from '@/lib/writing-rich-citations';
import { groupWritingRenderBlocks, type WritingRenderBlock } from '@/lib/writing-rich-text';

export default function WritingCitationPreview({ draft, sources, language, onOpen }: {
  draft: WritingDraft; sources: Record<string, Omit<WritingSource, 'text' | 'hash'>>;
  language: 'ar' | 'en'; onOpen: (citation: WritingCitation) => void;
}) {
  const ar = language === 'ar';
  const deferred = useDeferredValue(draft);
  const rendered = useMemo(() => {
    try { return { plan: buildWritingCitationPlan(deferred, sources), error: false }; }
    catch { return { plan: null, error: true }; }
  }, [deferred, sources]);
  const plan = rendered.plan;
  const blocks = useMemo(() => plan && deferred.richText ? richWritingCitationBlocks(deferred.richText, plan) : null, [plan, deferred.richText]);
  const items = useMemo(() => blocks ? groupWritingRenderBlocks(blocks) : null, [blocks]);
  const renderBlock = (block: WritingRenderBlock, index: number) => <div key={index} dir="auto" role={block.kind === 'heading' ? 'heading' : undefined} aria-level={block.kind === 'heading' ? block.level : undefined} style={{ paddingInlineStart: `${Math.min(block.indent, 6)}rem` }} className={`${block.kind === 'heading' ? block.level === 1 ? 'text-2xl font-bold' : block.level === 2 ? 'text-xl font-bold' : 'text-lg font-bold' : ''} ${block.quote ? 'border-s-2 border-primary ps-4 text-slate-600' : ''} whitespace-pre-wrap`}>
    {block.prefix}{block.runs.map((run, runIndex) => <span key={runIndex} style={{ fontWeight: run.marks?.includes('bold') ? 750 : undefined, fontStyle: run.marks?.includes('italic') ? 'italic' : undefined, textDecoration: [run.marks?.includes('underline') ? 'underline' : '', run.marks?.includes('strike') ? 'line-through' : ''].filter(Boolean).join(' ') || undefined }} className={run.citationIds?.length ? 'text-primary-dark' : undefined}>{run.text}{run.citationIds?.map(id => {
      const citation = deferred.citations.find(c => c.id === id); if (!citation) return null;
      const number = deferred.citations.indexOf(citation) + 1;
      return <button key={id} type="button" onClick={() => onOpen(citation)} aria-label={`${ar ? 'افتح الدليل' : 'Open evidence'} ${number}`} className="mx-1 inline rounded border border-primary/20 bg-primary-tint px-2 py-1 text-xs font-bold text-primary-dark">{ar ? 'الدليل' : 'Evidence'} {number}</button>;
    })}</span>)}
  </div>;
  return <section aria-busy={deferred !== draft} className="min-w-0 rounded-2xl border border-line bg-white p-5">
    <h3 className="text-xl font-bold">{ar ? 'النص وإحالاته وقائمة مراجعه' : 'Text, citations and references'}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-600">{ar ? 'تتبع الإحالات المراجع المستخدمة في مسودتك. افتح أدلة الجملة لمراجعة المقاطع الأصلية. التوثيق لا يحكم على صحة الاستنتاج.' : 'Citations follow the sources used in your draft. Open the sentence evidence to review original passages. Formatting does not assess the conclusion.'}</p>
    {rendered.error && <p role="status" className="mt-4 text-sm leading-7">{ar ? 'تعذر عرض الإحالات الآن. نصك وأدلتك محفوظان في المحرر؛ أعد فتح المعاينة قبل التنزيل.' : 'Citations could not be displayed. Your text and evidence remain in the editor; reopen the preview before downloading.'}</p>}
    {plan && <>
      {items ? <div className="mt-4 min-w-0 space-y-4 break-words text-base leading-9 [overflow-wrap:anywhere]">{items.map((item, index) => item.kind === 'table' ? <div key={index} role="region" aria-label={`${ar ? 'جدول المسودة' : 'Draft table'} ${index + 1}`} tabIndex={0} className="max-w-full overflow-x-auto rounded-lg border border-line">
        <table dir={ar ? 'rtl' : 'ltr'} style={{ minWidth: `${Math.max(28, item.rows[0].cells.length * 9)}rem` }} className="w-full table-fixed border-collapse text-sm leading-7"><tbody>{item.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.cells.map((cell, cellIndex) => {
          const Cell = cell.header ? 'th' : 'td';
          return <Cell key={cellIndex} scope={cell.header ? 'col' : undefined} className={`border border-line p-3 align-top text-start ${cell.header ? 'bg-primary-tint font-bold' : ''}`}><div className="space-y-2">{cell.blocks.map(renderBlock)}</div></Cell>;
        })}</tr>)}</tbody></table>
      </div> : renderBlock(item, index))}</div> : <div dir="auto" className="mt-4 whitespace-pre-wrap break-words text-base leading-9 [overflow-wrap:anywhere]">{plan.segments.map((segment, index) => { const display = writingCitationDisplay(segment); return <span key={index}>{display.text}{display.inText && <bdi className="ms-1 text-primary-dark">{' '}{display.inText}</bdi>}{display.suffix}{segment.citationIds.map(id => {
        const c = deferred.citations.find(c => c.id === id)!;
        return <button type="button" key={id} onClick={() => onOpen(c)} aria-label={`${ar ? 'افتح الدليل' : 'Open evidence'} ${deferred.citations.indexOf(c) + 1}`} className="mx-1 inline rounded border border-primary/20 bg-primary-tint px-2 py-1 text-xs font-bold text-primary-dark">{ar ? 'الدليل' : 'Evidence'} {deferred.citations.indexOf(c) + 1}</button>;
      })}</span>; })}</div>}
      {plan.bibliography.length > 0 && <div className="mt-6 border-t border-line pt-5"><h4 className="text-base font-bold">{ar ? 'المراجع المستشهد بها في المسودة' : 'References cited in the draft'} — <bdi>{WRITING_STYLE_LABELS[plan.style]}</bdi></h4><ul className="mt-3 space-y-3">{plan.bibliography.map((entry, index) => <li dir="auto" key={index} className="break-words text-sm leading-7 [overflow-wrap:anywhere]">{entry.text}</li>)}</ul></div>}
      {plan.issues.length > 0 && <details className="mt-5 rounded-xl border border-line bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-bold">{ar ? 'بيانات مراجع تحتاج مراجعتك' : 'Reference details to review'} ({plan.issues.length})</summary><ul className="mt-3 space-y-3">{plan.issues.map(issue => <li key={issue.sourceKey} dir="auto" className="break-words text-sm leading-7">{citationIssueText(issue, language)}</li>)}</ul></details>}
    </>}
    <p className="mt-5 text-xs leading-6 text-slate-500"><a href="https://citationstyles.org/" target="_blank" rel="noopener noreferrer" className="underline">citeproc-js implements the Citation Style Language</a> · © Frank Bennett · <a href="/open-source/citeproc/NOTICE.txt" target="_blank" rel="noopener noreferrer" className="underline">{ar ? 'المصدر والتراخيص' : 'Source and licenses'}</a></p>
  </section>;
}
