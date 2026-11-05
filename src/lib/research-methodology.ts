import { assessAcademicText } from '@/lib/academic-content-quality';

export const METHODOLOGY_FIELDS = {
  population: 'مجتمع الدراسة',
  sample: 'العينة',
  instrument: 'أداة جمع البيانات',
} as const;

export const METHODOLOGY_MIN_CHARS = 20;
export const METHODOLOGY_MIN_WORDS = 4;

export function assessMethodologyField(field: keyof typeof METHODOLOGY_FIELDS, value: unknown) {
  const assessment = assessAcademicText(value, {
    label: METHODOLOGY_FIELDS[field], minChars: METHODOLOGY_MIN_CHARS, minWords: METHODOLOGY_MIN_WORDS,
  });
  if (assessment.characters < METHODOLOGY_MIN_CHARS) {
    return { ...assessment, reason: `${METHODOLOGY_FIELDS[field]}: اكتب وصفاً واضحاً من 20 حرفاً و4 كلمات على الأقل.` };
  }
  return assessment;
}

export function methodologyStructureIssue(output: Record<string, unknown> | undefined) {
  if (!output || typeof output.approach !== 'string' || !output.approach.trim()) return 'اختر منهج الدراسة أولاً.';
  for (const field of Object.keys(METHODOLOGY_FIELDS) as (keyof typeof METHODOLOGY_FIELDS)[]) {
    const assessment = assessMethodologyField(field, output[field]);
    if (!assessment.valid) return assessment.reason;
  }
  return null;
}

// A word match cannot establish the data type, especially in negated or contextual text.
export function methodologyAdvisories(output: Record<string, unknown> | undefined): string[] {
  const approach = typeof output?.approach === 'string' ? output.approach.trim().toLowerCase() : '';
  const instrument = typeof output?.instrument === 'string' ? output.instrument : '';
  const match = (approach === 'qualitative' && /استبان|questionnaire|survey/i.test(instrument))
    || (approach === 'quantitative' && /مقابل|interview/i.test(instrument));
  return match ? ['تنبيه استرشادي: اسم الأداة وحده لا يحدد نوع المنهج، وقد ترد الكلمة في سياق نفي أو مقارنة. راجع طبيعة البيانات وطريقة تحليلها؛ هذا التنبيه لا يمنع الحفظ أو الاعتماد ولا يتطلب تغيير المنهج.'] : [];
}
