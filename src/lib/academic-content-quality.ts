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

export type ProblemDraftAssessment = {
  valid: boolean;
  reason: string | null;
};

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const LETTER_PATTERN = /\p{L}/gu;
const REPEATED_CHARACTER_PATTERN = /(\p{L})\1{6,}/u;
const ARABIC_STOP_WORDS = new Set([
  'أثر', 'اثر', 'دور', 'مدى', 'حول', 'على', 'إلى', 'الى', 'عند', 'بين', 'ضمن', 'نحو',
  'هذه', 'هذا', 'التي', 'الذي', 'من', 'في', 'عن', 'مع', 'لدى', 'وجهة', 'نظر', 'دراسة',
  'دراسات', 'بحث', 'البحث', 'سياق', 'واقع',
]);

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

function meaningfulTokens(value: unknown) {
  const text = normalizedText(value).toLocaleLowerCase('ar');
  const words = text.match(WORD_PATTERN) || [];
  return new Set(words
    .map((word) => word.replace(/^[وفبكله]/u, '').replace(/^ال/u, ''))
    .filter((word) => word.length >= 4 && !ARABIC_STOP_WORDS.has(word)));
}

function tokenOverlap(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared;
}

export function assessProblemDraft(input: {
  title: unknown;
  problemStatement: unknown;
  researchGap: unknown;
  researcherNote: unknown;
  requireResearcherNote?: boolean;
}): ProblemDraftAssessment {
  // Preview can show guidance; approval requires a completed research statement.
  // This detects our own scaffolds, not the scientific validity of arbitrary prose.
  if (input.requireResearcherNote !== false) {
    const guidanceMarkers = [
      'هذه صياغة إرشادية أولية لدراسة موضوع',
      'هذه إرشادات لاستكمال الفجوة وليست فجوة معتمدة',
      'ملاحظة محفوظة غير متحققة من الاستكشاف',
      'لا يمكن تحديد فجوة علمية من العنوان وحده',
    ];
    const candidateText = normalizedText(`${normalizedText(input.problemStatement)} ${normalizedText(input.researchGap)}`)
      .replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069]/gu, '');
    if (guidanceMarkers.some((marker) => candidateText.includes(marker))) {
      return { valid: false, reason: 'النص ما زال إرشادياً وليس مشكلة وفجوة مستكملتين. اكتب الواقع المحدد وما بقي غير محسوم مع مصادره، واستبدل تعليمات المسودة قبل الاعتماد. إضافة سبب اهتمامك وحده لا تكفي.' };
    }
  }
  const checks = [
    assessAcademicText(input.problemStatement, { minChars: 50, minWords: 8, label: 'مشكلة البحث' }),
    assessAcademicText(input.researchGap, { minChars: 35, minWords: 6, label: 'الفجوة البحثية' }),
    ...(input.requireResearcherNote === false ? [] : [assessAcademicText(input.researcherNote, { minChars: 20, minWords: 4, label: 'سبب اهتمام الباحث' })]),
  ];
  const failed = checks.find((check) => !check.valid);
  if (failed) return { valid: false, reason: failed.reason };

  const titleTokens = meaningfulTokens(input.title);
  const problemTokens = meaningfulTokens(`${normalizedText(input.problemStatement)} ${normalizedText(input.researchGap)}`);
  if (titleTokens.size > 0 && tokenOverlap(titleTokens, problemTokens) === 0) {
    return { valid: false, reason: 'المشكلة والفجوة لا ترتبطان بوضوح بالعنوان المعتمد. اذكر موضوع العنوان أو متغيره أو سياقه بصورة صريحة.' };
  }

  const statementTokens = meaningfulTokens(input.problemStatement);
  const gapTokens = meaningfulTokens(input.researchGap);
  const shared = tokenOverlap(statementTokens, gapTokens);
  const smallerSet = Math.min(statementTokens.size, gapTokens.size);
  if (smallerSet >= 5 && shared / smallerSet > 0.8) {
    return { valid: false, reason: 'الفجوة تكرر مشكلة البحث تقريباً. وضّح ما الذي لم تحسمه الأدلة أو ما السياق الذي ما زال ناقصاً.' };
  }

  return { valid: true, reason: null };
}
