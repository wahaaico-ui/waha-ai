export type DocumentDirection = 'rtl' | 'ltr';

/** Infer the manuscript's primary script, independently of translated UI labels. */
export function inferDocumentDirection(text: string): DocumentDirection {
  let arabic = 0, latin = 0;
  let first: DocumentDirection | undefined;
  for (const character of text) {
    if (!/\p{Letter}/u.test(character)) continue;
    if (/\p{Script=Arabic}/u.test(character)) { arabic++; first ??= 'rtl'; }
    else if (/\p{Script=Latin}/u.test(character)) { latin++; first ??= 'ltr'; }
  }
  return arabic === latin ? first || 'ltr' : arabic > latin ? 'rtl' : 'ltr';
}
