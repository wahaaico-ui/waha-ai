import { assessAcademicText, firstAcademicTextIssue } from '../academic-content-quality';

describe('academic content quality', () => {
  it('rejects long repeated Arabic noise', () => {
    const result = assessAcademicText('الالالالالالالالالالالالالالالالالالالالالالالالا', { minChars: 20, minWords: 4, label: 'المشكلة' });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/مكرراً|عشوائياً|جملة مفهومة/);
  });

  it('accepts a meaningful Arabic research problem', () => {
    const result = assessAcademicText('تواجه الجامعات تحدياً في قياس أثر التعلم الرقمي على مشاركة طلبة السنة الأولى واستمرارهم الأكاديمي.', { minChars: 50, minWords: 8, label: 'المشكلة' });
    expect(result.valid).toBe(true);
  });

  it('rejects a list containing a meaningless objective', () => {
    const issue = firstAcademicTextIssue(['لالالالالالالالالالالالا', 'مقارنة مستوى المشاركة بين مجموعتين من الطلبة'], { minChars: 20, minWords: 5, label: 'الهدف' }, 2);
    expect(issue).toBeTruthy();
  });
});
