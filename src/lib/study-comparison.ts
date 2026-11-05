import type { WritingSourceKind } from '@/lib/evidence-writing';
import type { ExtractionKey, StudyExtraction } from '@/lib/writing-analysis';

export type StudyComparisonRow = {
  source: StudyExtraction['source'];
  status: 'ready' | 'not_extracted' | 'text_unavailable' | 'needs_review';
  record: StudyExtraction | null;
  locations: Partial<Record<ExtractionKey, { firstLine: number; lastLine: number; pages?: { first: number; last: number } }>>;
};
export type StudyComparisonPage = {
  items: StudyComparisonRow[];
  kind: WritingSourceKind;
  offset: number;
  nextOffset: number | null;
  total: number;
};
