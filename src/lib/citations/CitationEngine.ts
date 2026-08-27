import { CitationFormatter } from './CitationFormatter';
import { CitationVerifier } from './CitationVerifier';
import type { CitationItem, CitationStyle, StructuredCitation } from './types';

export class CitationEngine {
  static create(item: CitationItem, style: CitationStyle, options: { number?: number; locator?: string | null; context?: string | null } = {}): StructuredCitation {
    const number = options.number || 1;
    const verification = CitationVerifier.verify(item);
    return {
      id: crypto.randomUUID(), itemId: item.id, style,
      inText: CitationFormatter.inText(item, style, number, options.locator),
      bibliography: CitationFormatter.bibliography(item, style, number),
      locator: options.locator || null, context: options.context || null,
      verificationStatus: verification.status, confidenceScore: verification.confidenceScore,
      insertedAt: new Date().toISOString(),
    };
  }
}
