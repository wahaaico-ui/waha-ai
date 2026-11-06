/**
 * Word-for-word overlap between a researcher's text and sources the platform
 * can read. Pure and deterministic: no model, no score beyond what is counted.
 */

/** Runs of this many shared words count as a match (common in overlap checkers). */
export const SHINGLE_SIZE = 7;

export type OverlapOrigin = 'project-pdf' | 'project-reference' | 'open-source';

export type OverlapSource = {
  id: string;
  origin: OverlapOrigin;
  title: string;
  url: string | null;
  year: number | null;
  text: string;
};

export type Token = { word: string; start: number; end: number };

export type OverlapMatch = { sourceId: string; origin: OverlapOrigin; title: string; url: string | null; year: number | null };

export type OverlapPassage = {
  /** Character range in the original text. */
  start: number;
  end: number;
  text: string;
  wordCount: number;
  matches: OverlapMatch[];
};

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Comparison form of one word: Arabic letter variants unified, Latin lower-cased. */
export function normaliseWord(word: string): string {
  return word
    .normalize('NFKC')
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(NON_WORD, '');
}

/** Words with their character ranges; punctuation-only fragments are dropped. */
export function tokenise(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const word = normaliseWord(match[0]);
    if (word) tokens.push({ word, start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function shingleKeys(words: string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) keys.push(words.slice(i, i + SHINGLE_SIZE).join(' '));
  return keys;
}

/**
 * Passages of `text` that share at least one SHINGLE_SIZE-word run with a
 * source. Overlapping runs merge into one passage; each passage lists every
 * source it was found in.
 */
export function findOverlaps(text: string, sources: OverlapSource[]): OverlapPassage[] {
  const tokens = tokenise(text);
  if (tokens.length < SHINGLE_SIZE || !sources.length) return [];
  const draftKeys = shingleKeys(tokens.map(t => t.word));

  // For each draft shingle position, the sources that contain it.
  const hits: Array<Set<number> | undefined> = new Array(draftKeys.length);
  sources.forEach((source, sourceIndex) => {
    const keys = new Set(shingleKeys(tokenise(source.text).map(t => t.word)));
    draftKeys.forEach((key, position) => {
      if (keys.has(key)) (hits[position] ??= new Set()).add(sourceIndex);
    });
  });

  const passages: OverlapPassage[] = [];
  let position = 0;
  while (position < draftKeys.length) {
    if (!hits[position]) { position++; continue; }
    const firstWord = position;
    const found = new Set<number>();
    let lastWord = position + SHINGLE_SIZE - 1;
    // Extend while the next shingle also matches (adjacent or overlapping runs).
    while (position < draftKeys.length && hits[position] && position <= lastWord + 1) {
      hits[position]!.forEach(index => found.add(index));
      lastWord = Math.max(lastWord, position + SHINGLE_SIZE - 1);
      position++;
    }
    const start = tokens[firstWord].start, end = tokens[lastWord].end;
    passages.push({
      start, end, text: text.slice(start, end), wordCount: lastWord - firstWord + 1,
      matches: [...found].sort((a, b) => a - b).map(index => {
        const { id, origin, title, url, year } = sources[index];
        return { sourceId: id, origin, title, url, year };
      }),
    });
  }
  return passages;
}
