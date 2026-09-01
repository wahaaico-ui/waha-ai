import {
  collectionGuidanceFor,
  recommendStudyInstrument,
} from '@/lib/research-instrument';

describe('research instrument recommendation', () => {
  it('recommends interviews for qualitative questions', () => {
    const result = recommendStudyInstrument({
      approach: 'qualitative',
      questions: ['كيف يصف المعلمون تجاربهم مع التعلم المدمج؟'],
    });
    expect(result.type).toBe('interview');
  });

  it('recommends questionnaires for quantitative designs', () => {
    const result = recommendStudyInstrument({
      approach: 'quantitative',
      questions: ['ما أثر التدوير الوظيفي في تنمية الموارد البشرية؟'],
    });
    expect(result.type).toBe('questionnaire');
  });

  it('routes document and observation studies to specialized tools', () => {
    expect(recommendStudyInstrument({ approach: 'qualitative', methodologyInstrument: 'تحليل الوثائق الرسمية' }).type).toBe('document_analysis');
    expect(recommendStudyInstrument({ approach: 'qualitative', methodologyInstrument: 'ملاحظة السلوك الصفي' }).type).toBe('observation');
  });

  it('adds a complementary tool for mixed methods', () => {
    const result = recommendStudyInstrument({ approach: 'mixed' });
    expect(result.type).toBe('questionnaire');
    expect(result.complementaryType).toBe('interview');
  });

  it('states that collection and analysis remain with the researcher', () => {
    expect(collectionGuidanceFor('questionnaire').join(' ')).toContain('لا تجمع البيانات');
  });
});
