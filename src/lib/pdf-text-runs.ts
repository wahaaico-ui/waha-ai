import { jsPDF } from 'jspdf';
import type { WritingMark, WritingTextRun } from '@/lib/writing-rich-text';

type BidiEngine = { doBidiReorder(text: string, map: number[], levels: number[]): string };
const NUMERAL = '[0-9٠-٩۰-۹]+';
const NUMERIC_ATOM = `${NUMERAL}(?:\\(${NUMERAL}\\))?`;
const NUMERIC_BODY = `${NUMERIC_ATOM}(?:[.,:/،٫٬–—−+%=\\s-]+${NUMERIC_ATOM})*(?:[%٪])?`;
const NUMERIC_EXPRESSION = new RegExp(`\\[${NUMERIC_BODY}\\]|\\(${NUMERIC_BODY}\\)|${NUMERIC_BODY}`, 'g');
// Reuse the Unicode bidi implementation already bundled with our jsPDF version.
// PDFKit shapes Arabic, but shaping a mixed paragraph as one RTL run reverses numbers.
function bidiRuns(text: string, visualOrder: boolean): { text: string; rtl: boolean }[] {
  if (!/\p{Script=Arabic}/u.test(text)) return [{ text, rtl: false }];
  const Engine = (jsPDF as unknown as { __bidiEngine__: new (options: Record<string, boolean>) => BidiEngine }).__bidiEngine__;
  const engine = new Engine({ isInputVisual: false, isInputRtl: /\p{Script=Arabic}/u.test(text), isOutputVisual: true, isOutputRtl: false, isSymmetricSwapping: true });
  const map: number[] = []; const levels: number[] = [];
  // Treat a numeric expression as one LTR atom while reordering. This legacy
  // bidi engine does not support Unicode isolates, and LRM alone still splits
  // Arabic-Indic page ranges. Restore every original character before drawing
  // or measuring; the PDF's ActualText also retains the original paragraph.
  let prefix = 'WAHABIDINUM';
  while (text.includes(prefix)) prefix += 'X';
  const numbers: string[] = [];
  const directional = text.replace(NUMERIC_EXPRESSION, value => `${prefix}${numbers.push(value) - 1}Z`);
  const visual = engine.doBidiReorder(directional, map, levels);
  const output = visualOrder ? visual : directional;
  const token = new RegExp(`${prefix}(\\d+)Z`, 'g');
  const runs: { text: string; rtl: boolean }[] = [];
  let start = 0;
  while (start < output.length) {
    const level = levels[visualOrder ? map[start] : start] ?? 0;
    let end = start + 1;
    while (end < output.length && (levels[visualOrder ? map[end] : end] ?? 0) === level) end += 1;
    const run = output.slice(start, end);
    const shaped = visualOrder && level % 2 && /\p{Script=Arabic}/u.test(run) ? [...run].reverse().join('') : run;
    runs.push({ text: shaped.replace(token, (_match, index) => numbers[Number(index)]), rtl: Boolean(level % 2) });
    start = end;
  }
  return runs;
}
export function pdfVisualRuns(text: string): string[] { return bidiRuns(text, true).map(run => run.text); }
/** Word already reorders paragraphs. Retain logical order and mark only the
 * individual runs; marking the whole paragraph's run RTL reverses page ranges. */
export function documentLogicalRuns(text: string) { return bidiRuns(text, false); }

/** Carry formatting through the same numeric-safe bidi transformation. Map
 * every restored character to its original position instead of finding equal
 * words (which would attach formatting to the wrong repeated occurrence). */
export function pdfVisualStyledRuns(input: WritingTextRun[], withPositions = false): Array<WritingTextRun & { sourceStart?: number }> {
  const text = input.map(run => run.text).join('');
  if (!/\p{Script=Arabic}/u.test(text)) {
    let offset = 0;
    return input.map(run => { const result = withPositions ? { ...run, sourceStart: offset } : run; offset += run.text.length; return result; });
  }
  const marksAt: (WritingMark[] | undefined)[] = input.flatMap(run => Array.from({ length: run.text.length }, () => run.marks));
  let prefix = 'WAHABIDISTYLE'; while (text.includes(prefix)) prefix += 'X';
  const numbers: { text: string; start: number }[] = []; const original: number[] = [];
  let directional = '', last = 0;
  const append = (value: string, start: number, atomic = false) => { directional += value; for (let i = 0; i < value.length; i++) original.push(start + (atomic ? 0 : i)); };
  for (const match of text.matchAll(NUMERIC_EXPRESSION)) {
    append(text.slice(last, match.index), last);
    const token = `${prefix}${numbers.length}Z`; numbers.push({ text: match[0], start: match.index }); append(token, match.index, true); last = match.index + match[0].length;
  }
  append(text.slice(last), last);
  const Engine = (jsPDF as unknown as { __bidiEngine__: new (options: Record<string, boolean>) => BidiEngine }).__bidiEngine__;
  const engine = new Engine({ isInputVisual: false, isInputRtl: true, isOutputVisual: true, isOutputRtl: false, isSymmetricSwapping: true });
  const map: number[] = [], levels: number[] = [];
  const visual = engine.doBidiReorder(directional, map, levels);
  const output: Array<WritingTextRun & { sourceStart?: number }> = []; let mergeFrom = 0;
  const push = (value: string, position: number) => {
    const marks = marksAt[position]; const previous = output[output.length - 1];
    if (previous && output.length > mergeFrom && JSON.stringify(previous.marks) === JSON.stringify(marks)) {
      previous.text += value;
      if (withPositions) previous.sourceStart = Math.min(previous.sourceStart ?? position, position);
    } else output.push({ text: value, ...(marks?.length ? { marks } : {}), ...(withPositions ? { sourceStart: position } : {}) });
  };
  let start = 0;
  while (start < visual.length) {
    mergeFrom = output.length;
    const level = levels[map[start]] ?? 0; let end = start + 1;
    while (end < visual.length && (levels[map[end]] ?? 0) === level) end++;
    const run = visual.slice(start, end); let offset = start;
    let chars = Array.from(run, character => { const value = { text: character, index: original[map[offset]] }; offset += character.length; return value; });
    if (level % 2 && /\p{Script=Arabic}/u.test(run)) chars = chars.reverse();
    const shaped = chars.map(c => c.text).join(''); let at = 0, unit = 0;
    const tokens = new RegExp(`${prefix}(\\d+)Z`, 'g');
    for (const match of shaped.matchAll(tokens)) {
      while (unit < match.index) { const c = chars[at++]; push(c.text, c.index); unit += c.text.length; }
      const number = numbers[Number(match[1])]; let local = 0;
      for (const character of number.text) { push(character, number.start + local); local += character.length; }
      const finish = match.index + match[0].length;
      while (unit < finish) { unit += chars[at++].text.length; }
    }
    while (at < chars.length) { const c = chars[at++]; push(c.text, c.index); }
    // Each Arabic span is still logically ordered for font shaping. When a
    // style splits one RTL run, paint its spans from the visual left edge.
    if (level % 2 && /\p{Script=Arabic}/u.test(run)) output.splice(mergeFrom, output.length - mergeFrom, ...output.slice(mergeFrom).reverse());
    start = end;
  }
  return output;
}
