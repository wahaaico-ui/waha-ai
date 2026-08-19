import { EvidencePackage, AcademicReference, RejectedTitleRecord } from '../../types/EvidencePackage';
import { ParsedAcademicIntent } from '../../types/IntentAnalysisResult';

export class EvidenceCollector {

  // Mock internal database for deterministic rule-based evaluation
  private mockReferencesDatabase: AcademicReference[] = [
    { id: 'REF-1', title: 'Artificial Intelligence in Modern Education', year: 2024, citations: 45, journalTier: 'Q1' },
    { id: 'REF-2', title: 'Machine Learning impact on Student Performance', year: 2023, citations: 30, journalTier: 'Q2' },
    { id: 'REF-3', title: 'Legacy Systems in Academic Assessment', year: 2018, citations: 12, journalTier: 'Q3' }
  ];

  private mockRejectedTitles: RejectedTitleRecord[] = [
    { title: 'أثر الحاسوب على التعليم', reasonCode: 'SATURATED_TOPIC', discipline: 'التربية والتعليم' }
  ];

  public collect(intent: ParsedAcademicIntent): EvidencePackage {
    // Filter references based on keyword match or return subset deterministically
    const matchedReferences = this.mockReferencesDatabase;
    const currentYear = new Date().getFullYear();

    const recentReferences = matchedReferences.filter(r => (currentYear - r.year) <= 5).length;
    const years = matchedReferences.map(r => r.year);
    const oldestReference = years.length > 0 ? Math.min(...years) : currentYear;
    const newestReference = years.length > 0 ? Math.max(...years) : currentYear;

    const journalTiers: Record<string, number> = {
      Q1: matchedReferences.filter(r => r.journalTier === 'Q1').length,
      Q2: matchedReferences.filter(r => r.journalTier === 'Q2').length,
      Q3: matchedReferences.filter(r => r.journalTier === 'Q3').length,
      Q4: matchedReferences.filter(r => r.journalTier === 'Q4').length,
      OTHER: matchedReferences.filter(r => r.journalTier === 'OTHER').length,
    };

    const totalCitations = matchedReferences.reduce((acc, r) => acc + r.citations, 0);
    const averageCitations = matchedReferences.length > 0 ? Math.round(totalCitations / matchedReferences.length) : 0;

    return {
      references: matchedReferences,
      referenceCount: matchedReferences.length,
      recentReferences,
      oldestReference,
      newestReference,
      journalTiers,
      citationMetrics: {
        averageCitations,
        authorHIndexEstimate: Math.min(averageCitations, 15)
      },
      relatedTitles: matchedReferences.map(r => r.title),
      rejectedTitleDatabase: this.mockRejectedTitles
    };
  }
}

