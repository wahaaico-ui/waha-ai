import { ResearchIntelligenceEngine } from '../ResearchIntelligenceEngine';
import { EvidencePackage } from '../../../types/EvidencePackage';
import { ParsedAcademicIntent } from '../../../types/IntentAnalysisResult';

describe('ResearchIntelligenceEngine - Sprint 1 Task 4', () => {
  let engine: ResearchIntelligenceEngine;

  beforeEach(() => {
    engine = new ResearchIntelligenceEngine();
  });

  test('Case 1: Generates valid intelligence report deterministically', () => {
    const intent: ParsedAcademicIntent = {
      intent: 'INITIAL_IDEA', confidence: 80, language: 'ar',
      independentVariable: 'الذكاء الاصطناعي', dependentVariable: 'التحصيل',
      population: null, location: null, discipline: 'التربية', academicLevel: 'ماجستير',
      missingParts: [], nextRoute: '/next'
    };

    const evidence: EvidencePackage = {
      references: [], referenceCount: 5, recentReferences: 4,
      oldestReference: 2018, newestReference: 2026,
      journalTiers: { Q1: 3, Q2: 2, Q3: 0, Q4: 0, OTHER: 0 },
      citationMetrics: { averageCitations: 20, authorHIndexEstimate: 5 },
      relatedTitles: ['Sample Title'],
      rejectedTitleDatabase: []
    };

    const report = engine.analyze(intent, evidence);
    expect(report.fieldSaturation).toBeGreaterThan(0);
    expect(report.trendScore).toBeGreaterThan(0);
    expect(report.methodologyNorms.length).toBeGreaterThan(0);
  });
});

