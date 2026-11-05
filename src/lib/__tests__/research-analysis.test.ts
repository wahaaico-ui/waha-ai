import { normaliseResearchAnalysis, researchAnalysisEvidenceIssue } from '../research-analysis';

const valid = {
  introduction: 'تتناول الدراسات المختارة الظاهرة من زوايا بحثية متعددة ومتكاملة.',
  thematicSynthesis: 'تشير المقارنة بين الدراسات إلى اتفاق نسبي حول الظاهرة مع اختلاف في السياقات والأدوات المستخدمة.',
  themes: [{ title: 'المحور الأول', synthesis: 'تتقاطع الدراستان في تناول الأثر مع اختلاف واضح في مجتمع الدراسة.', supportingPaperIds: ['paper-1', 'paper-2'] }],
  researchGapsIdentified: ['تحتاج قابلية انتقال النتائج إلى السياق المحلي إلى فحص ميداني إضافي.'],
  conclusion: 'تدعم الأدلة استمرار البحث مع ضرورة ضبط المجتمع والأداة قبل التنفيذ.',
  limitations: ['التحليل مقيد بالدراسات المختارة والملخصات المتاحة في المصادر.'],
};

describe('research analysis validation', () => {
  test('does not require a fabricated research gap', () => {
    expect(normaliseResearchAnalysis({ ...valid, researchGapsIdentified: [] }, ['paper-1', 'paper-2'])?.researchGapsIdentified).toEqual([]);
  });
  test('accepts synthesis grounded in selected paper identifiers', () => {
    expect(normaliseResearchAnalysis(valid, ['paper-1', 'paper-2'])).not.toBeNull();
  });

  test('rejects a generated citation to an unselected paper', () => {
    const fabricated = { ...valid, themes: [{ ...valid.themes[0], supportingPaperIds: ['paper-1', 'invented-paper'] }] };
    expect(normaliseResearchAnalysis(fabricated, ['paper-1', 'paper-2'])).toBeNull();
  });

  test('rejects incomplete AI output', () => {
    expect(normaliseResearchAnalysis({ introduction: 'نص ناقص وغير كافٍ للمراجعة' }, ['paper-1'])).toBeNull();
  });
});

describe('numeric evidence checks do not imply scientific verification', () => {
  const sources = [{ id: 'paper-1', title: 'Study one', year: 2024, abstract: 'The sample outcome was 52.3%; p = .05.' }, { id: 'paper-2', title: 'Study two', year: 2023, abstract: 'The measured result was -0.42.' }];
  const withFinding = (finding: string, supportingPaperIds = ['paper-1']) => ({ ...valid, researchGapsIdentified: [], themes: [{ ...valid.themes[0], synthesis: finding, supportingPaperIds }] });
  test.each(['The cited study reported 52.30 % within its own population.', 'وردت النسبة ٥٢٫٣٪ في المصدر المختار ضمن مجتمع الدراسة.', 'The cited study reported p = 0.05 [1].'])('preserves equivalent numeric notation and valid citation markers: %s', (finding) => {
    expect(researchAnalysisEvidenceIssue(withFinding(finding), sources)).toBeNull();
  });
  test.each(['The cited study reported a 999.123% improvement.', 'أظهرت الدراسة تحسنًا بنسبة ٩٩٩٫١٢٣٪ ضمن مجتمعها.', 'The cited study reported a -0.42 correlation.'])('rejects an absent or misattributed quantitative value: %s', (finding) => {
    expect(researchAnalysisEvidenceIssue(withFinding(finding), sources)).not.toBeNull();
  });
  test('rejects unsupported numbers in the overall synthesis, not just individual themes', () => {
    expect(researchAnalysisEvidenceIssue({ ...valid, thematicSynthesis: 'The selected studies demonstrated a 999.123% improvement overall.' }, sources)).not.toBeNull();
  });
});
