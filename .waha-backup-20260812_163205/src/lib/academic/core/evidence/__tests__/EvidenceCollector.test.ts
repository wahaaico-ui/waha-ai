import { EvidenceCollector } from '../EvidenceCollector';
import { ParsedAcademicIntent } from '../../../types/IntentAnalysisResult';

describe('EvidenceCollector - Sprint 1 Task 3', () => {
  let collector: EvidenceCollector;

  beforeEach(() => {
    collector = new EvidenceCollector();
  });

  test('Case 1: Collects valid evidence package deterministically', () => {
    const intent: ParsedAcademicIntent = {
      intent: 'INITIAL_IDEA', confidence: 80, language: 'ar',
      independentVariable: 'الذكاء الاصطناعي', dependentVariable: 'التحصيل',
      population: null, location: null, discipline: 'التربية', academicLevel: 'ماجستير',
      missingParts: [], nextRoute: '/next'
    };

    const packageResult = collector.collect(intent);
    expect(packageResult.referenceCount).toBeGreaterThan(0);
    expect(packageResult.citationMetrics.averageCitations).toBeGreaterThan(0);
    expect(packageResult.rejectedTitleDatabase.length).toBeGreaterThan(0);
  });
});

