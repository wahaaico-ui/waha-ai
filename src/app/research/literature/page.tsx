'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import type { CitationItem } from '@/lib/citations';

type Paper = { id: string; title: string; authors: string; year: number | string; citationCount: number; abstract: string; source: string; pdfUrl?: string | null; relevanceScore?: number; item?: CitationItem };
type SearchCoverage = { candidateResults: number; relevantResults: number; excludedByRelevance: number; searchedAt: string; sources: Array<{ name: string; available: boolean; returned: number }>; note: string };
type LiteratureResponse = { success: boolean; query: string; data: Paper[]; searchCoverage: SearchCoverage; error?: string };

export default function ResearchLiteraturePage() {
  const [projectId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('projectId') || '');
  const [loadingJourney, setLoadingJourney] = useState(() => Boolean(projectId));
  const [journeyError, setJourneyError] = useState('');
  const [title, setTitle] = useState('');
  const [methodReady, setMethodReady] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<SearchCoverage | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        const savedTitle = journey.outputs.title?.title;
        setTitle(typeof savedTitle === 'string' ? savedTitle : '');
        setMethodReady(stageComplete('methodology', journey.outputs.methodology));
        const savedPapers = journey.outputs.literature?.papers;
        if (Array.isArray(savedPapers)) {
          const validPapers = savedPapers.filter((paper): paper is Paper => Boolean(paper && typeof paper === 'object' && typeof paper.id === 'string' && typeof paper.title === 'string'));
          setPapers(validPapers); setSelected(validPapers.map((paper) => paper.id));
        }
      })
      .catch((reason) => setJourneyError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoadingJourney(false));
  }, [projectId]);

  const search = async () => {
    if (!projectId) return;
    setSearching(true); setError(''); setStatus('idle');
    try {
      const response = await fetch('/api/research/literature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
      const data = await response.json() as LiteratureResponse;
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر البحث في المصادر.');
      setTitle(data.query); setCoverage(data.searchCoverage);
      setPapers((current) => {
        const merged = new Map(current.map((paper) => [paper.id, paper]));
        data.data.forEach((paper) => merged.set(paper.id, paper));
        return Array.from(merged.values());
      });
      if (data.data.length < 3) setError('النتائج ذات الصلة أقل من ثلاث دراسات في هذا الفحص. لا يمكن فتح التحليل قبل توسيع البحث أو تعديل العنوان بطريقة علمية.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر البحث في المصادر.'); }
    finally { setSearching(false); }
  };

  const toggle = (id: string) => { setSelected((current) => current.includes(id) ? current.filter((paperId) => paperId !== id) : [...current, id]); setStatus('idle'); };
  const save = async () => {
    if (!projectId || selected.length < 3) return;
    const chosen = papers.filter((paper) => selected.includes(paper.id));
    if (chosen.length < 3) return;
    setStatus('saving'); setError('');
    try {
      await saveJourneyStage(projectId, 'literature', { papers: chosen, query: title, searchCoverage: coverage });
      await Promise.allSettled(chosen.filter((paper) => paper.item).map((paper) => fetch('/api/research/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, item: paper.item }) })));
      setStatus('saved');
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ الأدلة.'); setStatus('idle'); }
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="literature" lang="ar" /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 7 · الأدلة والأدبيات</div><h1 className="mt-4 text-3xl font-black">ابحث، راجع، ثم اختر الأدلة</h1><p className="mt-3 text-sm leading-7 text-slate-600">يفحص النظام العنوان والسياق البحثي في فهارس أكاديمية موثوقة، ثم يعرض الدراسات الأقرب للمراجعة والاختيار.</p></header>
    {loadingJourney ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل العنوان والمنهجية…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">هذه المرحلة تحتاج مشروعاً محفوظاً</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></section>
    : journeyError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{journeyError}</section>
    : !title || !methodReady ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة الأدبيات مغلقة</h2><p className="mt-3 text-sm text-amber-900">اعتمد العنوان والمنهجية داخل المشروع أولاً.</p><Link href={`/research/methodology?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى المنهجية</Link></section>
    : <><section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">نطاق المراجعة الحالي</div><p className="mt-2 break-words text-sm leading-7 text-emerald-950 [overflow-wrap:anywhere]"><strong>العنوان:</strong> {title}</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><button type="button" onClick={() => void search()} disabled={searching} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-50">{searching ? 'جارٍ البحث والترشيح…' : 'ابحث في الأدبيات المرتبطة بالعنوان'}</button>{error && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">{error}</p>}</section>
      {coverage && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-4 text-center"><div className="text-2xl font-black text-blue-700">{coverage.candidateResults}</div><div className="text-xs text-slate-600">سجل جرى فحصه</div></div><div className="rounded-xl bg-white p-4 text-center"><div className="text-2xl font-black text-emerald-700">{coverage.relevantResults}</div><div className="text-xs text-slate-600">دراسة أقرب إلى نطاقك</div></div></div><p className="mt-3 text-xs leading-6 text-blue-900">{coverage.note}</p>{coverage.relevantResults < 3 && <div className="mt-4 flex flex-wrap gap-3"><Link href={`/research?projectId=${encodeURIComponent(projectId)}`} className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-xs font-bold text-blue-800">مراجعة العنوان</Link><button type="button" onClick={() => void search()} disabled={searching} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">إعادة محاولة البحث</button></div>}</section>}
      {papers.length > 0 && <section className="space-y-3">{papers.map((paper) => <article key={paper.id} className={`rounded-2xl border bg-white p-5 shadow-sm transition ${selected.includes(paper.id) ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}><div className="flex items-start gap-3"><input aria-label={`اختيار ${paper.title}`} type="checkbox" checked={selected.includes(paper.id)} onChange={() => toggle(paper.id)} className="mt-1 h-5 w-5 accent-blue-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paper.item?.verificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' : paper.item?.verificationStatus === 'unverified' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{paper.item?.verificationStatus === 'verified' ? 'تحقق متعدد' : paper.item?.verificationStatus === 'cross-checked' ? 'متطابق بين فهرسين' : paper.item?.verificationStatus === 'partially-verified' ? 'تحقق جزئي' : 'يحتاج مراجعة'}</span>{typeof paper.relevanceScore === 'number' && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">صلة تقريبية {paper.relevanceScore}%</span>}</div><h2 className="mt-3 break-words text-base font-black leading-7 [overflow-wrap:anywhere]">{paper.title}</h2><p className="mt-1 break-words text-xs leading-6 text-slate-500 [overflow-wrap:anywhere]">{paper.authors} · {paper.year} · {paper.citationCount} استشهاد مسجل</p>{paper.abstract ? <p className="mt-3 line-clamp-4 break-words text-sm leading-7 text-slate-600 [overflow-wrap:anywhere]">{paper.abstract}</p> : <p className="mt-3 text-xs text-slate-400">المستخلص غير متاح في بيانات المصدر.</p>}{paper.pdfUrl && <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs font-bold text-blue-700 hover:underline">فتح صفحة الدراسة أو النسخة المتاحة ↗</a>}</div></div></article>)}</section>}
      {papers.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="mb-3 text-sm leading-7 text-slate-600">اختر ثلاث دراسات على الأقل بعد مراجعة حالة التحقق والملخص. الاختيار مسؤولية بحثية؛ العدد والاستشهادات مؤشرات وليست بديلاً عن قراءة الدراسة.</p><button type="button" disabled={selected.length < 3 || status === 'saving'} onClick={() => void save()} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === 'saving' ? 'جارٍ حفظ الأدلة في المشروع والمكتبة…' : `اعتماد الدراسات المختارة (${selected.length})`}</button>{status === 'saved' && <div className="mt-3 grid gap-2 sm:grid-cols-2"><Link href={`/research/analysis?projectId=${encodeURIComponent(projectId)}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-bold text-emerald-800">انتقل إلى التخليق الأكاديمي ←</Link><Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`} className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-sm font-bold text-blue-800">عرض مكتبة المشروع</Link></div>}</section>}</>}
  </main></div>;
}
