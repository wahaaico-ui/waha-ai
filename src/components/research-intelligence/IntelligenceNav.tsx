'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';

export const INTELLIGENCE_SECTIONS = [
  { id: 'evidence', label: 'الأدلة' },
  { id: 'claims', label: 'الادعاءات ودعمها' },
  { id: 'scope', label: 'نطاق البحث المسجل' },
  { id: 'gaps', label: 'تقييم الفجوات' },
] as const;
export type IntelligenceSection = (typeof INTELLIGENCE_SECTIONS)[number]['id'];

/** المصادر ← الأدلة ← الادعاءات ← الدعم والتعارض ← تقييم الفجوة ← قرار الباحث. Free movement between sections. */
export default function IntelligenceNav({ projectId, current, onSelect }: { projectId: string; current: IntelligenceSection; onSelect: (section: IntelligenceSection) => void }) {
  const { text: ui } = useUiTranslation();

  return <nav aria-label={ui("أقسام تحليل الأدلة")} className="flex gap-2 overflow-x-auto pb-1">
    <Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`} className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">{ui("المصادر")}</Link>
    {INTELLIGENCE_SECTIONS.map((section) => <button key={section.id} type="button" aria-current={current === section.id ? 'page' : undefined} onClick={() => onSelect(section.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${current === section.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{ui(section.label)}</button>)}
  </nav>;
}
