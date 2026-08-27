import { CitationFormatter } from './CitationFormatter';
import type { CitationItem, CitationStyle } from './types';

export class BibliographyEngine {
  static build(items: CitationItem[], style: CitationStyle) {
    const unique = [...new Map(items.map((item) => [item.doi || item.id, item])).values()];
    const sorted = style === 'ieee' || style === 'vancouver' ? unique : unique.sort((a, b) => (a.authors[0] || a.title).localeCompare(b.authors[0] || b.title));
    return sorted.map((item, index) => ({ itemId: item.id, number: index + 1, text: CitationFormatter.bibliography(item, style, index + 1) }));
  }
}
