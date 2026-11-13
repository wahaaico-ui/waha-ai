/** Rules are extracted only when the guide states an explicit value. Missing rules stay null. */
export type SourcedRule<T> = { value: T; evidence: string } | null;
export type AcademicStyleProfile = {
  university_or_journal_name: SourcedRule<string>;
  language_rules: {
    arabic_font_family: SourcedRule<string>;
    arabic_font_size_body: SourcedRule<number>;
    arabic_font_size_heading_1: SourcedRule<number>;
    english_font_family: SourcedRule<string>;
    english_font_size_body: SourcedRule<number>;
    line_spacing: SourcedRule<number>;
    paragraph_indentation: SourcedRule<number>;
  };
  page_layout: {
    margin_top: SourcedRule<number>;
    margin_bottom: SourcedRule<number>;
    margin_binding_side: SourcedRule<number>;
    margin_other_side: SourcedRule<number>;
  };
  citation_style: { system: SourcedRule<'APA 7' | 'Harvard' | 'IEEE' | 'Chicago'>; in_text_format: SourcedRule<string> };
  document_rules: {
    max_words: SourcedRule<number>;
    abstract_max_words: SourcedRule<number>;
    page_numbering: SourcedRule<PageNumberPosition>;
  };
};

export const PAGE_NUMBER_POSITIONS = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'] as const;
export type PageNumberPosition = typeof PAGE_NUMBER_POSITIONS[number];

const ABSTRACT = /ملخص|الم\s?لخص|المستخلص|abstract/iu;
const toNumber = (digits: string) => Number(digits.replace(/[,٬\s]/gu, ''));

/** «لا يزيد / لا يتجاوز … 40000 كلمة», «must not exceed 80,000 words», «no more than 350 words». */
function wordLimit(line: string, min: number, max: number): number | null {
  const match = line.match(/(?:(?:لا|ألا|الا)\s*(?:يزيد|يتجاوز|تزيد|تتجاوز)|حد(?:ا|ًا)?\s*أقصى|(?:حده|حدها|الحد)\s*(?:الأعلى|األعلى)|not\s+(?:normally\s+|usually\s+)?exceed|no\s+more\s+than|maximum\s+of|at\s+most|up\s+to)[^\d]{0,60}?(\d{2,3}(?:[,٬]\d{3})+|\d{2,6})\s*\)?\s*(?:كلمة|كلمات|words?)/iu)
    // «350 word maximum», «(150 words or less)»: the limit written after the number.
    || line.match(/(\d{2,3}(?:[,٬]\d{3})+|\d{2,6})\s*(?:words?|كلمة|كلمات)\s*(?:maximum|max\b|or\s+(?:less|fewer)|at\s+most|كحد\s+أقصى)/iu);
  if (!match) return null;
  const value = toNumber(match[1]);
  return value >= min && value <= max ? value : null;
}

const WORD_INSTRUCTIONS = /ribbon|click|drop[- ]?down|menu\b|tab\b|اضغط|انقر|القائمة/iu;
/** Of several labelled patterns, the one whose first match comes earliest in the line. */
function earliest<T extends string>(line: string, patterns: Record<T, RegExp>): T | null {
  let best: { key: T; index: number } | null = null;
  for (const key of Object.keys(patterns) as T[]) {
    const index = line.search(patterns[key]);
    if (index >= 0 && (!best || index < best.index)) best = { key, index };
  }
  return best?.key ?? null;
}

function pageNumbering(lines: string[]): SourcedRule<PageNumberPosition> {
  for (const line of lines) {
    if (!/ترقيم\s*الصفحات|رقم\s*الصفحة|أرقام\s*الصفحات|page\s*numb/iu.test(line)) continue;
    // Word instructions («the far left ribbon») describe the software, not the page.
    if (WORD_INSTRUCTIONS.test(line)) continue;
    // The first position named is the rule; later ones are the alternatives («lower right; lower centre … also»).
    const vertical = earliest(line, { bottom: /أسفل|bottom|footer|lower/iu, top: /أعلى|top|header|upper/iu });
    const horizontal = earliest(line, { center: /منتصف|وسط|cent(?:er|re)|middle/iu, right: /يمين|right/iu, left: /يسار|left/iu });
    if (vertical && horizontal) return { value: `${vertical}-${horizontal}` as PageNumberPosition, evidence: line };
  }
  return null;
}

function matchingRule<T>(lines: string[], pattern: RegExp, parse: (match: RegExpMatchArray) => T | null): SourcedRule<T> {
  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) continue;
    const value = parse(match);
    if (value !== null) return { value, evidence: line };
  }
  return null;
}

function numberInRange(min: number, max: number) {
  return (match: RegExpMatchArray) => {
    const value = Number(match[1]);
    return Number.isFinite(value) && value >= min && value <= max ? value : null;
  };
}

const ARABIC_FONTS = 'Simplified Arabic|Traditional Arabic|Noto Naskh Arabic|Amiri|Arial';
const ENGLISH_FONTS = 'Times New Roman|Calibri|Noto Sans|Arial';
// Footnotes, captions, tables and headings carry their own sizes; never the body text.
const NOT_BODY = /حواش|الحاشية|footnote|caption|table|جدول|heading|العناوين|عنوان|title|cover|الغلاف|الغالف|abstract|الملخص/iu;
const ARABIC = /عربي/u;
// The Arabic text layer may split lam-alef, e.g. «اإلنجليزية».
const ENGLISH_AR = /نجليزي/u;
const isArabicScript = (line: string) => /\p{Script=Arabic}/u.test(line);

/** Guides wrap one rule over a line break. A rule is read from one line when
 * that line holds it whole, otherwise from that line and the next; the joined
 * pair is never used when the next line alone already states the rule. */
function firstRule<T>(lines: string[], read: (text: string) => T | null): SourcedRule<T> {
  for (let i = 0; i < lines.length; i++) {
    const single = read(lines[i]);
    if (single !== null) return { value: single, evidence: lines[i] };
    if (i + 1 < lines.length && read(lines[i + 1]) === null) {
      const text = `${lines[i]} ${lines[i + 1]}`, joined = read(text);
      if (joined !== null) return { value: joined, evidence: text };
    }
  }
  return null;
}
const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max ? value : null;
const centimetres = (amount: string, unit: string) => {
  const value = Number(amount.replace(',', '.')) * (/^(?:in|inch|inches|"|”|″)$/iu.test(unit) ? 2.54 : 1);
  return inRange(Math.round(value * 100) / 100, 0.5, 8);
};
const UNIT = String.raw`(\d+(?:[.,]\d+)?)\s*(cm|سم|inches|inch|in|"|”|″)`;

function sentenceFont(lines: string[], language: 'arabic' | 'english') {
  const names = new RegExp(`(${language === 'arabic' ? ARABIC_FONTS : ENGLISH_FONTS})`, 'iu');
  return firstRule(lines, text => {
    if (NOT_BODY.test(text) || !/font|خط/iu.test(text)) return null;
    const scope = language === 'arabic' ? ARABIC.test(text) && !ENGLISH_AR.test(text) : (isArabicScript(text) ? ENGLISH_AR.test(text) : !/arabic/iu.test(text));
    const match = scope ? text.match(names) : null;
    return match ? (language === 'arabic' ? ARABIC_FONTS : ENGLISH_FONTS).split('|').find(name => name.toLowerCase() === match[1].toLowerCase()) || null : null;
  });
}
function sentenceSize(lines: string[], language: 'arabic' | 'english') {
  return firstRule(lines, text => {
    if (NOT_BODY.test(text) || !/size|font|حجم|بحجم/iu.test(text)) return null;
    const arabic = ARABIC.test(text) && !ENGLISH_AR.test(text) && !/(?:غ)?ير\s*العربية/u.test(text);
    const english = isArabicScript(text) ? ENGLISH_AR.test(text) && !ARABIC.test(text) : !/arabic/iu.test(text);
    if (language === 'arabic' ? !arabic : !english) return null;
    // «(8 ½ by 11» is the paper size, not a font size.
    const match = text.match(/\(\s*(\d{1,2})(?![\d½¼¾])(?!\s*(?:½|¼|¾|by\b|x\b|×))(?:\s*(?:pt|point|نقطة))?\b/u) || text.match(/\b(\d{1,2})\s*-?\s*(?:pt\.?|point|نقطة)/iu);
    return match ? inRange(Number(match[1]), 8, 30) : null;
  });
}
function sentenceMargins(lines: string[]) {
  const all = firstRule(lines, text => {
    const match = text.match(new RegExp(`(?:الأبعاد|األبعاد|الهوامش|margins?)[^\\d]{0,20}${UNIT}\\s*(?:من جميع الجهات|on all sides|all around|on each side)`, 'iu'))
      // «All margins should be 1 inch», «All margins—top, left, right, and bottom—should be set to 1.0 inch».
      || text.match(new RegExp(`(?:all\\s+(?:page\\s+)?margins|جميع\\s+الهوامش)[^\\d]{0,70}?${UNIT}`, 'iu'));
    return match ? centimetres(match[1], match[2]) : null;
  });
  const except = firstRule(lines, text => {
    const match = text.match(new RegExp(`(?:من جميع الجهات|on all sides)\\s*(?:ب\\s*)?(?:استثناء|باستثناء|except)[^\\d]{0,40}${UNIT}`, 'iu'));
    return match ? centimetres(match[1], match[2]) : null;
  });
  const side = (pattern: string, before?: string) => firstRule(lines, text => {
    // A chapter's first page or the title page has its own margin; it is not the page margin.
    if (/first page|each chapter|major division|title page|الصفحة الأولى|بداية (?:كل )?فصل/iu.test(text)) return null;
    const match = text.match(new RegExp(`(?:${pattern})[^\\d.]{0,20}(?:must be|should be|is|of|=|:)?\\s*${UNIT}`, 'iu'))
      // «1.5" left, 1" top, 1" right and bottom margin»: the value written before the side.
      || (before && /margin/iu.test(text) ? text.match(new RegExp(`${UNIT}\\s*(?:${before})\\b`, 'iu')) : null);
    return match ? centimetres(match[1], match[2]) : null;
  });
  // A gutter is added to the margin; «total binding edge» is the whole binding side.
  const binding = side('total bi(?:n)?ding edge(?: of)?', undefined) || side('inside margin|binding margin|left margin|gutter', 'left') || except;
  const other = side('right and bottom margins|outside margin|right margin', 'right') || all;
  const bottom = side('right and bottom margins|bottom margin', 'bottom') || all;
  const top = side('top margin|margins? top', 'top') || all;
  return { top, bottom, binding, other };
}
function sentenceSpacing(lines: string[]) {
  return firstRule(lines, text => {
    if (NOT_BODY.test(text) && !/document text|body text|المتن/iu.test(text)) return null;
    // Space between paragraphs is not line spacing.
    if (/between paragraphs|بين الفقرات/iu.test(text) && !/document text|body text|المتن|بين الأسطر|بين السطور/iu.test(text)) return null;
    if (/double[- ]spac|مسافة مزدوجة|مسافتين/iu.test(text)) return 2;
    if (/(?:1\.5|one and a half)[- ]?(?:line )?spac|مسافة ونصف|سطر ونصف/iu.test(text)) return 1.5;
    return null;
  });
}
function sentenceCitation(lines: string[]) {
  return firstRule(lines, text => {
    // «referenced in the text» is a verb about tables, not the reference style.
    if (!/توثيق|التوثيق|citation|referencing|references?\s+(?:style|list|format)|\breferences\b/iu.test(text) || !/المعتمد|يعتمد|نظام|must|required|use|follow/iu.test(text)) return null;
    // Two styles offered as a choice («APA أو MLA») leave the choice to the department.
    if (/\b(?:APA|MLA|Harvard|IEEE|Chicago|Vancouver)\b\)?\s*(?:أو|or|\/)\s*\(?\b(?:APA|MLA|Harvard|IEEE|Chicago|Vancouver)\b/iu.test(text)) return null;
    // A style named as an example or one of several options is not the required style.
    if (/\be\.g\.|for (?:instance|example)|such as|etc\.|\bvs\.?\b|مثل|على سبيل المثال/iu.test(text)) return null;
    const match = text.match(/\b(APA(?:\s*7(?:th)?)?|Harvard|IEEE|Chicago)\b/u);
    return match ? (/^apa/iu.test(match[1]) ? 'APA 7' : match[1]) as 'APA 7' | 'Harvard' | 'IEEE' | 'Chicago' : null;
  });
}

/** A conservative local extractor; it does not claim to understand arbitrary PDFs.
 * An explicit «label: value» line wins; otherwise a rule stated in a sentence is
 * read with its source phrase. Every rule still needs the researcher's approval. */
export function extractAcademicStyleProfile(text: string): AcademicStyleProfile {
  const lines = text.split(/\r?\n/u).map(line => line.replace(/\s+/gu, ' ').trim()).filter(Boolean);
  const font = (language: 'arabic' | 'english') => matchingRule(lines,
    language === 'arabic'
      ? /(?:Arabic font|الخط العربي)\s*[:：-]\s*(Simplified Arabic|Traditional Arabic|Arial|Noto Naskh Arabic|Amiri)/iu
      : /(?:English font|الخط الإنجليزي)\s*[:：-]\s*(Times New Roman|Arial|Calibri|Noto Sans)/iu,
    match => match[1]) || sentenceFont(lines, language);
  const size = (language: 'arabic' | 'english', heading: boolean) => matchingRule(lines,
    language === 'arabic'
      ? heading ? /(?:Arabic (?:heading|title) (?:font )?size|حجم (?:العنوان|الخط الرئيسي) العربي)\s*[:：-]?\s*(\d{1,2})(?:\s*(?:pt|point|نقطة))?/iu
        : /(?:Arabic (?:body )?(?:font )?size|حجم (?:خط )?المتن العربي)\s*[:：-]?\s*(\d{1,2})(?:\s*(?:pt|point|نقطة))?/iu
      : /(?:English (?:body )?(?:font )?size|حجم (?:خط )?المتن الإنجليزي)\s*[:：-]?\s*(\d{1,2})(?:\s*(?:pt|point|نقطة))?/iu,
    numberInRange(8, 30)) || (heading ? null : sentenceSize(lines, language));
  const margin = (side: 'top' | 'bottom' | 'binding' | 'other') => matchingRule(lines,
    new RegExp(`(?:${{ top: 'top margin|الهامش العلوي', bottom: 'bottom margin|الهامش السفلي', binding: 'binding margin|هامش التجليد', other: 'other margin|الهامش المقابل' }[side]})\\s*[:：-]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:cm|سم)`, 'iu'),
    numberInRange(0.5, 8));
  const sentences = sentenceMargins(lines);
  const citation = matchingRule(lines, /(?:citation style|referencing style|نظام التوثيق|نمط التوثيق)\s*[:：-]?\s*(APA\s*7(?:th)?|Harvard|IEEE|Chicago)/iu,
    match => (/^apa/iu.test(match[1]) ? 'APA 7' : match[1]) as 'APA 7' | 'Harvard' | 'IEEE' | 'Chicago') || sentenceCitation(lines);
  return {
    // Only a line that starts with the label; a sample reference also contains «Journal,».
    university_or_journal_name: matchingRule(lines, /^(?:university|journal|الجامعة|المجلة)\s*[:：-]\s*([^:：]{3,100})/iu, match => match[1].trim()),
    language_rules: {
      arabic_font_family: font('arabic'), arabic_font_size_body: size('arabic', false),
      arabic_font_size_heading_1: size('arabic', true), english_font_family: font('english'),
      english_font_size_body: size('english', false),
      line_spacing: matchingRule(lines, /(?:line spacing|تباعد الأسطر)\s*[:：-]?\s*(1(?:\.5)?|2(?:\.0)?)(?!\d)/iu, numberInRange(1, 2)) || sentenceSpacing(lines),
      paragraph_indentation: matchingRule(lines, /(?:paragraph indentation|المسافة البادئة للفقرة)\s*[:：-]?\s*(\d+(?:\.\d+)?)\s*(?:cm|سم)/iu, numberInRange(0, 5)),
    },
    page_layout: {
      margin_top: margin('top') || sentences.top, margin_bottom: margin('bottom') || sentences.bottom,
      margin_binding_side: margin('binding') || sentences.binding, margin_other_side: margin('other') || sentences.other,
    },
    citation_style: { system: citation, in_text_format: matchingRule(lines, /(?:in.text citation|التوثيق داخل المتن)\s*[:：-]\s*(.{3,120})/iu, match => match[1].trim()) },
    document_rules: {
      // The abstract carries its own limit; it is never read as the thesis limit.
      max_words: firstRule(lines, text => ABSTRACT.test(text) ? null : wordLimit(text, 1000, 300000)),
      abstract_max_words: firstRule(lines, text => ABSTRACT.test(text) ? wordLimit(text, 50, 2000) : null),
      page_numbering: pageNumbering(lines),
    },
  };
}
