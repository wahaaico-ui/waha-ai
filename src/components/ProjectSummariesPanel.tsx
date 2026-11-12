'use client';

import { useEffect, useState } from 'react';
import TaskExportButtons from '@/components/TaskExportButtons';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { summaryReady, type ProjectSummary, type SummaryText } from '@/lib/project-summaries';

type Summaries = { journal: ProjectSummary; decision: ProjectSummary };

/** One summary as saved: its sections word for word, the template checks and what it lacks. */
export function SummaryCard({ summary, projectId }: { summary: ProjectSummary; projectId: string }) {
  const { text: ui } = useUiTranslation();
  const line = (item: SummaryText) => ui(item.text, (item.values ?? []).map(value => (typeof value === 'string' ? ui(value) : value)));
  const journal = summary.kind === 'journal';
  return <article className="rounded-xl border border-slate-200 p-4">
    <h3 className="text-lg font-black text-slate-950">{ui(journal ? 'ملخص رسمي للمجلة' : 'ملخص لصانع القرار')}</h3>
    <p className="mt-1 text-xs leading-6 text-slate-500">{ui(journal ? 'بعناوين الملخص المهيكل التي تطلبها المجلات.' : 'المشكلة وما توصلت إليه الدراسة وما يعنيه للقرار، مع حدود النتائج.')}</p>
    {summary.title && <p dir="auto" className="mt-3 font-bold">{summary.title}</p>}
    {summary.target && <p className="text-xs text-slate-500">{ui('المجلة المستهدفة: {0}', [summary.target])}</p>}
    {summary.sections.length > 0 && <dl className="mt-3 space-y-3 text-sm leading-7">{summary.sections.map(section => <div key={section.heading}>
      <dt className="font-bold text-slate-900">{ui(section.heading)}</dt>
      <dd dir="auto" className="whitespace-pre-line text-slate-700">{section.text}</dd>
    </div>)}</dl>}
    {summary.checks.length > 0 && <ul className="mt-3 space-y-1 text-xs">{summary.checks.map(check => <li key={check.text} className={check.state === 'met' ? 'text-emerald-800' : 'text-amber-800'}>{check.state === 'met' ? '✓ ' : '! '}{line(check)}</li>)}</ul>}
    {summary.missing.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
      <p className="font-bold">{ui('ما ينقص هذا الملخص')}</p>
      <ul className="mt-1 list-disc ps-4">{summary.missing.map(item => <li key={item.text + (item.values ?? []).join()}>{line(item)}</li>)}</ul>
    </div>}
    {summaryReady(summary) && <TaskExportButtons projectId={projectId} task={journal ? 'journal_summary' : 'decision_summary'} />}
  </article>;
}

/** Both summaries of the saved project (DOC-39-04); reloaded after the publication stage is saved. */
export default function ProjectSummariesPanel({ projectId, savedAt }: { projectId: string; savedAt: string | null }) {
  const { text: ui } = useUiTranslation();
  const [summaries, setSummaries] = useState<Summaries | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/summaries`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as Summaries & { error?: string };
        if (!response.ok) throw new Error(data.error || 'تعذر إعداد الملخصين الآن. أعد المحاولة.');
        if (active) { setSummaries(data); setError(''); }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر الاتصال بالخادم.'); });
    return () => { active = false; };
  }, [projectId, savedAt]);

  return <section aria-labelledby="project-summaries" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 id="project-summaries" className="text-xl font-black">{ui('ملخصان للمشروع')}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-500">{ui('منقولان من مخرجات المشروع المحفوظة كما هي؛ لا يضيفان نتيجة أو توصية ليست فيها. عدّل المرحلة نفسها ليتغير الملخص.')}</p>
    {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{ui(error)}</p>}
    {!summaries && !error && <p role="status" className="mt-3 text-sm text-slate-500">{ui('جارٍ إعداد الملخصين…')}</p>}
    {summaries && <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <SummaryCard summary={summaries.journal} projectId={projectId} />
      <SummaryCard summary={summaries.decision} projectId={projectId} />
    </div>}
  </section>;
}
