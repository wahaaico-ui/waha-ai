import { withAcademicCache } from './integrations/cache';
import type { AcademicPaper } from './integrations/types';
import { providerObservationsOf } from './integrations/normalization';
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
      const openCitations = citations.status === 'fulfilled' && citations.value !== null ? citations.value : null;
      const citationCount = openCitations !== null ? Math.max(paper.citationCount, openCitations) : paper.citationCount;
      // Enriched values keep their source: an open-access link found by
      // Unpaywall and OpenCitations' count are recorded as such, not merged
      // into a provider's values.
      const unpaywallLink = !paper.pdfUrl && Boolean(pdfUrl);
      // A failed request is an error; an empty answer is "not reported", never
      // a finding that the work is closed or uncited.
      const outcome = (result: PromiseSettledResult<unknown>, value: unknown) => result.status === 'rejected'
        ? { status: 'error' as const, errorCode: result.reason instanceof Error ? result.reason.message.slice(0, 100) : 'request_failed' }
        : { status: value === null || value === undefined ? 'not_reported' as const : 'reported' as const };
      const candidate: AcademicPaper = {
        ...paper, pdfUrl, openAccess: paper.openAccess || Boolean(pdfUrl), citationCount,
        citationCounts: { ...(paper.citationCounts || { [paper.source]: paper.citationCount }), ...(openCitations !== null ? { opencitations: openCitations } : {}) },
        fieldProvenance: { ...(paper.fieldProvenance || {}), ...(unpaywallLink ? { pdfUrl: ['unpaywall'] } : {}) },
        providerObservations: {
          ...providerObservationsOf(paper),
          ...(!paper.pdfUrl && access.status === 'fulfilled' && access.value ? { unpaywall: { oaUrl: access.value } } : {}),
          ...(openCitations !== null ? { opencitations: { citationCount: openCitations } } : {}),
        },
        enrichmentOutcomes: {
          // Unpaywall is asked only when the record has no link and a DOI.
          ...(!paper.pdfUrl && paper.doi ? { unpaywall: outcome(access, access.status === 'fulfilled' ? access.value : null) } : {}),
          ...(paper.doi ? { opencitations: outcome(citations, openCitations) } : {}),
        },
      };
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
