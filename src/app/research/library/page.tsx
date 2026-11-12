'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { academicRecordLabel, similarReferenceTitles } from '@/lib/academic-record-labels';
import { BookOpen, Copy, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { CITATION_STYLES, type CitationStyle } from '@/lib/citations/types';
import { useProjectId } from '@/lib/use-project-id';
import EvidenceForm from '@/components/research-intelligence/EvidenceForm';
import SourceStatus from '@/components/research-intelligence/SourceStatus';
import { loadProjectLibrary, type ProjectLibraryItem } from '@/lib/project-library-client';
import { useLibraryBibliography } from '@/lib/use-library-bibliography';

// origin and canonicalLinked are set by the server from stored data (src/app/api/research/library/route.ts).
type LibrarySnapshot = { requestKey: string; items: ProjectLibraryItem[]; error: string };
const EMPTY: ProjectLibraryItem[] = [];
const DISPLAY_BATCH = 50;
const STYLE_LABELS: Record<CitationStyle, string> = { 'apa-7': 'APA 7', ieee: 'IEEE', harvard: 'Harvard', vancouver: 'Vancouver', chicago: 'Chicago', mla: 'MLA', heritage: 'التوثيق التراثي (حواشٍ)' };

export default function ResearchLibraryPage() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const projectId = useProjectId();
  const [snapshot, setSnapshot] = useState<LibrarySnapshot | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [style, setStyle] = useState<CitationStyle>('apa-7');
  const [evidenceFor, setEvidenceFor] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<{ key: string; loaded: number; total: number } | null>(null);
  const [sourceWindow, setSourceWindow] = useState({ key: '', count: DISPLAY_BATCH });
  const [bibliographyWindow, setBibliographyWindow] = useState({ key: '', count: DISPLAY_BATCH });
  const requestKey = `${projectId}:${refresh}`;
  // useProjectId resolves after hydration. A new project/retry is pending until
  // its own request finishes; an initial [] must never imply an empty library.
  const current = snapshot?.requestKey === requestKey ? snapshot : null;
  const loading = Boolean(projectId) && !current;
  const items = current?.items || EMPTY;
  const error = current?.error || '';
  const formatting = useLibraryBibliography(current && !error ? items : null, style, requestKey);
  const similarTitles = useMemo(() => similarReferenceTitles(items), [items]);
  const visibleSources = sourceWindow.key === requestKey ? sourceWindow.count : DISPLAY_BATCH;
  const bibliographyKey = `${requestKey}:${style}`;
  const visibleBibliography = bibliographyWindow.key === bibliographyKey ? bibliographyWindow.count : DISPLAY_BATCH;

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const loaded = await loadProjectLibrary(projectId, { signal: controller.signal, onProgress: (count, total) => {
          if (active) setProgress({ key: requestKey, loaded: count, total });
        } });
        if (active) setSnapshot({ requestKey, items: loaded, error: '' });
      } catch (reason) {
        if (active) setSnapshot({ requestKey, items: [], error: reason instanceof Error ? reason.message : 'تعذر تحميل المكتبة. أعد المحاولة.' });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [projectId, requestKey]);

  const remove = async (referenceId: string) => {
    try {
      const response = await fetch(`/api/research/library?projectId=${encodeURIComponent(projectId)}&referenceId=${encodeURIComponent(referenceId)}`, { method: 'DELETE' });
      if (response.ok) { setRefresh((value) => value + 1); setNotice("حُذف المرجع من مكتبة المشروع."); }
      else setNotice(response.status === 409 ? 'هذا المصدر مستخدم في أدلة المشروع. احذف تلك الأدلة أولاً من مساحة تحليل الأدلة.' : 'تعذر حذف المرجع. أعد المحاولة.');
    } catch { setNotice("تعذر الاتصال لحذف المرجع. أعد المحاولة."); }
  };

  const bibliography = formatting.entries;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice('نُسخ النص إلى الحافظة.'); }
    catch { setNotice('تعذر النسخ. اسمح بالوصول إلى الحافظة ثم أعد المحاولة.'); }
  };
  return <div dir={uiDirection} className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-950"><SiteHeader /><main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center gap-2 text-blue-700"><BookOpen className="h-5 w-5" /><span className="text-xs font-bold">{ui("مكتبة المشروع")}</span></div><h1 className="mt-4 text-3xl font-black">{ui("مصادرك وقائمة مراجعك في مكان واحد")}</h1><p className="mt-3 text-sm leading-7 text-slate-600">{ui("راجع بيانات المراجع وروابطها الأصلية. اختر نمط التوثيق لعرض القائمة، ثم استخدم المصادر المحفوظة في الكتابة أو مقارنة الدراسات.")}</p>{projectId && <div className="mt-4 flex flex-wrap gap-3"><Link href={`/research/tasks?projectId=${encodeURIComponent(projectId)}&task=writing`} className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">{ui("اكتب بمراجعك")}</Link><Link href={`/research/tasks?projectId=${encodeURIComponent(projectId)}&task=compare`} className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">{ui("قارن الدراسات المحفوظة")}</Link></div>}</header>
    {notice && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{ui(notice)}</p>}
    {!projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="font-black text-amber-950">{ui("افتح المكتبة من مشروع محفوظ")}</h2><Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("الذهاب إلى مشاريعي")}</Link></section>
    : loading ? <section role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{ui("جارٍ تحميل مكتبة المشروع…")}{progress?.key === requestKey && <p className="mt-2">{ui("تم تحميل {0} من {1} مرجعًا", [progress.loaded, progress.total])}</p>}</section>
    : error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><p>{ui(error)}</p><button type="button" onClick={() => setRefresh((value) => value + 1)} className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{ui("إعادة تحميل المكتبة")}</button></section>
    : <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]"><section className="min-w-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/research/tasks?projectId=${encodeURIComponent(projectId)}&task=compare`} className="text-sm font-bold text-blue-700 underline">{ui("اختر مراجع للمقارنة")}</Link><h2 className="text-lg font-black">{ui("المصادر المحفوظة ({0})", [items.length])}</h2></div>{similarTitles > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">{ui("توجد عناوين متشابهة في مكتبتك. راجع الإصدارات قبل احتسابها كدراسات مستقلة؛ لم يُحذف أي مرجع.")}</p>}{items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-7 text-slate-500">{ui("لم تحفظ مصدرًا بعد. ابحث عن مرجع واحفظه في")} {' '}<Link href={`/research/sources?projectId=${encodeURIComponent(projectId)}`} className="font-bold text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-600">{ui("البحث والمصادر")}</Link></div> : items.slice(0, visibleSources).map((item) => <article id={`reference-${item.id}`} key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><SourceStatus origin={item.origin} canonicalLinked={item.canonicalLinked} />{item.type && <p className="mt-2 text-xs text-slate-500">{ui("نوع السجل:")} {ui(academicRecordLabel(item.type))}</p>}<h3 className="mt-3 font-black leading-7">{item.title}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{item.authors.join(ui("،")) || ui("مؤلف غير متاح")}{item.year ? ` · ${item.year}` : ''}</p>{item.doi && <p className="mt-1 break-all text-[11px] text-slate-500">DOI: {item.doi}</p>}</div><button type="button" onClick={() => void remove(item.id)} aria-label={ui("حذف {0}", [item.title])} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button></div>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">{ui("فتح السجل أو النص المتاح")}<ExternalLink className="h-3.5 w-3.5" /></a>}<div className="mt-3 border-t border-slate-100 pt-3">{evidenceFor === item.id ? <EvidenceForm projectId={projectId} sources={items} fixedSourceId={item.id} onCreated={() => { setEvidenceFor(''); setNotice("حُفظ الدليل. تابعه وربطه بالادعاءات من مساحة تحليل الأدلة."); }} onCancel={() => setEvidenceFor('')} /> : <button type="button" onClick={() => setEvidenceFor(item.id)} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{ui("استخدام كدليل")}</button>}</div></article>)}{items.length > visibleSources && <button type="button" onClick={() => setSourceWindow({ key: requestKey, count: visibleSources + DISPLAY_BATCH })} className="w-full rounded-xl border border-blue-200 bg-white p-3 text-sm font-bold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{ui("عرض المزيد من المصادر ({0} من {1})", [Math.min(visibleSources, items.length), items.length])}</button>}</section><aside className="h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24"><div className="flex items-center justify-between gap-3"><h2 className="font-black">{ui("قائمة المراجع")}</h2><select aria-label={ui("نمط قائمة المراجع")} value={style} onChange={(event) => setStyle(event.target.value as CitationStyle)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-xs">{CITATION_STYLES.map((value) => <option key={value} value={value}>{ui(STYLE_LABELS[value])}</option>)}</select></div><p className="mt-2 text-xs leading-6 text-slate-500">{ui("تُبنى من البيانات المحفوظة. السجلات الناقصة تبقى معلّمة للمراجعة ولا تُستكمل باختلاق معلومات.")}</p><div className="mt-4 space-y-3" aria-busy={formatting.loading}>{formatting.loading && <p role="status" className="text-sm leading-7 text-slate-600">{ui("جارٍ تنسيق قائمة المراجع. يمكنك متابعة تصفح مصادرك.")}</p>}{formatting.error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm leading-7 text-rose-800"><p>{ui("تعذر إعداد قائمة المراجع. مصادرك محفوظة ويمكنك إعادة المحاولة.")}</p><button type="button" onClick={formatting.retry} className="mt-2 min-h-11 rounded-lg border border-rose-200 px-3 py-2 font-bold">{ui("إعادة إعداد القائمة")}</button></div>}{bibliography.slice(0, visibleBibliography).map((entry) => <button key={entry.itemId} type="button" onClick={() => void copy(entry.text)} className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 text-start text-xs leading-6 text-slate-700 hover:border-blue-300"><span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">{entry.text}</span><Copy className="h-4 w-4 shrink-0 text-blue-600" /></button>)}</div>{bibliography.length > visibleBibliography && <button type="button" onClick={() => setBibliographyWindow({ key: bibliographyKey, count: visibleBibliography + DISPLAY_BATCH })} className="mt-4 w-full rounded-xl border border-blue-200 px-4 py-3 text-sm font-bold text-blue-700">{ui("عرض المزيد من القائمة ({0} من {1})", [Math.min(visibleBibliography, bibliography.length), bibliography.length])}</button>}{bibliography.length > 0 && <button type="button" onClick={() => void copy(bibliography.map((entry) => entry.text).join('\n\n'))} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">{ui("نسخ القائمة كاملة")}</button>}</aside></div>}
  </main></div>;
}
