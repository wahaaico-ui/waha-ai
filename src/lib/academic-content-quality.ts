export type AcademicTextRule = {
  minChars: number;
  minWords: number;
  label: string;
  requireQuestion?: boolean;
};

export type AcademicTextAssessment = {
  valid: boolean;
  reason: string | null;
  characters: number;
  words: number;
};

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const LETTER_PATTERN = /\p{L}/gu;
const REPEATED_CHARACTER_PATTERN = /(\p{L})\1{6,}/u;

function normalizedText(value: unknown) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim() : '';
}

function looksMechanicallyRepeated(value: string, words: string[]) {
  if (REPEATED_CHARACTER_PATTERN.test(value)) return true;
  const letters = value.match(LETTER_PATTERN) || [];
  if (letters.length >= 20 && new Set(letters.map((letter) => letter.toLocaleLowerCase())).size < 5) return true;
  if (words.length >= 6) {
    const normalizedWords = words.map((word) => word.toLocaleLowerCase());
    if (new Set(normalizedWords).size / normalizedWords.length < 0.35) return true;
  }
  return false;
}

export function assessAcademicText(value: unknown, rule: AcademicTextRule): AcademicTextAssessment {
  const text = normalizedText(value);
  const words = text.match(WORD_PATTERN) || [];
  const base = { characters: text.length, words: words.length };

  if (text.length < rule.minChars) {
    return { ...base, valid: false, reason: `${rule.label}: النص أقصر من الحد المطلوب.` };
  }
  if (words.length < rule.minWords) {
    return { ...base, valid: false, reason: `${rule.label}: اكتب جملة مفهومة من ${rule.minWords} كلمات على الأقل، وليس أحرفاً متكررة.` };
  }
  if (looksMechanicallyRepeated(text, words)) {
    return { ...base, valid: false, reason: `${rule.label}: النص يبدو مكرراً أو عشوائياً؛ اكتب معنى بحثياً واضحاً.` };
  }
  if (rule.requireQuestion && !/[؟?]/u.test(text) && !/^(ما|كيف|هل|إلى أي|الى أي|إلى اى|ما مدى|ما أثر|ما علاقة)\b/u.test(text)) {
    return { ...base, valid: false, reason: `${rule.label}: يجب أن يُصاغ كسؤال بحث واضح.` };
  }
  return { ...base, valid: true, reason: null };
}

export function firstAcademicTextIssue(items: unknown, rule: AcademicTextRule, minimumItems: number) {
  if (!Array.isArray(items) || items.length < minimumItems) return `أضف ${minimumItems} من ${rule.label} على الأقل.`;
  for (let index = 0; index < items.length; index += 1) {
    const assessment = assessAcademicText(items[index], { ...rule, label: `${rule.label} ${index + 1}` });
    if (!assessment.valid) return assessment.reason;
  }
  return null;
}
