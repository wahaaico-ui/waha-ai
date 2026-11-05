'use client';

import { useEffect } from 'react';
import { useWahaLanguage } from '@/lib/use-language';

export default function LanguageDocument() {
  const { language } = useWahaLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.body.style.fontFamily = language === 'ar' ? 'var(--font-plex-arabic), sans-serif' : 'var(--font-inter), sans-serif';
  }, [language]);
  return null;
}
