'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, CreditCard, FolderKanban, Languages, Settings, Type, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

const FONT_SIZES = [15, 16, 18] as const;
const FONT_KEY = 'waha-font-size';

export default function ResearchUtilityDock() {
  const [name, setName] = useState('باحث');
  const [specialty, setSpecialty] = useState('');
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window === 'undefined') return 16;
    const saved = Number(localStorage.getItem(FONT_KEY));
    return FONT_SIZES.includes(saved as (typeof FONT_SIZES)[number]) ? saved : 16;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata || {};
      const displayName = typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : data.user?.email?.split('@')[0];
      const researcherSpecialty = typeof metadata.specialty === 'string' ? metadata.specialty : '';
      if (displayName) setName(displayName); if (researcherSpecialty) setSpecialty(researcherSpecialty);
    });
  }, []);

  const changeFont = () => {
    const currentIndex = FONT_SIZES.indexOf(fontSize as (typeof FONT_SIZES)[number]);
    const next = FONT_SIZES[(currentIndex + 1) % FONT_SIZES.length];
    setFontSize(next); localStorage.setItem(FONT_KEY, String(next));
  };

  const itemClass = 'flex min-w-20 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700';
  const [projectId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('projectId') || '');
  return <aside dir="rtl" aria-label="أدوات الباحث" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl print:hidden"><div className="mx-auto flex max-w-6xl items-stretch gap-1 overflow-x-auto px-3 py-2"><div className="flex min-w-40 items-center gap-2 border-l border-slate-200 px-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><UserRound className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{name}</strong><small className="block truncate text-[10px] text-slate-500">{specialty || 'الملف الأكاديمي'}</small></span></div><Link href="/dashboard" className={itemClass}><FolderKanban className="h-4 w-4" />مشاريعي</Link>{projectId && <Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`} className={itemClass}><BookOpen className="h-4 w-4" />مكتبتي</Link>}<Link href="/dashboard/profile" className={itemClass}><Settings className="h-4 w-4" />الإعدادات</Link><Link href="/pricing" className={itemClass}><CreditCard className="h-4 w-4" />الاشتراك</Link><button type="button" onClick={changeFont} className={itemClass}><Type className="h-4 w-4" />النص {fontSize}px</button><div className={itemClass} title="الواجهة البحثية العربية هي النسخة المكتملة حالياً"><Languages className="h-4 w-4" />العربية</div></div></aside>;
}
