export interface AcademicReference {
  id: string;
  title: string;
  year: number;
  citations: number;
  journalTier: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'OTHER';
}

export interface RejectedTitleRecord {
  title: string;
  reasonCode: string;
  discipline: string;
}

export interface EvidencePackage {
  references:             AcademicReference[];
  referenceCount:         number;
  recentReferences:       number; // last 5 years
  oldestReference:        number;
  newestReference:        number;
  journalTiers:           Record<string, number>;
  citationMetrics: {
    averageCitations:     number;
    authorHIndexEstimate: number;
  };
  relatedTitles:          string[];
  rejectedTitleDatabase:  RejectedTitleRecord[];
}

