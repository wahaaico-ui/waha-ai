'use client';

import { BookMarked, Check, Copy, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { CITATION_STYLES, type CitationItem, type CitationStyle, type StructuredCitation } from '@/lib/citations';
import InlineCitation from '@/components/InlineCitation';

type SearchPaper = { resultId: string; id: string; title: string; authorsLabel: string; year: number | string; abstract: string; citationCount: number; pdfUrl?: string | null; relevanceScore: number; item: CitationItem };
const STYLE_LABELS: Record<CitationStyle, string> = { 'apa-7': 'APA 7', ieee: 'IEEE', harvard: 'Harvard', vancouver: 'Vancouver', chicago: 'Chicago', mla: 'MLA' };

export default function ResearchEvidenceSidebar({ projectId, initialQuery = '' }: { projectId: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [style, setStyle] = useState<CitationStyle>('apa-7');
  const [papers, setPapers] = useState<SearchPaper[]>([]);
  const [citation, setCitation] = useState<StructuredCitation | null>(null);
  const [citationItem, setCitationItem] = useState<CitationItem | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const search = async () => {
    if (query.trim().length < 3) return;
    setStatus('searching'); setMessage(''); setCitation(null);
    try {
      const response = await fetch('/api/academic/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), projectId }) });
      const data = await response.json() as { success?: boolean; data?: SearchPaper[]; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر البحث عن أدلة.');
      setPapers((data.data || []).slice(0, 8));
      setMessage(data.data?.length ? 'راجع النتائج ثم احفظ المصدر أو أنشئ استشهاداً.' : 'لم نجد نتيجة كافية بهذه الصياغة. جرّب مفهوماً أدق أو مرادفاً آخر.');
      setStatus('idle');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'تعذر البحث عن أدلة.'); }
  };

  // Saving and citing send the server-issued resultId; the server supplies the
  // source metadata, so the displayed copy cannot redefine it.
  const save = async (paper: SearchPaper) => {
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch('/api/research/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, resultId: paper.resultId }) });
      const data = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'تعذر حفظ المصدر.');
      setMessage('حُفظ المصدر في مكتبة هذا المشروع.'); setStatus('idle');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'تعذر حفظ المصدر.'); }
  };

  const cite = async (paper: SearchPaper) => {
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch('/api/research/citations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, resultId: paper.resultId, style, context: query.trim() }) });
      const data = await response.json() as { success?: boolean; citation?: StructuredCitation; item?: CitationItem; error?: string; warning?: string | null };
      if (!response.ok || !data.success || !data.citation) throw new Error(data.error || 'تعذر إنشاء الاستشهاد.');
      setCitation(data.citation); setCitationItem(data.item || null); setMessage(data.warning || 'أُنشئ الاستشهاد من بيانات المصدر. راجع الحقول قبل التسليم النهائي.'); setStatus('idle');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'تعذر إنشاء الاستشهاد.'); }
  };

  return <aside dir="rtl" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="مساعد الأدلة والاستشهادات">
    <div className="flex items-center gap-2"><Search className="h-5 w-5 text-blue-600" /><h2 className="font-black text-slate-950">ابحث عن مصدر لهذه الفكرة</h2></div>
    <p className="mt-2 text-xs leading-6 text-slate-600">اكتب جملة أو ادعاءً تريد إسناده. ستظهر سجلات أكاديمية فعلية مع حالة التحقق والبيانات المتاحة.</p>
    <textarea value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} rows={3} placeholder="مثال: يؤثر التعلم المدمج في دافعية طلبة الدراسات العليا" className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm leading-7 outline-none focus:border-blue-500" />
    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><select aria-label="نمط الاستشهاد" value={style} onChange={(event) => setStyle(event.target.value as CitationStyle)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">{CITATION_STYLES.map((value) => <option key={value} value={value}>{STYLE_LABELS[value]}</option>)}</select><button type="button" onClick={() => void search()} disabled={status === 'searching' || query.trim().length < 3} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{status === 'searching' ? 'جارٍ البحث والتحقق…' : 'البحث عن أدلة'}</button></div>
    {message && <p role={status === 'error' ? 'alert' : undefined} className={`mt-3 rounded-xl p-3 text-xs leading-6 ${status === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-900'}`}>{message}</p>}
    {citation && <div className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-xs font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" />استشهاد منسّق من بيانات المصدر · لم يُراجع بعد</div><div className="rounded-lg bg-white p-3 text-sm text-slate-900"><span className="me-2 text-xs text-slate-500">استشهاد تفاعلي:</span><InlineCitation citation={citation} item={citationItem || undefined} /></div><button type="button" onClick={() => void navigator.clipboard.writeText(citation.bibliography)} className="flex w-full items-start justify-between gap-3 rounded-lg bg-white p-3 text-start text-xs leading-6 text-slate-700"><span>{citation.bibliography}</span><Copy className="h-4 w-4 shrink-0 text-blue-600" /></button></div>}
    {papers.length > 0 && <div className="mt-5 space-y-3">{papers.map((paper) => <article key={paper.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-blue-50 px-2 py-1 font-bold text-blue-700">سجل اكتُشف عبر الواحة · لم يُراجع بعد</span><span className="text-slate-500">صلة {paper.relevanceScore}% · {paper.citationCount} استشهاد</span></div><h3 className="mt-2 text-sm font-black leading-6 text-slate-900">{paper.title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-500">{paper.authorsLabel} · {paper.year}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void save(paper)} disabled={status === 'saving'} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40"><BookMarked className="h-3.5 w-3.5" />حفظ في المكتبة</button><button type="button" onClick={() => void cite(paper)} disabled={status === 'saving'} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Check className="h-3.5 w-3.5" />إنشاء استشهاد</button>{paper.pdfUrl && <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">فتح المصدر ↗</a>}</div></article>)}</div>}
  </aside>;
}
