'use client';

import { BookOpen, Copy, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { CITATION_STYLES, type CitationItem, type CitationStyle } from '@/lib/citations';

type BibliographyEntry = { itemId: string; number: number; text: string };
const STYLE_LABELS: Record<CitationStyle, string> = { 'apa-7': 'APA 7', ieee: 'IEEE', harvard: 'Harvard', vancouver: 'Vancouver', chicago: 'Chicago', mla: 'MLA' };

export default function ResearchLibraryPage() {
  const [projectId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('projectId') || '');
  const [items, setItems] = useState<CitationItem[]>([]);
  const [bibliographies, setBibliographies] = useState<Record<CitationStyle, BibliographyEntry[]>>({ 'apa-7': [], ieee: [], harvard: [], vancouver: [], chicago: [], mla: [] });
  const [style, setStyle] = useState<CitationStyle>('apa-7');
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');

  const load = async () => {
    if (!projectId) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/research/library?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
      const data = await response.json() as { success?: boolean; items?: CitationItem[]; bibliographies?: Record<CitationStyle, BibliographyEntry[]>; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر تحميل المكتبة.');
      setItems(data.items || []); if (data.bibliographies) setBibliographies(data.bibliographies);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تحميل المكتبة.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void fetch(`/api/research/library?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { success?: boolean; items?: CitationItem[]; bibliographies?: Record<CitationStyle, BibliographyEntry[]>; error?: string };
        if (!response.ok || !data.success) throw new Error(data.error || 'تعذر تحميل المكتبة.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []); if (data.bibliographies) setBibliographies(data.bibliographies); setLoading(false);
      })
      .catch((reason) => { if (!cancelled) { setError(reason instanceof Error ? reason.message : 'تعذر تحميل المكتبة.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [projectId]);

  const remove = async (referenceId: string) => {
    const response = await fetch(`/api/research/library?projectId=${encodeURIComponent(projectId)}&referenceId=${encodeURIComponent(referenceId)}`, { method: 'DELETE' });
    if (response.ok) await load(); else setError('تعذر حذف المرجع.');
  };

  const bibliography = bibliographies[style] || [];
  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950"><SiteHeader /><JourneyProgress current="analysis" lang="ar" /><main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-2 text-blue-700"><BookOpen className="h-5 w-5" /><span className="text-xs font-bold">مكتبة المشروع</span></div><h1 className="mt-4 text-3xl font-black">مصادرك وقائمة مراجعك في مكان واحد</h1><p className="mt-3 text-sm leading-7 text-slate-600">المكتبة منفصلة لكل مشروع ولكل مستخدم. غيّر نمط التوثيق وستُعاد صياغة القائمة وترقيم الأنماط الرقمية تلقائياً.</p></header>
    {!projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="font-black text-amber-950">افتح المكتبة من مشروع محفوظ</h2><Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">الذهاب إلى مشاريعي</Link></section>
    : loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل مكتبة المشروع…</section>
    : error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
    : <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]"><section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-black">المصادر المحفوظة ({items.length})</h2></div>{items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-7 text-slate-500">لم تحفظ مصدراً بعد. استخدم مرحلة الأدبيات أو «ابحث عن مصدر لهذه الفكرة» داخل المساعدة الكتابية.</div> : items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.verificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-700' : item.verificationStatus === 'unverified' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{item.verificationStatus} · {item.confidenceScore}%</span><h3 className="mt-3 font-black leading-7">{item.title}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{item.authors.join('، ') || 'مؤلف غير متاح'}{item.year ? ` · ${item.year}` : ''}</p>{item.doi && <p className="mt-1 break-all text-[11px] text-slate-500">DOI: {item.doi}</p>}</div><button type="button" onClick={() => void remove(item.id)} aria-label={`حذف ${item.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button></div>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">فتح السجل أو النص المتاح <ExternalLink className="h-3.5 w-3.5" /></a>}</article>)}</section><aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24"><div className="flex items-center justify-between gap-3"><h2 className="font-black">قائمة المراجع</h2><select aria-label="نمط قائمة المراجع" value={style} onChange={(event) => setStyle(event.target.value as CitationStyle)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs">{CITATION_STYLES.map((value) => <option key={value} value={value}>{STYLE_LABELS[value]}</option>)}</select></div><p className="mt-2 text-xs leading-6 text-slate-500">تُبنى من البيانات المحفوظة. السجلات الناقصة تبقى معلّمة للمراجعة ولا تُستكمل باختلاق معلومات.</p><div className="mt-4 space-y-3">{bibliography.map((entry) => <button key={entry.itemId} type="button" onClick={() => void navigator.clipboard.writeText(entry.text)} className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-start text-xs leading-6 text-slate-700 hover:border-blue-300"><span>{entry.text}</span><Copy className="h-4 w-4 shrink-0 text-blue-600" /></button>)}</div>{bibliography.length > 0 && <button type="button" onClick={() => void navigator.clipboard.writeText(bibliography.map((entry) => entry.text).join('\n\n'))} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">نسخ القائمة كاملة</button>}</aside></div>}
  </main></div>;
}
