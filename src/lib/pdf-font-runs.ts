import arabicCoverage from './pdf-arabic-font-coverage.json';

export type PdfFontName = 'Amiri' | 'NotoNaskhArabicExtended' | 'NotoSans' | 'NotoSansMath' | 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique' | 'Helvetica-BoldOblique';
const searchableArabicCoverage = new Set(arabicCoverage);

type FontkitFace = { layout: (text: string, features?: unknown, script?: string, language?: string, direction?: string) => unknown };

/** PDFKit does not expose fontkit's direction argument. Pin only isolated
 * Arabic-Indic numeric spans to LTR; letter spans retain normal shaping.
 * This adapter is covered by generated-PDF extraction tests for PDFKit 0.20.2. */
export function preservePdfNumericDirection(document: PDFKit.PDFDocument) {
  const configured = new Set<FontkitFace>();
  for (const name of ['Amiri', 'NotoNaskhArabicExtended', 'NotoSansMath']) {
    document.font(name);
    const face = (document as unknown as { _font: { font: FontkitFace } })._font?.font;
    if (!face || typeof face.layout !== 'function') throw new Error('PDF font layout is unavailable');
    if (configured.has(face)) continue;
    configured.add(face);
    const layout = face.layout.bind(face);
    face.layout = (text, features, script, language, direction) => layout(text, features, script, language,
      /[٠-٩۰-۹]/u.test(text) && !/\p{Letter}/u.test(text) ? 'ltr' : direction);
  }
}

/** Input is one visual bidi span, with Arabic characters still in logical order
 * for shaping. Split only for font coverage and preserve that span's direction. */
export function pdfFontRuns(text: string, base: PdfFontName, sourceStart?: number): Array<{ text: string; font: PdfFontName; sourceStart?: number }> {
  // Keep an entire Arabic span on the original font if it needs newer script
  // characters, so switching fonts cannot break joining within a word.
  const arabicBase = base === 'Amiri' && [...text].some(character =>
    /\p{Script=Arabic}/u.test(character) && !searchableArabicCoverage.has(character.codePointAt(0)!))
    ? 'NotoNaskhArabicExtended' : base;
  const runs: Array<{text:string;font:PdfFontName;sourceStart?:number}> = [];
  let offset = 0;
  for (const character of text) {
    const font = /\p{Sm}/u.test(character) ? 'NotoSansMath'
      : /[\p{Script=Greek}\u2070-\u209f\u00b2\u00b3\u00b9]/u.test(character) ? 'NotoSans' : arabicBase;
    const prior = runs.at(-1);
    if (prior?.font === font && character !== '٪' && !prior.text.endsWith('٪')) prior.text += character;
    else runs.push({text:character,font,...(sourceStart === undefined ? {} : {sourceStart:sourceStart + offset})});
    offset += character.length;
  }
  // As with style changes inside an RTL span, paint its font spans from the
  // visual left edge while each Arabic span remains logical for fontkit.
  return [...text].some(character => /\p{Script=Arabic}/u.test(character) && /\p{Letter}/u.test(character)) ? runs.reverse() : runs;
}

/** Place visual spans first, then emit their PDF text in original reading
 * order. Coordinates stay unchanged; extraction no longer reverses styled
 * words or moves a mixed-language citation ahead of its Arabic sentence. */
export function pdfReadingOrderRuns<T extends { sourceStart?: number }>(runs: T[], x: number, width: (run: T) => number) {
  return runs.map(run => { const result = { ...run, x }; x += width(run); return result; })
    .sort((a, b) => (a.sourceStart ?? 0) - (b.sourceStart ?? 0));
}

/** PDFKit 0.20.2/fontkit can add shaping glyphs with no source code points.
 * Its CMap writer serializes those as <>, which some PDF readers reject for
 * the whole range. Map only these non-text glyphs to a zero-width separator;
 * keep every valid mapping and the original paragraph's ActualText intact.
 * Guard the internal boundary and cover it with actual generated PDF tests. */
export function completePdfUnicodeMappings(document: unknown) {
  const fonts = (document as { _fontFamilies?: Record<string,{unicode?:unknown}> })._fontFamilies;
  if (!fonts) return;
  for (const font of new Set(Object.values(fonts))) {
    if (!Array.isArray(font.unicode)) continue;
    for (let index=0; index<font.unicode.length; index++) {
      if (Array.isArray(font.unicode[index]) && font.unicode[index].length===0) font.unicode[index]=[0x200b];
    }
  }
}
