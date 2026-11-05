/** Plain researcher-reviewed instructions, never an executable document or an AI verdict. */
export const UNIVERSITY_POLICY_MAX_CHARS = 100_000;
export const UNIVERSITY_GUIDE_MAX_BYTES = 4 * 1024 * 1024;
export const UNIVERSITY_GUIDE_MAX_PAGES = 50;

export function legacyGuideFileName(value: unknown): string | null {
  return typeof value === 'string' && /^\s*Manual PDF Upload:/i.test(value)
    ? value.replace(/^\s*Manual PDF Upload:\s*/i, '').trim() || 'PDF'
    : null;
}

export function normalizeUniversityPolicy(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > UNIVERSITY_POLICY_MAX_CHARS || legacyGuideFileName(value)) return null;
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  return normalized || null;
}

export function universityPolicyForExport(value: string | null, language: 'ar' | 'en'): string {
  if (value?.startsWith('WAHA_GUIDE_V1:')) {
    try { const parsed = JSON.parse(value.slice('WAHA_GUIDE_V1:'.length)); if (typeof parsed.text === 'string') return parsed.text; }
    catch { return language === 'ar' ? 'تعذر قراءة تعليمات الجهة المحفوظة.' : 'Saved guidelines could not be read.'; }
  }
  if (legacyGuideFileName(value)) return language === 'ar'
    ? 'المحفوظ سابقًا اسم ملف فقط؛ أضف نص تعليمات الجامعة وراجعه داخل المشروع.'
    : 'Only a filename was saved previously. Add and review the actual university instructions in the project.';
  return value?.trim() || (language === 'ar' ? 'لم تُحدد' : 'Not specified');
}
