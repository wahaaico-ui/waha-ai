import { generateAdvancedSuite } from '@/lib/waha-pipeline/advanced-academic-suite';

describe('advanced academic suite', () => {
  test('never fabricates a plagiarism percentage', () => {
    const result = generateAdvancedSuite('الفكرة', 'المشكلة', 'الفجوة', []);

    expect(result.plagiarismScore).toBeNull();
    expect(result.plagiarismStatus).toContain('لم يُجر فحص تشابه موثق');
  });
});
