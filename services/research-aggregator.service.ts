import type { ResearchEvidence } from '@/types/OpenAlex';
import type {
  ResearchAggregation,
  ResearchSource,
  UnifiedResearchPaper,
} from '@/types/ResearchAggregation';
import type { SemanticScholarPaper, SemanticScholarSearchResult } from '@/types/SemanticScholar';

export class ResearchAggregatorService {
  static merge(
    openAlexPapers: ResearchEvidence[],
    semanticScholarResult: SemanticScholarSearchResult,
    semanticScholarQuery: string
  ): ResearchAggregation {
    const openAlex = openAlexPapers.map(this.fromOpenAlex);
    const semanticScholar = semanticScholarResult.ok
      ? semanticScholarResult.papers.map(this.fromSemanticScholar)
      : [];
    const merged: UnifiedResearchPaper[] = [];
    const doiIndex = new Map<string, number>();
    const titleIndex = new Map<string, number>();
    let duplicatesRemoved = 0;

    for (const paper of [...openAlex, ...semanticScholar]) {
      const doiKey = this.normalizeDoi(paper.doi);
      const titleKey = this.normalizeTitle(paper.title);
      let duplicateIndex = doiKey ? doiIndex.get(doiKey) : undefined;

      if (duplicateIndex === undefined && titleKey) {
        const titleMatch = titleIndex.get(titleKey);
        if (titleMatch !== undefined) {
          const existing = merged[titleMatch];
          if (!doiKey || !this.normalizeDoi(existing.doi)) duplicateIndex = titleMatch;
        }
      }

      if (duplicateIndex !== undefined) {
        merged[duplicateIndex] = this.combine(merged[duplicateIndex], paper);
        duplicatesRemoved += 1;
        continue;
      }

      const index = merged.push(paper) - 1;
      if (doiKey) doiIndex.set(doiKey, index);
      if (titleKey) titleIndex.set(titleKey, index);
    }

    merged.sort((a, b) => b.citationCount - a.citationCount || a.title.localeCompare(b.title));
    const sources = new Set<ResearchSource>();
    for (const paper of merged) sources.add(paper.source);

    return {
      papers: merged,
      openAlexPapers: openAlex.length,
      semanticScholarPapers: semanticScholar.length,
      mergedTotalPapers: merged.length,
      duplicatesRemoved,
      searchSources: [...sources],
      semanticScholar: {
        success: semanticScholarResult.ok,
        query: semanticScholarQuery,
        totalAvailable: semanticScholarResult.ok ? semanticScholarResult.totalAvailable : 0,
        ...(!semanticScholarResult.ok ? { error: semanticScholarResult.failure } : {}),
      },
    };
  }

  private static fromOpenAlex(paper: ResearchEvidence): UnifiedResearchPaper {
    return {
      title: paper.title,
      publicationYear: paper.publicationYear,
      doi: paper.doi,
      citationCount: paper.citationCount,
      referenceCount: null,
      journal: paper.journal,
      authors: paper.authors,
      abstract: paper.abstract,
      concepts: paper.concepts,
      countries: paper.countries,
      url: paper.openalexUrl,
      openalexId: paper.openalexId,
      semanticScholarId: null,
      source: 'openalex',
    };
  }

  private static fromSemanticScholar(paper: SemanticScholarPaper): UnifiedResearchPaper {
    return {
      title: paper.title,
      publicationYear: paper.publicationYear,
      doi: paper.doi,
      citationCount: paper.citationCount,
      referenceCount: paper.referenceCount,
      journal: paper.venue,
      authors: paper.authors.map(author => author.name),
      abstract: paper.abstract,
      concepts: paper.fieldsOfStudy,
      countries: [],
      url: paper.url,
      openalexId: null,
      semanticScholarId: paper.paperId,
      source: 'semantic-scholar',
    };
  }

  private static combine(
    first: UnifiedResearchPaper,
    second: UnifiedResearchPaper
  ): UnifiedResearchPaper {
    return {
      title: first.title || second.title,
      publicationYear: first.publicationYear ?? second.publicationYear,
      doi: first.doi ?? second.doi,
      citationCount: Math.max(first.citationCount, second.citationCount),
      referenceCount: first.referenceCount ?? second.referenceCount,
      journal: first.journal ?? second.journal,
      authors: first.authors.length >= second.authors.length ? first.authors : second.authors,
      abstract: first.abstract ?? second.abstract,
      concepts: [...new Set([...first.concepts, ...second.concepts])],
      countries: [...new Set([...first.countries, ...second.countries])],
      url: first.url ?? second.url,
      openalexId: first.openalexId ?? second.openalexId,
      semanticScholarId: first.semanticScholarId ?? second.semanticScholarId,
      source: 'both',
    };
  }

  private static normalizeDoi(doi: string | null): string | null {
    if (!doi) return null;
    const normalized = doi
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
      .replace(/^doi:\s*/, '');
    return normalized || null;
  }

  private static normalizeTitle(title: string): string {
    return title
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }
}

