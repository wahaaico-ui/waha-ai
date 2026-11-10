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

/**
 * The researcher's academic profile. It lives in the account metadata, where
 * signup writes it and every report, suggestion and search reads it; the
 * profile page edits the same fields (DOC-21-01).
 */
export const SPECIALTY_OPTIONS = [
  'العلوم الشرعية والإسلامية', 'اللغة العربية وآدابها', 'التربية وعلم النفس', 'الإدارة والأعمال', 'الاقتصاد والمالية',
  'العلوم السياسية والقانون', 'التاريخ والحضارة', 'الاجتماع والأنثروبولوجيا', 'الإعلام والاتصال', 'الطب والعلوم الصحية',
  'الهندسة والتقنية', 'علوم الحاسوب والذكاء الاصطناعي', 'العلوم الطبيعية', 'الرياضيات والإحصاء', 'الفنون والتصميم', 'تخصص آخر',
] as const;

export const LEVEL_OPTIONS = [
  { value: 'masters', label: 'طالب ماجستير' },
  { value: 'phd', label: 'طالب دكتوراه' },
  { value: 'postdoc', label: 'باحث ما بعد الدكتوراه' },
  { value: 'professor', label: 'أستاذ جامعي' },
  { value: 'researcher', label: 'باحث في مركز بحثي' },
  { value: 'independent', label: 'باحث مستقل' },
] as const;

export type LevelValue = (typeof LEVEL_OPTIONS)[number]['value'];

export const PROFILE_LIMITS = { fullName: 120, specialty: 160, specialtyDetail: 160, university: 160, level: 80 } as const;

export type ResearcherProfile = {
  fullName: string | null;
  specialty: string | null;
  /** Free text, e.g. «أصول الفقه» inside «العلوم الشرعية والإسلامية». */
  specialtyDetail: string | null;
  university: string | null;
  level: string | null;
  country: string | null;
};

type SpecialtyFields = { specialty?: string | null; specialtyDetail?: string | null };

/** An optional text field: null when left empty, undefined when it is not text or too long. */
export function optionalText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  return text.length <= maximum ? text : undefined;
}

/** Metadata is written by the account holder, so every value is checked again here. */
export function researcherProfileFromMetadata(metadata: unknown): ResearcherProfile {
  const fields = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  const text = (key: string, maximum: number) => optionalText(fields[key], maximum) ?? null;
  return {
    fullName: text('full_name', PROFILE_LIMITS.fullName) || text('name', PROFILE_LIMITS.fullName),
    specialty: text('specialty', PROFILE_LIMITS.specialty),
    specialtyDetail: text('specialty_detail', PROFILE_LIMITS.specialtyDetail),
    university: text('university', PROFILE_LIMITS.university),
    level: text('level', PROFILE_LIMITS.level),
    country: text('country', 2)?.toUpperCase() ?? null,
  };
}

/** The text the search router reads to pick sources: the broad and the precise specialty together. */
export function routingSpecialty({ specialty, specialtyDetail }: SpecialtyFields): string {
  return [specialty, specialtyDetail].filter(Boolean).join(' ');
}

/** «العلوم الشرعية والإسلامية — أصول الفقه», or whichever of the two exists. */
export function specialtyLabel({ specialty, specialtyDetail }: SpecialtyFields): string | null {
  return [specialty, specialtyDetail].filter(Boolean).join(' — ') || null;
}

export type ProfileMetadata = {
  full_name: string;
  specialty: string;
  /** null removes a precise specialty saved earlier. */
  specialty_detail: string | null;
  university: string;
  level: LevelValue;
  country: CountryCode;
};

const LEVEL_VALUES = new Set<string>(LEVEL_OPTIONS.map((level) => level.value));

/** Checks the profile form and returns the account fields to save. */
export function parseProfileUpdate(input: unknown): { ok: true; data: ProfileMetadata } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'تعذر قراءة بيانات الملف.' };
  const form = input as Record<string, unknown>;
  const required = (value: unknown, maximum: number) => optionalText(value, maximum) || null;
  const fullName = required(form.fullName, PROFILE_LIMITS.fullName);
  if (!fullName) return { ok: false, error: `اكتب اسمك الكامل (حتى ${PROFILE_LIMITS.fullName} حرفًا).` };
  const specialty = required(form.specialty, PROFILE_LIMITS.specialty);
  if (!specialty) return { ok: false, error: 'اختر التخصص العام.' };
  const specialtyDetail = optionalText(form.specialtyDetail, PROFILE_LIMITS.specialtyDetail);
  if (specialtyDetail === undefined) return { ok: false, error: `اكتب التخصص الدقيق في ${PROFILE_LIMITS.specialtyDetail} حرفًا على الأكثر.` };
  const university = required(form.university, PROFILE_LIMITS.university);
  if (!university) return { ok: false, error: `اكتب الجامعة أو المؤسسة (حتى ${PROFILE_LIMITS.university} حرفًا).` };
  if (typeof form.level !== 'string' || !LEVEL_VALUES.has(form.level)) return { ok: false, error: 'اختر المستوى الأكاديمي.' };
  if (!isSupportedCountry(form.country)) return { ok: false, error: 'اختر الدولة أو البيئة البحثية.' };
  return {
    ok: true,
    data: { full_name: fullName, specialty, specialty_detail: specialtyDetail, university, level: form.level as LevelValue, country: form.country },
  };
}
