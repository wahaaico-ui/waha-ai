'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { availableAbstract } from '@/lib/research-abstracts';
import { buildSynthesisPacket } from '@/lib/synthesis-packet';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import TaskExportButtons from '@/components/TaskExportButtons';
import SiteHeader from '@/components/SiteHeader';
import { loadJourney, saveJourneyDraft, saveJourneyStage } from '@/lib/research-journey';
import type { ResearchAnalysis } from '@/lib/research-analysis';
import { useProjectId } from '@/lib/use-project-id';
import { loadProjectLibrary } from '@/lib/project-library-client';

type Paper = { id: string; title: string; authors?: string; year?: number | string; source?: string; abstract?: string; referenceId?: string };
type AnalysisResponse = { success: boolean; analysis: ResearchAnalysis; sources: Paper[]; referenceIds?: string[]; generatedAt: string; evidenceNote: string; error?: string };

export default function ResearchAnalysisWorkspace({ embedded = false, comparison = false }: { embedded?: boolean; comparison?: boolean }) {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

  const projectId = useProjectId();
  const [loadingJourney, setLoadingJourney] = useState(() => Boolean(projectId));
  const [journeyError, setJourneyError] = useState('');
  const [title, setTitle] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [analysis, setAnalysis] = useState<ResearchAnalysis | null>(null);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [preliminary, setPreliminary] = useState(false);
  const [pendingContent, setPendingContent] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    const controller = new AbortController();
    loadJourney(projectId)
      .then(async (journey) => {
        if (!active) return;
        const isPreliminary = embedded || new URLSearchParams(window.location.search).get('mode') === 'preliminary';
        setPreliminary(isPreliminary);
        const savedTitle = journey.outputs.title?.title;
        setTitle(typeof savedTitle === 'string' ? savedTitle : '');
        let savedPapers = journey.outputs.literature?.papers;
        if (isPreliminary) {
          const library = await loadProjectLibrary(projectId, { signal: controller.signal });
          if (!active) return;
          const ids = journey.drafts.literature?.content.referenceIds;
          savedPapers = library.filter(item => Array.isArray(ids) && ids.includes(item.id)).map(item => item.literaturePaper);
          if (!savedTitle) {
            const projectResponse = await fetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal: controller.signal });
            const project = await projectResponse.json();
            if (!projectResponse.ok) throw new Error(project.error || 'تعذر تحميل المشروع.');
            if (!active) return;
            setTitle(project.project.title);
          }
        }
        setPapers(Array.isArray(savedPapers) ? savedPapers.filter((paper): paper is Paper => Boolean(paper && typeof paper === 'object' && typeof paper.id === 'string' && typeof paper.title === 'string')).map((paper) => ({ ...paper, abstract: availableAbstract(paper.abstract) })) : []);
        const draft = journey.drafts.analysis?.content;
        const selectionIds = journey.drafts.literature?.content.referenceIds;
        const draftIds = draft?.referenceIds;
        const sameSelection = Array.isArray(selectionIds) && Array.isArray(draftIds) && selectionIds.length === draftIds.length && selectionIds.every((id) => draftIds.includes(id));
        const savedAnalysis = isPreliminary ? (sameSelection ? draft : undefined) : journey.outputs.analysis;
        if (savedAnalysis && typeof savedAnalysis === 'object' && typeof savedAnalysis.introduction === 'string' && Array.isArray(savedAnalysis.themes)) {
          setAnalysis(savedAnalysis as unknown as ResearchAnalysis);
          setStatus('saved');
        }
        if (typeof savedAnalysis?.evidenceNote === 'string') setEvidenceNote(savedAnalysis.evidenceNote);
        if (typeof savedAnalysis?.generatedAt === 'string') setGeneratedAt(savedAnalysis.generatedAt);
      })
      .catch((reason) => { if (active) setJourneyError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'); })
      .finally(() => { if (active) setLoadingJourney(false); });
    return () => { active = false; controller.abort(); };
  }, [projectId, embedded]);

  const paperById = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers]);
  const sourcePacket = useMemo(() => buildSynthesisPacket(papers), [papers]);
  const supportedSourceCount = useMemo(() => analysis ? new Set(analysis.themes.flatMap((theme) => theme.supportingPaperIds)).size : 0, [analysis]);
  const persistContent = async (content: Record<string, unknown>) => {
    if (!projectId) throw new Error("اختر مشروعًا لحفظ المخرج.");
    if (preliminary) {
      const saved = await saveJourneyDraft(projectId, 'analysis', content);
      if (!saved.success) throw new Error("توجد مسودة أحدث؛ راجعها قبل استبدالها. المخرج الحالي لم يُحفظ.");
    } else await saveJourneyStage(projectId, 'analysis', content);
    setPendingContent(null);
    setStatus('saved');
  };
  const retrySave = async () => {
    if (!pendingContent) return;
    setStatus('loading'); setError('');
    try { await persistContent(pendingContent); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر الحفظ.'); setStatus('idle'); }
  };
  const generate = async () => {
    if (!projectId || papers.length < (preliminary ? 1 : 3)) return;
    setStatus('loading'); setError('');
    try {
      const response = await fetch('/api/research/analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, ...(preliminary ? { mode: 'preliminary', comparison } : {}) }) });
      const data = await response.json() as AnalysisResponse;
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر توليد التخليق.');
      const content = { ...data.analysis, sources: data.sources, generatedAt: data.generatedAt, evidenceNote: data.evidenceNote, ...(preliminary ? { preliminary: true, referenceIds: data.referenceIds || [] } : {}) };
      setAnalysis(data.analysis); setEvidenceNote(data.evidenceNote); setGeneratedAt(data.generatedAt);
      setPendingContent(content);
      await persistContent(content);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر توليد التخليق.'); setStatus('idle'); }
  };

  const Content = embedded ? 'section' : 'main';
  return <div dir={uiDirection} className={embedded ? "text-slate-950" : "min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"}>{!embedded && <><SiteHeader /><JourneyProgress current="analysis" lang={uiLanguage} /></>}<Content className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><p className="mb-2 text-sm font-bold text-blue-800">{papers.filter((paper) => paper.abstract?.trim()).length < 2 ? ui("ملخص مستخلص دراسة واحدة؛ ليس مقارنة") : ui("مقارنة المستخلصات المتاحة")}</p><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{ui("فهم ما تقوله الأدلة معاً")}</div><h1 className="mt-4 text-3xl font-black">{ui("حوّل الدراسات المختارة إلى صورة بحثية مترابطة")}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{ui("نُعد مسودة مقارنة من البيانات والمستخلصات المتاحة فقط، دون قراءة النص الكامل. هذا تخليق للأدبيات وليس تحليلاً لبياناتك الميدانية، والفجوات تبقى استنتاجات تحتاج مراجعة الباحث.")}</p></header>
    {loadingJourney ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تحميل الأدلة المختارة…")}</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("سجّل الدخول للمتابعة من مشروعك")}</h2><p className="mt-3 text-sm leading-7 text-amber-900">{ui("سنحفظ التخليق وروابط مصادره داخل المشروع.")}</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("تسجيل الدخول")}</Link></section>
    : journeyError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{ui(journeyError)}</section>
    : papers.length < (preliminary ? 1 : 3) || !title ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">{ui("اختر مستخلصًا للبدء")}</h2><p className="mt-3 text-sm text-amber-900">{ui("احفظ اختيار المصادر. التلخيص يحتاج مستخلصًا واحدًا والمقارنة مستخلصين على الأقل؛ الاعتماد الرسمي يبقى منفصلاً.")}</p><Link href={embedded ? '#task-search' : `/research/literature?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">{embedded ? ui("البحث واختيار المصادر في هذه المساحة") : ui("مراجعة قاعدة الأدلة")}</Link></section>
: <><details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><summary className="cursor-pointer text-sm font-black text-emerald-950">{ui("عرض الدراسات والمستخلصات المستخدمة")}</summary><p className="mt-3 text-sm leading-7 text-emerald-950"><strong>{papers.length} {ui("دراسات مختارة")}</strong> {ui("للعنوان:")}{' '}{title}</p><ul className="mt-3 space-y-3 text-xs leading-6 text-emerald-900">{papers.map((paper) => <li id={`source-${encodeURIComponent(paper.id)}`} key={paper.id}>• {paper.title} {paper.year ? `(${paper.year})` : ''} — {paper.abstract?.trim() ? ui("المستخلص متاح للاستخدام") : ui("مستبعد من التوليد: مستخلص غير متاح")}{paper.abstract && sourcePacket.ok && <p dir="auto" className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white p-3">{paper.abstract.slice(0, sourcePacket.ok ? sourcePacket.abstractCharacterLimit : 0)}</p>}</li>)}</ul><p className="mt-2 text-xs text-emerald-700">{sourcePacket.ok ? ui("تدخل كل الدراسات ذات المستخلص المتاح؛ حتى {0} حرفًا لكل مستخلص ضمن ميزانية السياق. لا تُقرأ النصوص الكاملة.", [sourcePacket.abstractCharacterLimit]) : sourcePacket.error}</p></details>
      {pendingContent && <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>{ui("المخرج ظاهر لكنه لم يُحفظ. لا تغادر الصفحة؛ أعد محاولة الحفظ دون توليد جديد. التصدير متاح بعد الحفظ.")}</p><button type="button" disabled={status === 'loading'} onClick={() => void retrySave()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-40">{ui("إعادة محاولة حفظ المخرج")}</button></section>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="mb-4 text-xs leading-6 text-slate-500">{ui("لن ينفذ النظام تحليلاً إحصائياً، ولن يضيف نتائج ميدانية. سيحلل فقط ما تسمح به بيانات المصادر المختارة.")}</p><button type="button" onClick={() => void generate()} disabled={status === 'loading' || Boolean(pendingContent)} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'loading' ? ui("جارٍ تخليق المستخلصات وتنظيم الإحالات…") : analysis ? ui("إعادة توليد التخليق من الأدلة الحالية") : ui("ولّد التخليق الأكاديمي")}</button>{error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{ui(error)}</p>}</section>
      {analysis && preliminary && !pendingContent && <TaskExportButtons projectId={projectId} task="analysis" />}{analysis && <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-bold text-blue-700">{ui("مسودة من المستخلصات المتاحة")}</div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{pendingContent ? ui("غير محفوظ بعد") : ui("محفوظ في مشروعك")}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-white p-3 text-center"><div className="text-xl font-black text-blue-900">{analysis.themes.length}</div><div className="text-[11px] text-slate-500">{ui("محاور مترابطة")}</div></div><div className="rounded-lg bg-white p-3 text-center"><div className="text-xl font-black text-blue-900">{supportedSourceCount}</div><div className="text-[11px] text-slate-500">{ui("دراسات محال إليها")}</div></div><div className="rounded-lg bg-white p-3 text-center"><div className="text-xl font-black text-blue-900">{analysis.researchGapsIdentified.length}</div><div className="text-[11px] text-slate-500">{ui("فجوات محتملة للمراجعة")}</div></div></div><p className="mt-3 text-xs leading-6 text-blue-900">{evidenceNote || ui("راجع كل استنتاج بالرجوع إلى المصادر الأصلية قبل استخدامه أكاديمياً.")}</p>{generatedAt && <p className="mt-1 text-[11px] text-blue-700">{ui("وقت التوليد:")}{' '}{new Date(generatedAt).toLocaleString(uiLanguage)}</p>}</div>
        <div><h2 className="text-lg font-black">{ui("التأطير")}</h2><p className="mt-2 text-sm leading-8 text-slate-700">{analysis.introduction}</p></div><div><h2 className="text-lg font-black">{ui("التخليق الموضوعي العام")}</h2><p className="mt-2 text-sm leading-8 text-slate-700">{analysis.thematicSynthesis}</p></div>
        <div><h2 className="text-lg font-black">{ui("المحاور وإحالاتها")}</h2><div className="mt-3 space-y-4">{analysis.themes.map((theme) => <article key={`${theme.title}-${theme.supportingPaperIds.join('-')}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-black">{theme.title}</h3><p className="mt-2 text-sm leading-8 text-slate-700">{theme.synthesis}</p><div className="mt-3 flex flex-wrap gap-2">{theme.supportingPaperIds.map((id) => <a href={`#source-${encodeURIComponent(id)}`} key={id} title={paperById.get(id)?.title || id} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold text-blue-700">{ui("[إحالة]")}{' '}{paperById.get(id)?.title?.slice(0, 55) || id}</a>)}</div></article>)}</div></div>
        <div><h2 className="text-lg font-black">{ui("الفجوات المحتملة للمراجعة")}</h2>{!analysis.researchGapsIdentified.length && <p className="mt-2 text-sm">{ui("لا تكفي المصادر لتحديد فجوة.")}</p>}<ul className="mt-3 space-y-2">{analysis.researchGapsIdentified.map((gap) => <li key={gap} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950"><strong>{ui("[استنتاج]")}</strong> {gap}</li>)}</ul></div><div><h2 className="text-lg font-black">{ui("الخلاصة")}</h2><p className="mt-2 text-sm leading-8 text-slate-700">{analysis.conclusion}</p></div><div><h2 className="text-lg font-black">{ui("حدود المخرج")}</h2><ul className="mt-2 space-y-2 text-sm leading-7 text-slate-600">{analysis.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></div>{status === 'saved' && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{ui("حُفظت المسودة داخل مشروعك؛ الحفظ ليس اعتمادًا لصحة الاستنتاجات.")}</p>}<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex sm:items-center sm:justify-between"><div><p className="text-sm font-black text-blue-950">{preliminary ? ui("الخطوة التالية: راجع المصادر والتصميم البحثي") : ui("هل أنهيت تحليل بياناتك خارج WAHA؟")}</p><p className="mt-1 text-xs leading-6 text-blue-800">{preliminary ? ui("هذه مسودة أولية لا تعتمد مرحلة الأدبيات الرسمية.") : ui("أدخل ملخص النتائج فقط، بلا بيانات خام أو معلومات شخصية.")}</p></div><Link href={`${preliminary ? '/research/literature' : '/research/analysis-input'}?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:mt-0">{preliminary ? ui("مراجعة اختيار الأدبيات") : ui("إدخال مخرجات التحليل")}</Link></div></section>}</>}
  </Content></div>;
}
