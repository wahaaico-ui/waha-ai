'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { BookOpen, CreditCard, FolderKanban, Languages, Settings, Type, UserRound } from 'lucide-react';
import { useWahaLanguage } from '@/lib/use-language';
import { useProjectId } from '@/lib/use-project-id';
import { useAuthSession } from '@/components/AuthSessionProvider';
import JourneyAutosaveIndicator from '@/components/JourneyAutosaveIndicator';

const FONT_SIZES = [15, 16, 18] as const;
const FONT_KEY = 'waha-font-size';
const FONT_EVENT = 'waha-font-size-change';

function getFontSize() {
  const saved = Number(localStorage.getItem(FONT_KEY));
  return FONT_SIZES.includes(saved as (typeof FONT_SIZES)[number]) ? saved : 16;
}

function subscribeToFontSize(callback: () => void) {
  window.addEventListener(FONT_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(FONT_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export default function ResearchUtilityDock() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const { language, toggleLanguage } = useWahaLanguage();
  const projectId = useProjectId();
  const { user } = useAuthSession();
  const fontSize = useSyncExternalStore(subscribeToFontSize, getFontSize, () => 16);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const name = user?.fullName || user?.email?.split('@')[0] || ui('باحث');
  const specialty = user?.specialty || '';

  const changeFont = () => {
    const currentIndex = FONT_SIZES.indexOf(fontSize as (typeof FONT_SIZES)[number]);
    const next = FONT_SIZES[(currentIndex + 1) % FONT_SIZES.length];
    localStorage.setItem(FONT_KEY, String(next));
    window.dispatchEvent(new Event(FONT_EVENT));
  };

  const itemClass = 'flex min-w-20 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700';
  return <aside dir={uiDirection} aria-label={ui("أدوات الباحث")} className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl print:hidden"><div className="mx-auto flex max-w-6xl items-stretch gap-1 overflow-x-auto px-3 py-2"><div className="flex min-w-40 items-center gap-2 border-l border-slate-200 px-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><UserRound className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{name}</strong><small className="block truncate text-[10px] text-slate-500">{specialty || ui("الملف الأكاديمي")}</small></span></div>{projectId && <JourneyAutosaveIndicator />}<Link href="/dashboard" className={itemClass}><FolderKanban className="h-4 w-4" />{ui("مشاريعي")}</Link>{projectId && <Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`} className={itemClass}><BookOpen className="h-4 w-4" />{ui("مكتبتي")}</Link>}<Link href="/dashboard/profile" className={itemClass}><Settings className="h-4 w-4" />{ui("الإعدادات")}</Link><Link href="/pricing" className={itemClass}><CreditCard className="h-4 w-4" />{ui("الاشتراك")}</Link><button type="button" onClick={changeFont} className={itemClass}><Type className="h-4 w-4" />{ui("النص")}{' '}{fontSize}px</button><button type="button" onClick={toggleLanguage} className={itemClass} aria-label={language === 'ar' ? 'Switch interface to English' : 'تغيير الواجهة إلى العربية'}><Languages className="h-4 w-4" />{language === 'ar' ? 'English' : 'العربية'}</button></div></aside>;
}
