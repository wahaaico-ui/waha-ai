'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';
import type { ResearchAnalysis } from '@/lib/research-analysis';
import { useProjectId } from '@/lib/use-project-id';

type Paper = { id: string; title: string; authors?: string; year?: number | string; source?: string };
type AnalysisResponse = { success: boolean; analysis: ResearchAnalysis; sources: Paper[]; generatedAt: string; evidenceNote: string; error?: string };

export default function ResearchAnalysisPage() {
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

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        const savedTitle = journey.outputs.title?.title;
        setTitle(typeof savedTitle === 'string' ? savedTitle : '');
        const savedPapers = journey.outputs.literature?.papers;
        setPapers(Array.isArray(savedPapers) ? savedPapers.filter((paper): paper is Paper => Boolean(paper && typeof paper === 'object' && typeof paper.id === 'string' && typeof paper.title === 'string')) : []);
        const savedAnalysis = journey.outputs.analysis;
        if (savedAnalysis && typeof savedAnalysis === 'object' && typeof savedAnalysis.introduction === 'string' && Array.isArray(savedAnalysis.themes)) {
          setAnalysis(savedAnalysis as unknown as ResearchAnalysis);
          setStatus('saved');
        }
        if (typeof savedAnalysis?.evidenceNote === 'string') setEvidenceNote(savedAnalysis.evidenceNote);
        if (typeof savedAnalysis?.generatedAt === 'string') setGeneratedAt(savedAnalysis.generatedAt);
      })
      .catch((reason) => setJourneyError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoadingJourney(false));
  }, [projectId]);

  const paperById = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers]);
  const supportedSourceCount = useMemo(() => analysis ? new Set(analysis.themes.flatMap((theme) => theme.supportingPaperIds)).size : 0, [analysis]);
  const generate = async () => {
    if (!projectId || papers.length < 3) return;
    setStatus('loading'); setError('');
    try {
      const response = await fetch('/api/research/analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
      const data = await response.json() as AnalysisResponse;
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر توليد التخليق.');
      await saveJourneyStage(projectId, 'analysis', { ...data.analysis, sources: data.sources, generatedAt: data.generatedAt, evidenceNote: data.evidenceNote });
      setAnalysis(data.analysis); setEvidenceNote(data.evidenceNote); setGeneratedAt(data.generatedAt); setStatus('saved');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر توليد التخليق.'); setStatus('idle'); }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="analysis" lang="ar" /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">فهم ما تقوله الأدلة معاً</div><h1 className="mt-4 text-3xl font-black">حوّل الدراسات المختارة إلى صورة بحثية مترابطة</h1><p className="mt-3 text-sm leading-7 text-slate-600">نقارن الدراسات السابقة ونربط كل محور بمصادر موجودة فعلاً. هذا تخليق للأدبيات وليس تحليلاً لبياناتك الميدانية، والفجوات تبقى استنتاجات تحتاج مراجعة الباحث.</p></header>
    {loadingJourney ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأدلة المختارة…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">سجّل الدخول للمتابعة من مشروعك</h2><p className="mt-3 text-sm leading-7 text-amber-900">سنحفظ التخليق وروابط مصادره داخل المشروع.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : journeyError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{journeyError}</section>
    : papers.length < 3 || !title ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">أكمل قاعدة الأدلة أولاً</h2><p className="mt-3 text-sm text-amber-900">اختر العنوان وثلاث دراسات قابلة للمراجعة على الأقل حتى تكون المقارنة ذات أساس واضح.</p><Link href={`/research/literature?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">مراجعة قاعدة الأدلة</Link></section>
    : <><details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><summary className="cursor-pointer text-sm font-black text-emerald-950">عرض الدراسات التي سيُبنى عليها التخليق</summary><p className="mt-3 text-sm leading-7 text-emerald-950"><strong>{papers.length} دراسات مختارة</strong> للعنوان: {title}</p><ul className="mt-3 space-y-1 text-xs leading-6 text-emerald-900">{papers.slice(0, 6).map((paper) => <li key={paper.id}>• {paper.title} {paper.year ? `(${paper.year})` : ''}</li>)}</ul>{papers.length > 6 && <p className="mt-2 text-xs text-emerald-700">و{papers.length - 6} دراسات أخرى.</p>}</details>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="mb-4 text-xs leading-6 text-slate-500">لن ينفذ النظام تحليلاً إحصائياً، ولن يضيف نتائج ميدانية. سيحلل فقط ما تسمح به بيانات المصادر المختارة.</p><button type="button" onClick={() => void generate()} disabled={status === 'loading'} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'loading' ? 'جارٍ تخليق الأدلة والتحقق من الإسناد…' : analysis ? 'إعادة توليد التخليق من الأدلة الحالية' : 'ولّد التخليق الأكاديمي'}</button>{error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">{error}</p>}</section>
      {analysis && <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-bold text-blue-700">تخليق آلي مقيد بالأدلة</div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">محفوظ في مشروعك</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-white p-3 text-center"><div className="text-xl font-black text-blue-900">{analysis.themes.length}</div><div className="text-[11px] text-slate-500">محاور مترابطة</div></div><div className="rounded-lg bg-white p-3 text-center"><div className="text-xl font-black text-blue-900">{supportedSourceCount}</div><div className="text-[11px] text-slate-500">مصادر مسندة</div></div><div className="rounded-lg bg-white p-3 text-center"><div className="text-xl font-black text-blue-900">{analysis.researchGapsIdentified.length}</div><div className="text-[11px] text-slate-500">فجوات محتملة للمراجعة</div></div></div><p className="mt-3 text-xs leading-6 text-blue-900">{evidenceNote || 'راجع كل استنتاج بالرجوع إلى المصادر الأصلية قبل استخدامه أكاديمياً.'}</p>{generatedAt && <p className="mt-1 text-[11px] text-blue-700">وقت التوليد: {new Date(generatedAt).toLocaleString('ar')}</p>}</div>
        <div><h2 className="text-lg font-black">التأطير</h2><p className="mt-2 text-sm leading-8 text-slate-700">{analysis.introduction}</p></div><div><h2 className="text-lg font-black">التخليق الموضوعي العام</h2><p className="mt-2 text-sm leading-8 text-slate-700">{analysis.thematicSynthesis}</p></div>
        <div><h2 className="text-lg font-black">المحاور المسندة</h2><div className="mt-3 space-y-4">{analysis.themes.map((theme) => <article key={`${theme.title}-${theme.supportingPaperIds.join('-')}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-black">{theme.title}</h3><p className="mt-2 text-sm leading-8 text-slate-700">{theme.synthesis}</p><div className="mt-3 flex flex-wrap gap-2">{theme.supportingPaperIds.map((id) => <span key={id} title={paperById.get(id)?.title || id} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold text-blue-700">[موثق] {paperById.get(id)?.title?.slice(0, 55) || id}</span>)}</div></article>)}</div></div>
        <div><h2 className="text-lg font-black">الفجوات المستنتجة</h2><ul className="mt-3 space-y-2">{analysis.researchGapsIdentified.map((gap) => <li key={gap} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950"><strong>[استنتاج]</strong> {gap}</li>)}</ul></div><div><h2 className="text-lg font-black">الخلاصة</h2><p className="mt-2 text-sm leading-8 text-slate-700">{analysis.conclusion}</p></div><div><h2 className="text-lg font-black">حدود المخرج</h2><ul className="mt-2 space-y-2 text-sm leading-7 text-slate-600">{analysis.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></div>{status === 'saved' && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">تم حفظ تحليل الأدبيات ونسخته داخل مشروعك.</p>}<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex sm:items-center sm:justify-between"><div><p className="text-sm font-black text-blue-950">هل أنهيت تحليل بياناتك خارج WAHA؟</p><p className="mt-1 text-xs leading-6 text-blue-800">أدخل ملخص النتائج فقط، بلا بيانات خام أو معلومات شخصية.</p></div><Link href={`/research/analysis-input?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:mt-0">إدخال مخرجات التحليل</Link></div></section>}</>}
  </main></div>;
}
