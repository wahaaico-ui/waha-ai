import type { CitationItem, CitationStyle } from './types';
import { citationItemSource } from './citation-item-source';
import { buildSourceBibliography, formatSourceCitation } from './writing-citations';

const validNumber = (number: number) => Number.isSafeInteger(number) && number > 0 ? number : 1;

/** Citation APIs, the library and evidence writing share the CSL styles. */
export class CitationFormatter {
  static bibliography(item: CitationItem, style: CitationStyle, number = 1) {
    const text = buildSourceBibliography([citationItemSource(item)], style).bibliography[0]?.text || '';
    if (style === 'ieee') return text.replace(/^\[1\]/, `[${validNumber(number)}]`);
    if (style === 'vancouver') return text.replace(/^1\./, `${validNumber(number)}.`);
    return text;
  }

  static inText(item: CitationItem, style: CitationStyle, number = 1, locator?: string | null) {
    const text = formatSourceCitation(citationItemSource(item), style, locator);
    return style === 'ieee' || style === 'vancouver' ? text.replace(/(^|\D)1(?=\D|$)/, (_match, prefix) => `${prefix}${validNumber(number)}`) : text;
  }
}
