import type { UnifiedResearchPaper } from '@/types/ResearchAggregation';

export interface IntelligenceRankedValue {
  name: string;
  count: number;
}

export interface IntelligenceTimelinePoint {
  year: number;
  count: number;
}

export type TopicMaturity = 'Mature' | 'Growing' | 'Emerging';
export type CitationStrength = 'Very High' | 'High' | 'Medium' | 'Low';
export type ResearchActivity = 'Very Active' | 'Active' | 'Moderate' | 'Weak';

export interface ResearchDataQuality {
  missingDoiPercentage: number;
  missingAbstractPercentage: number;
  missingJournalPercentage: number;
  missingCountryPercentage: number;
}

export interface ResearchIntelligence {
  totalPapers: number;
  latestPublicationYear: number | null;
  oldestPublicationYear: number | null;
  averagePublicationYear: number | null;
  totalCitationCount: number;
  averageCitationCount: number | null;
  mostCitedPaper: UnifiedResearchPaper | null;
  topJournals: IntelligenceRankedValue[];
  topCountries: IntelligenceRankedValue[];
  topConcepts: IntelligenceRankedValue[];
  publicationTimeline: IntelligenceTimelinePoint[];
  topicMaturity: TopicMaturity;
  citationStrength: CitationStrength;
  researchActivity: ResearchActivity;
  dataQuality: ResearchDataQuality;
}

