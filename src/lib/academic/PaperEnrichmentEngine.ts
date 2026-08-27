import { withAcademicCache } from './integrations/cache';
import type { AcademicPaper } from './integrations/types';
import { CitationVerifier } from './CitationVerifier';
import { OpenCitationsService } from './services/OpenCitationsService';
import { UnpaywallService } from './services/UnpaywallService';

export class PaperEnrichmentEngine {
  static async enrich(paper: AcademicPaper): Promise<AcademicPaper> {
    return withAcademicCache(`enrich:${paper.doi || paper.id}`, 6 * 60 * 60 * 1_000, async () => {
      const [access, citations] = await Promise.allSettled([
        paper.pdfUrl ? Promise.resolve(paper.pdfUrl) : UnpaywallService.getPdfUrl(paper.doi),
        paper.doi ? OpenCitationsService.citationCount(paper.doi) : Promise.resolve(null),
      ]);
      const pdfUrl = access.status === 'fulfilled' ? access.value || paper.pdfUrl : paper.pdfUrl;
      const citationCount = citations.status === 'fulfilled' && citations.value !== null ? Math.max(paper.citationCount, citations.value) : paper.citationCount;
      const candidate: AcademicPaper = { ...paper, pdfUrl, openAccess: paper.openAccess || Boolean(pdfUrl), citationCount };
      const verification = CitationVerifier.evaluate(candidate);
      return { ...candidate, verificationStatus: verification.status, confidenceScore: verification.confidenceScore };
    });
  }

  static async enrichBatch(papers: AcademicPaper[], concurrency = 2) {
    const output: AcademicPaper[] = [];
    for (let index = 0; index < papers.length; index += concurrency) output.push(...await Promise.all(papers.slice(index, index + concurrency).map((paper) => this.enrich(paper))));
    return output;
  }
}
