import type { CitationItem } from './types';
import { CitationQualityEngine } from './CitationQualityEngine';

export class CitationVerifier {
  static verify(item: CitationItem) {
    const quality = CitationQualityEngine.assess(item);
    return { verified: quality.ready, status: item.verificationStatus, confidenceScore: quality.score, warnings: quality.warning ? [quality.warning] : [] };
  }
}
