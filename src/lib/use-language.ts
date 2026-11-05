'use client';

import { useSyncExternalStore } from 'react';

export type WahaLanguage = 'ar' | 'en';

const LANG_KEY = 'waha_lang';
const LANGUAGE_EVENT = 'waha-language-change';

export const ENGLISH_INTERFACE_ENABLED = true;
let transientLanguage: WahaLanguage = 'ar';

function getSnapshot(): WahaLanguage {
  if (!ENGLISH_INTERFACE_ENABLED) return 'ar';
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'en' || saved === 'ar' ? saved : transientLanguage;
  } catch {
    return transientLanguage;
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
  const supportedLanguage = ENGLISH_INTERFACE_ENABLED ? language : 'ar';
  transientLanguage = supportedLanguage;
  try {
    localStorage.setItem(LANG_KEY, supportedLanguage);
  } catch {
    // The interface still changes for this tab when storage is unavailable.
  }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

export function useWahaLanguage() {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    language,
    toggleLanguage: () => {
      if (ENGLISH_INTERFACE_ENABLED) {
        setWahaLanguage(language === 'ar' ? 'en' : 'ar');
      }
    },
  };
}
