import { createGoogleFormsScript, type Questionnaire } from '../google-forms-export';

const questionnaire: Questionnaire = {
  title: 'استبانة جودة التعلم',
  description: 'وصف الأداة',
  consentStatement: 'المشاركة طوعية وتستخدم البيانات للأغراض البحثية فقط.',
  instructions: 'اختر الإجابة التي تعبّر عن تجربتك بدقة.',
  respondentFields: [{ label: 'المستوى الدراسي', kind: 'single_choice', required: true, options: ['ماجستير', 'دكتوراه'] }],
  sections: [{
    title: 'جودة التعلم',
    variableName: 'جودة التعلم',
    description: 'بنود قياس جودة التعلم',
    items: [
      { text: 'أفهم المفاهيم الأكاديمية بوضوح.', kind: 'likert5', required: true, options: [] },
      { text: 'ما التحسين الذي تقترحه؟', kind: 'long_text', required: false, options: [] },
    ],
  }],
};

describe('Google Forms Apps Script export', () => {
  test('creates a published form with supported question types and URLs', () => {
    const script = createGoogleFormsScript(questionnaire);
    expect(script).toContain(`FormApp.create(${JSON.stringify(questionnaire.title)}, true)`);
    expect(script).toContain('addScaleItem()');
    expect(script).toContain('addParagraphTextItem()');
    expect(script).toContain('getEditUrl()');
    expect(script).toContain('getPublishedUrl()');
  });

  test('serializes user text as string data instead of executable script', () => {
    const malicious = `'); throw new Error("injected"); //`;
    const script = createGoogleFormsScript({ ...questionnaire, title: malicious });
    expect(script).toContain(`FormApp.create(${JSON.stringify(malicious)}, true)`);
    expect(script).not.toContain(`FormApp.create('${malicious}', true)`);
  });
});
