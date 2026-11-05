'use client';

import { useCallback } from 'react';
import { translateUiText } from '@/lib/i18n/ui-text';
export { translateUiText } from '@/lib/i18n/ui-text';
import { useWahaLanguage } from '@/lib/use-language';

export function useUiTranslation() {
  const { language } = useWahaLanguage();
  const text = useCallback((message: string, values?: readonly unknown[]) => translateUiText(message, language, values), [language]);
  return { text, language, direction: language === 'ar' ? 'rtl' as const : 'ltr' as const };
}
