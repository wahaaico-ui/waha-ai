'use client';

import { Copy, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import type { CitationItem, StructuredCitation } from '@/lib/citations';
import { discoveryRecordLabel } from '@/lib/research-intelligence-ui';

export default function InlineCitation({ citation, item }: { citation: StructuredCitation; item?: CitationItem }) {
  const [open, setOpen] = useState(false);
  return <span className="relative inline-flex">
    <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100" aria-expanded={open}>{citation.inText}</button>
    {open && <span role="dialog" aria-label="تفاصيل الاستشهاد" className="absolute bottom-full right-0 z-30 mb-2 block w-80 max-w-[85vw] rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-xl"><span className="flex items-start justify-between gap-3"><strong className="text-xs text-slate-900">تفاصيل الاستشهاد</strong><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"><X className="h-4 w-4 text-slate-400" /></button></span>{item && <><span className="mt-3 block text-sm font-black leading-6 text-slate-900">{item.title}</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">{item.authors.join('، ') || 'مؤلف غير متاح'}{item.year ? ` · ${item.year}` : ''}</span></>}<span className="mt-3 block rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{citation.bibliography}</span><span className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void navigator.clipboard.writeText(citation.bibliography)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-2 text-[11px] font-bold text-blue-700"><Copy className="h-3.5 w-3.5" />نسخ المرجع</button>{item?.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-bold text-slate-600">فتح المصدر <ExternalLink className="h-3.5 w-3.5" /></a>}</span><span className="mt-3 block text-[10px] text-slate-500">{discoveryRecordLabel(citation.verificationStatus).label} · راجع المصدر قبل الاستشهاد</span></span>}
  </span>;
}
