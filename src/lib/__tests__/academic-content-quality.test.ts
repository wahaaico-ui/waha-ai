import { assessAcademicText, assessProblemDraft, firstAcademicTextIssue } from '../academic-content-quality';

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

  it('rejects a problem draft unrelated to the approved title', () => {
    const result = assessProblemDraft({
      title: 'أثر الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا',
      problemStatement: 'تعاني المدن الساحلية من ارتفاع مستمر في كميات النفايات المنزلية وصعوبة إدارتها خلال مواسم السياحة السنوية.',
      researchGap: 'ما زالت الأدلة المتاحة محدودة بشأن كفاءة أساليب الفرز المنزلي في الأحياء الساحلية المكتظة بالسكان.',
      researcherNote: 'اخترت هذه المشكلة لأهميتها العملية في المجتمع الذي أعيش وأعمل فيه.',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('العنوان');
  });

  it('does not let the assistant fabricate the researcher rationale', () => {
    const result = assessProblemDraft({
      title: 'أثر الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا',
      problemStatement: 'لا يزال أثر استخدام الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا غير واضح في السياق الجامعي المحلي.',
      researchGap: 'توجد محدودية في الأدلة التي تربط استخدام الذكاء الاصطناعي فعلياً بتطور مهارات التعلم لدى طلبة الدراسات العليا.',
      researcherNote: '',
      requireResearcherNote: false,
    });
    expect(result.valid).toBe(true);
  });
});
