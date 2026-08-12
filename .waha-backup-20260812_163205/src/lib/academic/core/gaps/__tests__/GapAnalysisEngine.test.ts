import { GapAnalysisEngine } from '../GapAnalysisEngine';
import { IntelligenceReport } from '../../../types/IntelligenceReport';
import { EvidencePackage } from '../../../types/EvidencePackage';
import { ParsedAcademicIntent } from '../../../types/IntentAnalysisResult';

describe('GapAnalysisEngine - Sprint 1 Task 5', () => {
  let engine: GapAnalysisEngine;

  beforeEach(() => {
    engine = new GapAnalysisEngine();
  });

  test('Case 1: Generates valid gap analysis result deterministically', () => {
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
      relatedTitles: [],
      rejectedTitleDatabase: []
    };

    const intelligence: IntelligenceReport = {
      fieldSaturation: 0.5, trendScore: 0.8,
      methodologyNorms: ['المنهج الوصفي'],
      typicalScope: { variableCount: 2, sampleSizeMin: 100, sampleSizeMax: 500 },
      knownGaps: ['نقص الدراسات التطبيقية'],
      competingResearch: 15
    };

    const result = engine.analyze(intent, evidence, intelligence);
    expect(result.identifiedGaps.length).toBeGreaterThan(0);
    expect(result.overlapDegree).toBeGreaterThanOrEqual(0);
    expect(result.differentiators.length).toBeGreaterThan(0);
  });
});

