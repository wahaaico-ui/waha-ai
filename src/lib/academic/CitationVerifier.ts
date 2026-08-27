import { CrossrefService } from './services/CrossrefService';
import type { AcademicPaper, EvidenceVerificationStatus } from './integrations/types';
import { normaliseDoi, normaliseTitle } from './integrations/normalization';

export type CitationVerification = { status: EvidenceVerificationStatus; confidenceScore: number; matchedBy: 'doi' | 'metadata' | 'none'; checks: Array<{ field: string; passed: boolean; note: string }> };

function tokenSimilarity(first: string, second: string) {
  const a = new Set(normaliseTitle(first).split(' ').filter((token) => token.length > 2));
  const b = new Set(normaliseTitle(second).split(' ').filter((token) => token.length > 2));
  return [...a].filter((token) => b.has(token)).length / Math.max(1, new Set([...a, ...b]).size);
}

export class CitationVerifier {
  static evaluate(paper: AcademicPaper): CitationVerification {
    const sourceCount = new Set(paper.sources).size;
    const hasIdentifier = Boolean(normaliseDoi(paper.doi) || paper.pmid || paper.arxivId);
    const metadataFields = [paper.title, paper.authors.length, paper.year, paper.journal || paper.containerTitle, paper.publisher].filter(Boolean).length;
    const confidenceScore = Math.min(100, 20 + sourceCount * 18 + Number(hasIdentifier) * 22 + metadataFields * 4);
    const status: EvidenceVerificationStatus = sourceCount >= 2 && hasIdentifier ? 'verified' : sourceCount >= 2 ? 'cross-checked' : hasIdentifier ? 'partially-verified' : 'unverified';
    return { status, confidenceScore, matchedBy: normaliseDoi(paper.doi) ? 'doi' : sourceCount >= 2 ? 'metadata' : 'none', checks: [
      { field: 'identifier', passed: hasIdentifier, note: hasIdentifier ? 'Persistent identifier is present.' : 'No DOI, PMID or arXiv identifier is available.' },
      { field: 'independent-sources', passed: sourceCount >= 2, note: `${sourceCount} independent source${sourceCount === 1 ? '' : 's'} supplied this record.` },
      { field: 'bibliographic-metadata', passed: metadataFields >= 3, note: `${metadataFields} core bibliographic fields are present.` },
    ] };
  }

  static async verifyAgainstCrossref(paper: AcademicPaper): Promise<CitationVerification> {
    const local = this.evaluate(paper);
    try {
      const candidates = await CrossrefService.searchWorks(paper.doi || paper.title, 5);
      const doi = normaliseDoi(paper.doi);
      const match = candidates.find((candidate) => doi && normaliseDoi(candidate.doi) === doi)
        || candidates.find((candidate) => tokenSimilarity(candidate.title, paper.title) >= 0.78 && (!paper.year || !candidate.year || Math.abs(candidate.year - paper.year) <= 1));
      if (!match) return local;
      const titleMatches = tokenSimilarity(match.title, paper.title) >= 0.78;
      const yearMatches = !paper.year || !match.year || Math.abs(match.year - paper.year) <= 1;
      return { status: titleMatches && yearMatches ? 'verified' : 'partially-verified', confidenceScore: Math.max(local.confidenceScore, titleMatches && yearMatches ? 92 : 68), matchedBy: doi && normaliseDoi(match.doi) === doi ? 'doi' : 'metadata', checks: [...local.checks, { field: 'crossref-record', passed: true, note: 'A matching Crossref record was found.' }, { field: 'title', passed: titleMatches, note: titleMatches ? 'Title metadata agrees.' : 'Title metadata needs review.' }, { field: 'year', passed: yearMatches, note: yearMatches ? 'Publication year agrees.' : 'Publication year needs review.' }] };
    } catch { return local; }
  }
}
