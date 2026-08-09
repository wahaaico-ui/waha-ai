import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Core Goal  —  Professional Academic Report Generator ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/lib/academic/core/generator');
dir('src/lib/academic/core/generator/__tests__');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — AcademicReportGenerator.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/generator/AcademicReportGenerator.ts', `
import { UnifiedAcademicReport } from '../../types/UnifiedAcademicReport';

export class AcademicReportGenerator {
  public generateProfessionalReport(report: UnifiedAcademicReport): string {
    const { intentResult, intelligenceReport, gapAnalysisResult, finalVerdict } = report;
    
    const indVar = intentResult.independentVariable || 'المتغير الرئيسي';
    const depVar = intentResult.dependentVariable || 'متغير الأثر';

    return \`
# تقرير المقترح البحثي الأكاديمي الاحترافي — منصة وُهى (WAHA)

## 1. الإطار العام للمشكلة البحثية
تتبلور مشكلة الدراسة الحالية حول دراسة العلاقة الارتباطية والأثر بين (\${indVar}) و(\${depVar}). بناءً على التحليل المنهجي، وُجد أن نسبة تشبع المجال البحثي تبلغ \${Math.round(intelligenceReport.fieldSaturation * 100)}%، مما يعكس أهمية إطاره ضمن السياق المعاصر.

## 2. الفجوات البحثية والمبررات العلمية
تم رصد الفجوات التالية التي تمنح الدراسة الحالية أصالتها وقيمتها المضافة:
\${gapAnalysisResult.identifiedGaps.map(g => \`- **[\${g.significance}]**: \${g.description}\`).join('\\n')}

## 3. المنهجية المقترحة والمعايير العلمية
توصي المعايير الأكاديمية للمجال باعتماد أحد المناهج التالية:
\${intelligenceReport.methodologyNorms.map(m => \`- \${m}\`).join('\\n')}

- **الحجم المتوقع للعينة:** ما بين \${intelligenceReport.typicalScope.sampleSizeMin} إلى \${intelligenceReport.typicalScope.sampleSizeMax} مبحوثاً.
- **مؤشر الاتجاه الحديث:** \${Math.round(intelligenceReport.trendScore * 100)}%.

## 4. القرار والتقدير الأكاديمي النهائي
- **حالة المقترح:** \${finalVerdict.status}
- **درجة الجودة الأكاديمية:** \${finalVerdict.score} / 100
- **الخلاصة التوجيهية:** \${finalVerdict.summaryMessage}
    \`.trim();
  }
}
`);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 2 — Unit Tests for Generator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/lib/academic/core/generator/__tests__/AcademicReportGenerator.test.ts', `
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
`);

console.log('\n✅ Core Goal Report Generator implemented successfully.\n');
