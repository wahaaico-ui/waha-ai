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
};

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
  const value = Number(amount) * (/^(?:in|inch|inches|")$/iu.test(unit) ? 2.54 : 1);
  return inRange(Math.round(value * 100) / 100, 0.5, 8);
};
const UNIT = String.raw`(\d+(?:\.\d+)?)\s*(cm|سم|in|inch|inches|")`;

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
    const arabic = ARABIC.test(text) && !ENGLISH_AR.test(text);
    const english = isArabicScript(text) ? ENGLISH_AR.test(text) && !ARABIC.test(text) : !/arabic/iu.test(text);
    if (language === 'arabic' ? !arabic : !english) return null;
    const match = text.match(/\(\s*(\d{1,2})(?:\s*(?:pt|point|نقطة))?\b/u) || text.match(/\b(\d{1,2})\s*(?:pt\.?|point|نقطة)/iu);
    return match ? inRange(Number(match[1]), 8, 30) : null;
  });
}
function sentenceMargins(lines: string[]) {
  const all = firstRule(lines, text => {
    const match = text.match(new RegExp(`(?:الأبعاد|األبعاد|الهوامش|margins?)[^\\d]{0,20}${UNIT}\\s*(?:من جميع الجهات|on all sides|all around|on each side)`, 'iu'));
    return match ? centimetres(match[1], match[2]) : null;
  });
  const except = firstRule(lines, text => {
    const match = text.match(new RegExp(`(?:من جميع الجهات|on all sides)\\s*(?:ب\\s*)?(?:استثناء|باستثناء|except)[^\\d]{0,40}${UNIT}`, 'iu'));
    return match ? centimetres(match[1], match[2]) : null;
  });
  const side = (pattern: string) => firstRule(lines, text => {
    const match = text.match(new RegExp(`(?:${pattern})[^\\d.]{0,20}(?:must be|should be|is|of|=|:)?\\s*${UNIT}`, 'iu'));
    return match ? centimetres(match[1], match[2]) : null;
  });
  const binding = side('inside margin|binding margin|left margin|gutter') || except;
  const other = side('right and bottom margins|outside margin|right margin') || all;
  const bottom = side('right and bottom margins|bottom margin') || all;
  const top = side('top margin') || all;
  return { top, bottom, binding, other };
}
function sentenceSpacing(lines: string[]) {
  return firstRule(lines, text => {
    if (NOT_BODY.test(text) && !/document text|body text|المتن/iu.test(text)) return null;
    if (/double[- ]spac|مسافة مزدوجة|مسافتين/iu.test(text)) return 2;
    if (/(?:1\.5|one and a half)[- ]?(?:line )?spac|مسافة ونصف|سطر ونصف/iu.test(text)) return 1.5;
    return null;
  });
}
function sentenceCitation(lines: string[]) {
  return firstRule(lines, text => {
    if (!/توثيق|التوثيق|citation|referenc/iu.test(text) || !/المعتمد|يعتمد|نظام|must|required|use|follow/iu.test(text)) return null;
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
    university_or_journal_name: matchingRule(lines, /(?:university|journal|الجامعة|المجلة)\s*[:：-]\s*([^:：]{3,100})/iu, match => match[1].trim()),
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
  };
}
