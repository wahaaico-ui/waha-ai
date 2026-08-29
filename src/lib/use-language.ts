'use client';

import { useSyncExternalStore } from 'react';

export type WahaLanguage = 'ar' | 'en';

const LANG_KEY = 'waha_lang';
const LANGUAGE_EVENT = 'waha-language-change';

function getSnapshot(): WahaLanguage {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

function getServerSnapshot(): WahaLanguage {
  return 'ar';
}

function subscribe(callback: () => void) {
  window.addEventListener(LANGUAGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function setWahaLanguage(language: WahaLanguage) {
  try {
    localStorage.setItem(LANG_KEY, language);
  } catch {
    // The interface still changes for this tab when storage is unavailable.
  }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

export function useWahaLanguage() {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    language,
    toggleLanguage: () => setWahaLanguage(language === 'ar' ? 'en' : 'ar'),
  };
}
