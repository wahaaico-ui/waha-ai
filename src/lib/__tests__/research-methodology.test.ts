import { assessMethodologyField, methodologyAdvisories, methodologyStructureIssue } from '@/lib/research-methodology';
import { stageComplete } from '@/lib/research-workflow';

const valid = {
  approach: 'qualitative', population: 'طلبة الدراسات العليا المسجلون في الجامعات المحلية.',
  sample: 'عينة قصدية متنوعة من طلبة الكليات المختلفة.',
  instrument: 'مقابلات شبه منظمة لفهم خبرات الطلبة مع التعليم.',
};

describe('shared methodology validation and advisory word matches', () => {
  test.each([
    ['qualitative', 'لن نستخدم استبانة بل مقابلات شبه منظمة مع المشاركين.'],
    ['qualitative', 'تحليل نصوص استبانات مفتوحة للإجابات باستخدام الترميز الموضوعي.'],
    ['quantitative', 'لن نستخدم مقابلات بل مقياس كمي لقياس التحصيل.'],
    ['quantitative', 'قياس التحصيل الأكاديمي مقابل مستوى الحضور لدى الطلاب.'],
    ['qualitative', 'No questionnaire will be used; interviews explore participant experiences.'],
    ['quantitative', 'No interview is planned; a structured numeric scale measures achievement.'],
  ])('word match is advisory only: %s / %s', (approach, instrument) => {
    const output = { ...valid, approach, instrument };
    expect(methodologyStructureIssue(output)).toBeNull();
    expect(stageComplete('methodology', output)).toBe(true);
    expect(methodologyAdvisories(output)).toEqual([expect.stringContaining('لا يتطلب تغيير المنهج')]);
  });

  test.each(['population', 'sample', 'instrument'] as const)('enforces characters and words for %s', (field) => {
    for (const value of ['أ ب ج د', 'المشاركون المختارون للدراسة', 'ااااااااااااااااااااا ااااااااا ااااااااا ااااااااا', 42, [], null]) {
      const output = { ...valid, [field]: value };
      expect(assessMethodologyField(field, value).valid).toBe(false);
      expect(methodologyStructureIssue(output)).toBe(assessMethodologyField(field, value).reason);
      expect(stageComplete('methodology', output)).toBe(false);
    }
  });

  test('requires a textual approach and preserves normalization', () => {
    expect(methodologyStructureIssue({ ...valid, approach: [] })).toBeTruthy();
    expect(methodologyStructureIssue({ ...valid, approach: ' ' })).toBeTruthy();
    expect(assessMethodologyField('sample', '  عينة   قصدية متنوعة من الطلبة  ').words).toBe(5);
    expect(methodologyStructureIssue(valid)).toBeNull();
    expect(methodologyAdvisories(valid)).toEqual([]);
  });
});
