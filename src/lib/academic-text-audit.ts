export type AcademicTextIssue = { code: string; excerpt: string; message: string; paragraphIndex?: number };

/** Deterministic checks only. Suggestions are not automatic rewriting or a grammar verdict. */
export function auditAcademicText(text: string, language: 'ar' | 'en'): AcademicTextIssue[] {
  const issues: AcademicTextIssue[] = [];
  if (!text || text.length > 12000) return issues;
  let paragraphIndex: number | undefined;
  const add = (code: string, excerpt: string, message: string) => issues.push({ code, excerpt: excerpt.slice(0, 100), message, ...(paragraphIndex === undefined ? {} : { paragraphIndex }) });
  const paragraphs = text.split(/\n+/u).map(value => value.trim()).filter(Boolean);
  for (const [index, paragraph] of paragraphs.entries()) {
    paragraphIndex = index + 1;
    const marks = language === 'ar' ? '،.؛:؟!' : ',.;:?!';
    for (const mark of marks) {
      const escaped = mark.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const before = paragraph.match(new RegExp(`\\S\\s+${escaped}`, 'u'));
      if (before) add('space_before_punctuation', before[0], 'توجد مسافة قبل علامة ترقيم.' );
      const after = paragraph.match(new RegExp(`${escaped}(?=[\\p{L}\\p{N}])`, 'u'));
      if (after) add('space_after_punctuation', paragraph.slice(Math.max(0, after.index || 0), (after.index || 0) + 15), 'قد تنقص مسافة بعد علامة ترقيم.');
    }
    const inside = paragraph.match(/[([]\s+\S|\S\s+[)\]]/u);
    if (inside) add('parenthesis_spacing', inside[0], 'توجد مسافة داخل قوس؛ راجعها.');
    if (language === 'ar') {
      const conjunction = paragraph.match(/(?:^|\s)و\s+\p{L}+/u);
      if (conjunction) add('detached_conjunction', conjunction[0], 'واو العطف منفصلة عن الكلمة التي بعدها.');
      const firstPerson = paragraph.match(/(?:^|\s)(?:أنا|نحن|قمنا\s+ب|أجرينا|بحثنا)(?=\s|[،.؛؟!]|$)/u);
      if (firstPerson) add('first_person', firstPerson[0], 'راجع صيغة المتكلم إذا كانت الجهة تشترط الأسلوب الغائب.');
    } else {
      const firstPerson = paragraph.match(/\b(?:I|we|my|our)\b/iu);
      if (firstPerson) add('first_person', firstPerson[0], 'Review first-person phrasing if the target style requires objective voice.');
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/u)) {
        const words = sentence.match(/\b[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*\b/gu) || [];
        if (words.length > 35) add('long_sentence', sentence, `Sentence contains ${words.length} words; consider splitting it.`);
      }
    }
  }
  paragraphIndex = undefined;
  if (/[0-9]/u.test(text) && /[٠-٩]/u.test(text)) add('mixed_numerals', '0-9 / ٠-٩', 'النص يخلط بين الأرقام الغربية والهندية؛ وحّدها وفق تعليمات الجهة.');
  return issues.slice(0, 100);
}
