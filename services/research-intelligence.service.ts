import type { ResearchAggregation, UnifiedResearchPaper } from '@/types/ResearchAggregation';
import type {
  CitationStrength,
  IntelligenceRankedValue,
  IntelligenceTimelinePoint,
  ResearchActivity,
  ResearchDataQuality,
  ResearchIntelligence,
  TopicMaturity,
} from '@/types/ResearchIntelligence';

export class ResearchIntelligenceService {
  static calculate(aggregation: ResearchAggregation): ResearchIntelligence {
    const papers = Array.isArray(aggregation.papers) ? aggregation.papers.filter(Boolean) : [];
    const years = papers
      .map(paper => paper.publicationYear)
      .filter((year): year is number => typeof year === 'number' && Number.isFinite(year));
    const citations = papers.map(paper => this.validCount(paper.citationCount));
    const totalCitationCount = citations.reduce((sum, count) => sum + count, 0);
    const latestPublicationYear = years.length > 0 ? Math.max(...years) : null;

    return {
      totalPapers: papers.length,
      latestPublicationYear,
      oldestPublicationYear: years.length > 0 ? Math.min(...years) : null,
      averagePublicationYear: this.average(years),
      totalCitationCount,
      averageCitationCount: papers.length > 0
        ? this.round(totalCitationCount / papers.length)
        : null,
      mostCitedPaper: this.mostCited(papers),
      topJournals: this.rank(papers, paper => (paper.journal ? [paper.journal] : []), 5),
      topCountries: this.rank(papers, paper => paper.countries, 5),
      topConcepts: this.rank(papers, paper => paper.concepts, 10),
      publicationTimeline: this.timeline(years),
      topicMaturity: this.topicMaturity(papers.length),
      citationStrength: this.citationStrength(
        papers.length > 0 ? totalCitationCount / papers.length : 0
      ),
      researchActivity: this.researchActivity(latestPublicationYear),
      dataQuality: this.dataQuality(papers),
    };
  }

  private static topicMaturity(totalPapers: number): TopicMaturity {
    if (totalPapers > 100_000) return 'Mature';
    if (totalPapers >= 10_000) return 'Growing';
    return 'Emerging';
  }

  private static citationStrength(averageCitations: number): CitationStrength {
    if (averageCitations > 1_000) return 'Very High';
    if (averageCitations >= 300) return 'High';
    if (averageCitations >= 100) return 'Medium';
    return 'Low';
  }

  private static researchActivity(latestYear: number | null): ResearchActivity {
    if (latestYear !== null && latestYear >= 2026) return 'Very Active';
    if (latestYear === 2025) return 'Active';
    if (latestYear === 2024) return 'Moderate';
    return 'Weak';
  }

  private static mostCited(papers: UnifiedResearchPaper[]): UnifiedResearchPaper | null {
    if (papers.length === 0) return null;

    return papers.reduce((highest, paper) =>
      this.validCount(paper.citationCount) > this.validCount(highest.citationCount)
        ? paper
        : highest
    );
  }

  private static rank(
    papers: UnifiedResearchPaper[],
    valuesOf: (paper: UnifiedResearchPaper) => string[],
    limit: number
  ): IntelligenceRankedValue[] {
    const counts = new Map<string, { name: string; count: number }>();

    for (const paper of papers) {
      const seen = new Set<string>();
      for (const rawValue of valuesOf(paper) ?? []) {
        const name = rawValue?.trim();
        if (!name) continue;
        const key = name.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const current = counts.get(key);
        if (current) current.count += 1;
        else counts.set(key, { name, count: 1 });
      }
    }

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  private static timeline(years: number[]): IntelligenceTimelinePoint[] {
    const counts = new Map<number, number>();
    for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);

    return [...counts.entries()]
      .sort(([yearA], [yearB]) => yearA - yearB)
      .map(([year, count]) => ({ year, count }));
  }

  private static dataQuality(papers: UnifiedResearchPaper[]): ResearchDataQuality {
    if (papers.length === 0) {
      return {
        missingDoiPercentage: 0,
        missingAbstractPercentage: 0,
        missingJournalPercentage: 0,
        missingCountryPercentage: 0,
      };
    }

    return {
      missingDoiPercentage: this.percentage(papers.filter(paper => !paper.doi?.trim()).length, papers.length),
      missingAbstractPercentage: this.percentage(
        papers.filter(paper => !paper.abstract?.trim()).length,
        papers.length
      ),
      missingJournalPercentage: this.percentage(
        papers.filter(paper => !paper.journal?.trim()).length,
        papers.length
      ),
      missingCountryPercentage: this.percentage(
        papers.filter(paper => !paper.countries.some(country => country?.trim())).length,
        papers.length
      ),
    };
  }

  private static average(values: number[]): number | null {
    if (values.length === 0) return null;
    return this.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private static percentage(missing: number, total: number): number {
    return this.round((missing / total) * 100);
  }

  private static validCount(value: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  }

  private static round(value: number): number {
    return Math.round(value * 10) / 10;
  }
}

