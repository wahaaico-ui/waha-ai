import { SemanticScholarProvider } from '@/lib/evidence/SemanticScholarProvider';
import { OpenAlexResearchService } from '@/services/openalex.service';
import { ResearchAggregatorService } from '@/services/research-aggregator.service';
import { ResearchIntelligenceService } from '@/services/research-intelligence.service';
import { ResearchGapService } from '@/services/research-gap.service';
import type { AcademicThinkingResult } from '@/services/academic-thinking.service';
import type { ResearchAggregation } from '@/types/ResearchAggregation';
import type { ResearchContext } from '@/types/ResearchContext';
import type { ResearchIntelligence } from '@/types/ResearchIntelligence';
import type { ResearchGapReport } from '@/types/ResearchGapReport';

export interface ResearchPipelineResult {
  context: ResearchContext;
  research: ResearchAggregation;
  intelligence: ResearchIntelligence;
  gap: ResearchGapReport;
}

export class ResearchPipelineService {
  static async search(
    ideaText: string,
    limit: number,
    academicThinking: AcademicThinkingResult
  ): Promise<ResearchPipelineResult> {
    const context = await OpenAlexResearchService.queryResearchEvidence(ideaText, limit);
    const query = this.semanticScholarQuery(context);
    const semanticScholar = await SemanticScholarProvider.searchPapers(query, limit);
    const research = ResearchAggregatorService.merge(context.papers, semanticScholar, query);
    const intelligence = ResearchIntelligenceService.calculate(research);
    const globalPaperCount = Math.max(
      context.retrieval.totalAvailable,
      research.semanticScholar.totalAvailable,
      research.mergedTotalPapers
    );
    const gap = ResearchGapService.calculate(
      research,
      intelligence,
      academicThinking,
      globalPaperCount
    );

    return { context, research, intelligence, gap };
  }

  private static semanticScholarQuery(context: ResearchContext): string {
    if (context.retrieval.effectiveQuery) return context.retrieval.effectiveQuery;

    const translatedAttempt = context.retrieval.attempts.find(
      attempt => attempt.strategy === 'dictionary' || attempt.strategy === 'core-dictionary'
    );
    return translatedAttempt?.query ?? context.generatedQueries[0] ?? context.originalIdea;
  }
}
