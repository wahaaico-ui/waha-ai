export const COUNTRY_OPTIONS = [
  { value: 'SA', label: 'المملكة العربية السعودية' },
  { value: 'PS', label: 'فلسطين' },
  { value: 'JO', label: 'الأردن' },
  { value: 'EG', label: 'مصر' },
  { value: 'AE', label: 'الإمارات العربية المتحدة' },
  { value: 'QA', label: 'قطر' },
  { value: 'KW', label: 'الكويت' },
  { value: 'BH', label: 'البحرين' },
  { value: 'OM', label: 'عُمان' },
  { value: 'IQ', label: 'العراق' },
  { value: 'YE', label: 'اليمن' },
  { value: 'SY', label: 'سوريا' },
  { value: 'LB', label: 'لبنان' },
  { value: 'MA', label: 'المغرب' },
  { value: 'DZ', label: 'الجزائر' },
  { value: 'TN', label: 'تونس' },
  { value: 'LY', label: 'ليبيا' },
  { value: 'SD', label: 'السودان' },
  { value: 'SO', label: 'الصومال' },
  { value: 'MR', label: 'موريتانيا' },
  { value: 'DJ', label: 'جيبوتي' },
  { value: 'KM', label: 'جزر القمر' },
  { value: 'TR', label: 'تركيا' },
  { value: 'MY', label: 'ماليزيا' },
  { value: 'US', label: 'الولايات المتحدة' },
  { value: 'GB', label: 'المملكة المتحدة' },
  { value: 'CA', label: 'كندا' },
  { value: 'AU', label: 'أستراليا' },
  { value: 'DE', label: 'ألمانيا' },
  { value: 'FR', label: 'فرنسا' },
] as const;

export type CountryCode = (typeof COUNTRY_OPTIONS)[number]['value'];

const COUNTRY_LABELS = new Map<string, string>(COUNTRY_OPTIONS.map((country) => [country.value, country.label]));

export function isSupportedCountry(value: unknown): value is CountryCode {
  return typeof value === 'string' && COUNTRY_LABELS.has(value);
}

export function countryName(value: string | null | undefined): string | null {
  if (!value) return null;
  const configuredLabel = COUNTRY_LABELS.get(value);
  if (configuredLabel) return configuredLabel;
  try {
    return new Intl.DisplayNames(['ar'], { type: 'region' }).of(value.toUpperCase()) || value;
  } catch {
    return value;
  }
}
