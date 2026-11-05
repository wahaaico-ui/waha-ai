import { buildSourceBibliography } from './writing-citations';
import { citationItemKey, citationItemSource } from './citation-item-source';
import type { CitationItem, CitationStyle } from './types';

export class BibliographyEngine {
  static build(items: CitationItem[], style: CitationStyle) {
    const unique = new Map<string, CitationItem>();
    for (const item of items) if (!unique.has(citationItemKey(item))) unique.set(citationItemKey(item), item);
    const plan = buildSourceBibliography([...unique.values()].map(citationItemSource), style);
    return plan.bibliography.map((entry, index) => ({ itemId: unique.get(entry.sourceKeys[0])!.id, number: index + 1, text: entry.text }));
  }
}
