import { AcademicReportGenerator } from '../AcademicReportGenerator';
import { UnifiedAcademicReport } from '../../../types/UnifiedAcademicReport';

describe('AcademicReportGenerator - Core Goal', () => {
  test('Generates a professional markdown academic report', () => {
    const mockReport: UnifiedAcademicReport = {
      intentResult: {
        intent: 'INITIAL_IDEA', confidence: 90, language: 'ar',
        independentVariable: 'الذكاء الاصطناعي', dependentVariable: 'التحصيل الأكاديمي',
        population: null, location: null, discipline: 'التربية', academicLevel: 'ماجستير',
        missingParts: [], nextRoute: '/next'
      },
      readinessAssessment: { isReady: true, missingElements: [], ambiguities: [], proceedWithCaveats: false, caveats: [] },
      evidencePackage: { references: [], referenceCount: 5, recentReferences: 4, oldestReference: 2018, newestReference: 2026, journalTiers: { Q1: 3, Q2: 2, Q3: 0, Q4: 0, OTHER: 0 }, citationMetrics: { averageCitations: 25, authorHIndexEstimate: 5 }, relatedTitles: [], rejectedTitleDatabase: [] },
      intelligenceReport: { fieldSaturation: 0.6, trendScore: 0.85, methodologyNorms: ['المنهج الوصفي التحليلي'], typicalScope: { variableCount: 2, sampleSizeMin: 150, sampleSizeMax: 400 }, knownGaps: ['نقص التطبيقات العملية'], competingResearch: 15 },
      gapAnalysisResult: { identifiedGaps: [{ id: 'GAP-1', description: 'نقص التطبيقات العملية في البيئة العربية', significance: 'HIGH' }], gapRelevance: { 'GAP-1': 0.9 }, overlapDegree: 0.5, differentiators: ['إطار حديث'], narrowingOpportunities: [], expansionOpportunities: [] },
      finalVerdict: { status: 'APPROVED', score: 90, summaryMessage: 'الفكرة ممتازة وواعدة.' }
    };

    const generator = new AcademicReportGenerator();
    const result = generator.generateProfessionalReport(mockReport);

    expect(result).toBeDefined();
    expect(result).toContain('الذكاء الاصطناعي');
    expect(result).toContain('التحصيل الأكاديمي');
    expect(result).toContain('تقرير المقترح البحثي الأكاديمي');
  });
});

