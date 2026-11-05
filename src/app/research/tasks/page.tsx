'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import ResearchEvidenceSidebar from '@/components/ResearchEvidenceSidebar';
import SavedLiteraturePicker from '@/components/SavedLiteraturePicker';
import ResearchAnalysisWorkspace from '@/components/ResearchAnalysisWorkspace';
import LanguageTaskWorkspace from '@/components/LanguageTaskWorkspace';
import SupervisorReviewWorkspace from '@/components/SupervisorReviewWorkspace';
import EvidenceWritingWorkspace from '@/components/EvidenceWritingWorkspace';
import { loadJourney } from '@/lib/research-journey';
import { useProjectId } from '@/lib/use-project-id';

export default function ResearchTasksPage() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const projectId = useProjectId();
  const [mode, setMode] = useState<'sources' | 'language' | 'supervisor' | 'writing'>('writing');
  const [query, setQuery] = useState('');
  const [revision, setRevision] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState(false);
  useEffect(() => {
    let active = true;
    const task = new URLSearchParams(window.location.search).get('task');
    if (!projectId) return;
    loadJourney(projectId).then((journey) => {
      if (!active) return;
      if (task === 'sources' || task === 'compare') setMode('sources');
      else if (task === 'translate' || task === 'proofread' || task === 'language') setMode('language');
      else if (task === 'supervisor') setMode('supervisor');
      else setMode('writing');
      setComparison(task === 'compare');
      const request = journey.drafts.literature?.content.query;
      setQuery(typeof request === 'string' ? request : ''); setLoaded(true);
    }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [projectId]);
  const choose = (value: 'sources' | 'language' | 'supervisor' | 'writing') => { setMode(value); const url = new URL(window.location.href); url.searchParams.set('task', value === 'sources' && comparison ? 'compare' : value); window.history.replaceState({}, '', url); };
  if (!projectId) return <main dir={uiDirection} className="p-8"><Link href="/">{ui("ابدأ مهمة أو افتح مشروعًا")}</Link></main>;
  return <div dir={uiDirection} className="min-h-screen bg-slate-50 text-slate-950"><SiteHeader /><main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6">
    <header className="rounded-2xl bg-white p-5"><h1 className="text-2xl font-black">{ui("مساحة عمل مشروعك")}</h1><p className="mt-2 text-sm leading-7">{ui("اختر ما تريد إنجازه: اكتب بمصادرك، اجمع المراجع وقارنها، راجع اللغة أو عالج ملاحظات المشرف. يبقى عملك داخل المشروع لتتابعه لاحقًا.")}</p><details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">{ui("خريطة البحث والملفات")}</summary><div className="mt-3 flex flex-wrap gap-4"><Link href={`/research/problem?projectId=${encodeURIComponent(projectId)}`} className="underline">{ui("مشكلة البحث")}</Link><Link href={`/projects/workspace?projectId=${encodeURIComponent(projectId)}`} className="underline">{ui("استخراج ملفات PDF")}</Link><Link href={`/research/guidelines?projectId=${encodeURIComponent(projectId)}`} className="underline">{ui("تعليمات الجامعة")}</Link><Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`} className="underline">{ui("المكتبة")}</Link></div></details></header>
    <nav aria-label={ui("نوع المهمة")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{([['writing', 'الكتابة بالدليل'], ['sources', 'المراجع ومقارنة الدراسات'], ['language', 'ترجمة وتدقيق النص'], ['supervisor', 'ملاحظات المشرف وتعديل النص']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => choose(value)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold leading-6 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white">{ui(label)}</button>)}</nav>
    {error && <p role="alert" className="text-sm text-rose-800">{ui(error)}</p>}
    {!loaded && !error ? <p>{ui("جارٍ استرجاع المشروع…")}</p> : loaded && (mode === 'writing' ? <EvidenceWritingWorkspace key={projectId} projectId={projectId} /> : mode === 'language' ? <LanguageTaskWorkspace key={projectId} embedded /> : mode === 'supervisor' ? <SupervisorReviewWorkspace key={projectId} projectId={projectId} /> : <>
      <section id="task-search" aria-label={ui("البحث")}><ResearchEvidenceSidebar key={projectId} projectId={projectId} initialQuery={query} onSaved={() => setRevision((value) => value + 1)} /></section>
      <SavedLiteraturePicker key={projectId} projectId={projectId} canApprove={false} revision={revision} onSaved={() => setSelectionRevision((value) => value + 1)} />
      <label className="flex items-center gap-3 rounded-xl border bg-white p-4 text-sm"><input type="checkbox" checked={comparison} onChange={(event) => { setComparison(event.target.checked); const url = new URL(window.location.href); url.searchParams.set('task', event.target.checked ? 'compare' : 'sources'); window.history.replaceState({}, '', url); }} />{ui("أريد مقارنة دراستين أو أكثر؛ إن توفر مستخلص واحد يمكنني تلخيصه فقط.")}</label>
      <ResearchAnalysisWorkspace key={`${projectId}:${selectionRevision}`} embedded comparison={comparison} />
    </>)}
  </main></div>;
}
