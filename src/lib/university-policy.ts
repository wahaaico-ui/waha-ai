/** Plain researcher-reviewed instructions, never an executable document or an AI verdict. */
export const UNIVERSITY_POLICY_MAX_CHARS = 100_000;
export const UNIVERSITY_GUIDE_MAX_BYTES = 4 * 1024 * 1024;
export const UNIVERSITY_GUIDE_MAX_PAGES = 50;

export function legacyGuideFileName(value: unknown): string | null {
  return typeof value === 'string' && /^\s*Manual PDF Upload:/i.test(value)
    ? value.replace(/^\s*Manual PDF Upload:\s*/i, '').trim() || 'PDF'
    : null;
}

const COMMON_ARABIC_WORDS = new Set(['في', 'من', 'على', 'أن', 'إلى', 'الى', 'عن', 'أو', 'التي', 'الذي', 'هذه', 'هذا', 'مع', 'كل', 'بين', 'ما', 'لا', 'يجب', 'الرسالة', 'البحث', 'يكون', 'تكون', 'ثم', 'أي', 'كما', 'حيث', 'بعد', 'قبل', 'عند']);

/**
 * Some PDFs store Arabic letters in an order that does not read as words
 * («لكمالوعدلفبل»). Readable Arabic guides are full of everyday words; in the
 * guides tested for item 3.4 they made 4–18% of the words, and under 2% in a
 * scrambled one. Such a text is refused rather than read into wrong rules.
 */
export function arabicTextLayerUnreadable(text: string): boolean {
  const words = text.match(/[\u0600-\u06FF]+/gu) ?? [];
  const arabicLetters = words.reduce((sum, word) => sum + word.length, 0);
  const letters = (text.match(/[A-Za-z\u0600-\u06FF]/gu) ?? []).length;
  if (words.length < 200 || arabicLetters < letters * 0.5) return false;
  return words.filter(word => COMMON_ARABIC_WORDS.has(word)).length / words.length < 0.03;
}

export function normalizeUniversityPolicy(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > UNIVERSITY_POLICY_MAX_CHARS || legacyGuideFileName(value)) return null;
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    // Some PDFs store Arabic in presentation forms (one code per joined letter shape); read them as plain letters.
    .replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]+/gu, forms => forms.normalize('NFKC').replace(/\u06CC/gu, 'ي'))
    // Kashida (and «ѧ», which some PDF fonts emit for it) only stretches a word; it is not a letter.
    .replace(/(?<=[\u0600-\u06FF])[\u0640\u0467]+(?=[\u0600-\u06FF])/gu, '').trim();
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
