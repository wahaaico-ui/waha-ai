'use client';

import { useEffect, useState } from 'react';
import Hero from './components/Hero';
import SiteHeader from '@/components/SiteHeader';
import SmartWelcome from '@/components/SmartWelcome';

const LANG_KEY = 'waha_lang';

export default function HomePage() {
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    if (typeof window === 'undefined') return 'ar';
    const savedLanguage = localStorage.getItem(LANG_KEY);
    return savedLanguage === 'en' ? 'en' : 'ar';
  });

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const nextLanguage = (event as CustomEvent<'ar' | 'en'>).detail;
      if (nextLanguage === 'ar' || nextLanguage === 'en') setLang(nextLanguage);
    };
    window.addEventListener('waha-language-change', syncLanguage);
    return () => window.removeEventListener('waha-language-change', syncLanguage);
  }, []);

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen overflow-hidden bg-gradient-to-b from-[#090d16] via-[#0b1220] to-[#0d1727] text-white">
      <SiteHeader />
      <SmartWelcome lang={lang} />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Hero lang={lang} /></main>
    </div>
  );
}
