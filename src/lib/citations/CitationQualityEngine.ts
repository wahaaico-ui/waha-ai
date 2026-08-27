import type { CitationItem } from './types';

export class CitationQualityEngine {
  static assess(item: CitationItem) {
    const missing = [!item.title && 'title', !item.authors.length && 'authors', !item.year && 'year', !item.doi && !item.url && 'persistent-link'].filter(Boolean) as string[];
    const score = Math.max(0, Math.min(100, item.confidenceScore - missing.length * 12));
    return { score, missing, ready: missing.length === 0 && item.verificationStatus !== 'unverified', warning: missing.length ? `Missing bibliographic fields: ${missing.join(', ')}` : null };
  }
}
