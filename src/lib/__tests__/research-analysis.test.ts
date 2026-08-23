import { normaliseResearchAnalysis } from '../research-analysis';

const valid = {
  introduction: 'تتناول الدراسات المختارة الظاهرة من زوايا بحثية متعددة ومتكاملة.',
  thematicSynthesis: 'تشير المقارنة بين الدراسات إلى اتفاق نسبي حول الظاهرة مع اختلاف في السياقات والأدوات المستخدمة.',
  themes: [{ title: 'المحور الأول', synthesis: 'تتقاطع الدراستان في تناول الأثر مع اختلاف واضح في مجتمع الدراسة.', supportingPaperIds: ['paper-1', 'paper-2'] }],
  researchGapsIdentified: ['تحتاج قابلية انتقال النتائج إلى السياق المحلي إلى فحص ميداني إضافي.'],
  conclusion: 'تدعم الأدلة استمرار البحث مع ضرورة ضبط المجتمع والأداة قبل التنفيذ.',
  limitations: ['التحليل مقيد بالدراسات المختارة والملخصات المتاحة في المصادر.'],
};

describe('research analysis validation', () => {
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
