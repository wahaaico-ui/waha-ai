import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 1  Task 4  —  Research Intelligence Engine    ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/lib/academic/types');
dir('src/lib/academic/core/intelligence');
dir('src/lib/academic/core/intelligence/__tests__');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — IntelligenceReport type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/types/IntelligenceReport.ts', `
export interface IntelligenceReport {
  fieldSaturation:    number; // 0 to 1
  trendScore:         number; // 0 to 1
  methodologyNorms:   string[];
  typicalScope: {
    variableCount:    number;
    sampleSizeMin:    number;
    sampleSizeMax:    number;
  };
  knownGaps:          string[];
  competingResearch:  number;
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 2 — ResearchIntelligenceEngine.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/intelligence/ResearchIntelligenceEngine.ts', `
import { IntelligenceReport } from '../../types/IntelligenceReport';
import { EvidencePackage } from '../../types/EvidencePackage';
import { ParsedAcademicIntent } from '../../types/IntentAnalysisResult';

export class ResearchIntelligenceEngine {
  public analyze(intent: ParsedAcademicIntent, evidence: EvidencePackage): IntelligenceReport {
    // Deterministic intelligence calculations based on evidence counts and field norms
    const referenceCount = evidence.referenceCount;
    
    // Saturation increases if there are many references or citations
    const fieldSaturation = Math.min(referenceCount / 10, 0.95);
    
    // Trend score based on recent references ratio
    const recentRatio = referenceCount > 0 ? evidence.recentReferences / referenceCount : 0.5;
    const trendScore = Number((0.4 + (recentRatio * 0.5)).toFixed(2));

    const methodologyNorms = [
      'المنهج الوصفي التحليلي',
      'المنهج شبه التجريبي',
      'المنهج الارتباطي'
    ];

    const knownGaps = [
      'نقص الدراسات التطبيقية في البيئة العربية الحديثة',
      'التركيز المحدود على المتغيرات الوسيطة'
    ];

    return {
      fieldSaturation,
      trendScore,
      methodologyNorms,
      typicalScope: {
        variableCount: 2, // Independent + Dependent
        sampleSizeMin: 100,
        sampleSizeMax: 500
      },
      knownGaps,
      competingResearch: referenceCount * 3
    };
  }
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 3 — Unit Tests for Research Intelligence Engine
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/intelligence/__tests__/ResearchIntelligenceEngine.test.ts', `
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
`);

console.log('\n✅ Task 4 implementation completed successfully.\n');
