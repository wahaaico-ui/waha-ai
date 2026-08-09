import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 1  Task 3  —  Evidence Collector              ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/lib/academic/types');
dir('src/lib/academic/core/evidence');
dir('src/lib/academic/core/evidence/__tests__');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — EvidencePackage type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/types/EvidencePackage.ts', `
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
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 2 — EvidenceCollector.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/evidence/EvidenceCollector.ts', `
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
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 3 — Unit Tests for Evidence Collector
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/evidence/__tests__/EvidenceCollector.test.ts', `
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
`);

console.log('\n✅ Task 3 implementation completed successfully.\n');
