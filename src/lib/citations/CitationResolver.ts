import type { AcademicPaper } from '@/lib/academic/integrations/types';
import { CitationVerifier as AcademicCitationVerifier } from '@/lib/academic/CitationVerifier';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import type { CitationItem } from './types';

export class CitationResolver {
  static fromPaper(paper: AcademicPaper): CitationItem {
    const verification = AcademicCitationVerifier.evaluate(paper);
    return {
      id: normaliseDoi(paper.doi) || paper.pmid || paper.arxivId || paper.id,
      title: paper.title,
      authors: paper.authors,
      year: paper.year || null,
      journal: paper.journal || paper.containerTitle || null,
      publisher: paper.publisher || null,
      volume: paper.volume || null,
      issue: paper.issue || null,
      pages: paper.pages || null,
      doi: normaliseDoi(paper.doi),
      url: paper.url || paper.pdfUrl,
      type: paper.publicationType || 'article',
      verificationStatus: paper.verificationStatus || verification.status,
      confidenceScore: paper.confidenceScore || verification.confidenceScore,
      provenance: paper.sources,
    };
  }
}
