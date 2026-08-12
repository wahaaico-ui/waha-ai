// @ts-nocheck
import { OpenAlexProvider } from "./OpenAlexProvider";
import { CrossrefProvider } from "./CrossrefProvider";
import { ResearchSimilarity } from "./ResearchSimilarity";

export interface EvidenceReference {
  title?: string;
  doi?: string;
  publicationYear?: number | null;
  authors?: string;
  source?: string;
}

export interface EvidenceReport {
  similarity: number;
  papersFound: number;
  recentReferences: EvidenceReference[];
  keywords: string[];
}

export class EvidenceAggregator {
  private crossref = new CrossrefProvider();
  private similarityCalculator = new ResearchSimilarity();

  public async aggregateEvidence(ideaText: string): Promise<EvidenceReport> {
    if (!ideaText || ideaText.trim().length === 0) {
      return { similarity: 0, papersFound: 0, recentReferences: [], keywords: [] };
    }
    const [openAlexResults, crossrefResults] = await Promise.all([
      OpenAlexProvider.searchWorks(ideaText),
      this.crossref.queryMetadata(ideaText)
    ]);
    const mergedPapers: EvidenceReference[] = [];
    const seenDois = new Set<string>();
    const addPaper = (paper: EvidenceReference, source: string) => {
      const cleanDoi = paper.doi?.trim().toLowerCase();
      if (cleanDoi && cleanDoi !== "no doi available" && seenDois.has(cleanDoi)) return;
      if (cleanDoi && cleanDoi !== "no doi available") seenDois.add(cleanDoi);
      mergedPapers.push({ title: paper.title, doi: paper.doi, publicationYear: paper.publicationYear || new Date().getFullYear(), authors: paper.authors, source });
    };
    openAlexResults.forEach(p => addPaper(p, "OpenAlex"));
    crossrefResults.forEach(p => addPaper(p, "Crossref"));
    const { similarityScore, topKeywords } = this.similarityCalculator.calculateSimilarity(ideaText, mergedPapers);
    const sortedReferences = mergedPapers
      .slice()
      .sort((a, b) => ((b.publicationYear ?? 0) - (a.publicationYear ?? 0)))
      .slice(0, 8);
    return {
      similarity: similarityScore,
      papersFound: mergedPapers.length,
      recentReferences: sortedReferences,
      keywords: topKeywords.length > 0 ? topKeywords : ["بحث علمي"]
    };
  }
}
