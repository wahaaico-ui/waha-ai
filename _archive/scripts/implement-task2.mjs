import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 1  Task 2  —  Research Readiness Engine       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/lib/academic/types');
dir('src/lib/academic/core/readiness');
dir('src/lib/academic/core/readiness/__tests__');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — ReadinessAssessment type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/types/ReadinessAssessment.ts', `
export interface ReadinessAssessment {
  isReady:               boolean;
  missingElements:       string[];
  ambiguities:           string[];
  proceedWithCaveats:    boolean;
  caveats:               string[];
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 2 — ResearchReadinessEngine.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/readiness/ResearchReadinessEngine.ts', `
import { IntentAnalysisResult } from '../../types/IntentAnalysisResult';
import { ReadinessAssessment } from '../../types/ReadinessAssessment';

export class ResearchReadinessEngine {
  public assess(intentResult: IntentAnalysisResult): ReadinessAssessment {
    const missingElements: string[] = [];
    const ambiguities: string[] = [];
    const caveats: string[] = [];

    // 1. Non-research intent is never ready
    if (intentResult.intent === 'NON_RESEARCH') {
      return {
        isReady: false,
        missingElements: ['النص المرسل ليس له علاقة بالبحث العلمي'],
        ambiguities: [],
        proceedWithCaveats: false,
        caveats: []
      };
    }

    // 2. If user has no idea, they need guidance, but system is ready to suggest topics
    if (intentResult.intent === 'NO_IDEA') {
      return {
        isReady: true,
        missingElements: [],
        ambiguities: ['لم يحدد المستخدم أي مجال بحثي مفضل'],
        proceedWithCaveats: true,
        caveats: ['سيتم اقتراح مواضيع عامة بناءً على الاتجاهات الشائعة']
      };
    }

    // 3. Check for variables if it's a title or initial idea
    if (!intentResult.independentVariable) {
      missingElements.push('المتغير المستقل غير محدد بوضوح');
    }
    if (!intentResult.dependentVariable) {
      missingElements.push('المتغير التابع غير محدد بوضوح');
    }

    // 4. Check confidence level
    if (intentResult.confidence < 70) {
      ambiguities.push('صياغة الفكرة غامضة وتحتاج إلى توضيح إضافي');
    }

    const isReady = missingElements.length === 0;
    const proceedWithCaveats = !isReady && missingElements.length <= 1;

    if (proceedWithCaveats) {
      caveats.push('تم المضي قدماً مع افتراض بعض المعايير الافتراضية للنقص الموجود');
    }

    return {
      isReady,
      missingElements,
      ambiguities,
      proceedWithCaveats,
      caveats
    };
  }
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 3 — Unit Tests for Readiness Engine
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/readiness/__tests__/ResearchReadinessEngine.test.ts', `
import { ResearchReadinessEngine } from '../ResearchReadinessEngine';
import { IntentAnalysisResult } from '../../../types/IntentAnalysisResult';

describe('ResearchReadinessEngine - Sprint 1 Task 2', () => {
  let engine: ResearchReadinessEngine;

  beforeEach(() => {
    engine = new ResearchReadinessEngine();
  });

  test('Case 1: Not ready for NON_RESEARCH intent', () => {
    const intent: IntentAnalysisResult = {
      intent: 'NON_RESEARCH', confidence: 100, language: 'ar',
      independentVariable: null, dependentVariable: null,
      population: null, location: null, discipline: null, academicLevel: null,
      missingParts: [], nextRoute: '/error'
    };

    const result = engine.assess(intent);
    expect(result.isReady).toBe(false);
  });

  test('Case 2: Ready with caveats for NO_IDEA intent', () => {
    const intent: IntentAnalysisResult = {
      intent: 'NO_IDEA', confidence: 90, language: 'ar',
      independentVariable: null, dependentVariable: null,
      population: null, location: null, discipline: null, academicLevel: null,
      missingParts: [], nextRoute: '/generator'
    };

    const result = engine.assess(intent);
    expect(result.isReady).toBe(true);
    expect(result.proceedWithCaveats).toBe(true);
  });

  test('Case 3: Fully ready when independent and dependent variables exist', () => {
    const intent: IntentAnalysisResult = {
      intent: 'HAS_TITLE', confidence: 80, language: 'ar',
      independentVariable: 'الذكاء الاصطناعي', dependentVariable: 'التعليم',
      population: 'الطلاب', location: 'السعودية', discipline: 'التربية', academicLevel: 'ماجستير',
      missingParts: [], nextRoute: '/evaluator'
    };

    const result = engine.assess(intent);
    expect(result.isReady).toBe(true);
    expect(result.missingElements.length).toBe(0);
  });
});
`);

console.log('\n✅ Task 2 implementation completed successfully.\n');
