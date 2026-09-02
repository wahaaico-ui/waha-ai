import { externalAnalysisConsistencyIssue, externalAnalysisStructureIssue } from '@/lib/research-analysis-input';

const questions = {
  questions: [
    'ما أثر استخدام الذكاء الاصطناعي على جودة تعلم طلبة الدراسات العليا؟',
    'ما العوامل التي تؤثر في تبني طلبة الدراسات العليا لأدوات الذكاء الاصطناعي؟',
  ],
};
const hypotheses = {
  mode: 'required',
  hypotheses: [
    'يوجد أثر دال لاستخدام الذكاء الاصطناعي على جودة تعلم طلبة الدراسات العليا',
    'توجد علاقة دالة بين العوامل التنظيمية وتبني طلبة الدراسات العليا لأدوات الذكاء الاصطناعي',
  ],
};
const methodology = { approach: 'quantitative' };
const validOutput = {
  analysisKind: 'quantitative',
  analyzedBy: 'statistical_specialist',
  softwareOrMethod: 'برنامج SPSS وتحليل الانحدار المتعدد',
  sampleAnalyzed: 'شمل التحليل مئتين وأربع عشرة استجابة مكتملة وصالحة للتحليل',
  procedureSummary: 'فُحصت افتراضات التحليل أولاً، ثم حُسبت المؤشرات الوصفية واختُبر نموذج الانحدار وفق مستوى الدلالة المعتمد.',
  findings: questions.questions.map((questionText, questionIndex) => ({
    questionIndex,
    questionText,
    hypothesisIndex: questionIndex,
    hypothesisText: hypotheses.hypotheses[questionIndex],
    findingSummary: questionIndex === 0
      ? 'أظهر النموذج اتجاهاً موجباً بين مستوى الاستخدام وجودة التعلم لدى أفراد العينة.'
      : 'كانت سهولة الاستخدام والدعم الأكاديمي أبرز العوامل المرتبطة بالتبني لدى الطلبة.',
    evidenceSummary: questionIndex === 0
      ? 'كان معامل الانحدار موجباً ودالاً وفق مستوى الدلالة المحدد مسبقاً في خطة التحليل.'
      : 'فسرت العوامل التنظيمية والتقنية جزءاً معتبراً من التباين في درجة التبني الكلية.',
  })),
  limitations: 'تقتصر النتائج على عينة الدراسة الحالية ولا تسمح بتعميم سببي خارج سياق الجامعة.',
  noRawDataConfirmed: true,
  noPersonalDataConfirmed: true,
};

describe('external analysis input validation', () => {
  test('accepts complete outputs mapped to every approved question and hypothesis', () => {
    expect(externalAnalysisStructureIssue(validOutput)).toBeNull();
    expect(externalAnalysisConsistencyIssue(validOutput, questions, hypotheses, methodology)).toBeNull();
  });

  test('rejects a missing output for an approved question', () => {
    expect(externalAnalysisConsistencyIssue(
      { ...validOutput, findings: validOutput.findings.slice(0, 1) },
      questions,
      hypotheses,
      methodology,
    )).toContain('كل سؤال');
  });

  test('rejects a client attempt to replace the approved question text', () => {
    const findings = validOutput.findings.map((finding, index) => index === 0 ? { ...finding, questionText: 'سؤال مختلف غير معتمد؟' } : finding);
    expect(externalAnalysisConsistencyIssue({ ...validOutput, findings }, questions, hypotheses, methodology)).toContain('لا يطابق السؤال');
  });

  test('rejects outputs until privacy confirmations are explicit', () => {
    expect(externalAnalysisStructureIssue({ ...validOutput, noRawDataConfirmed: false })).toContain('عدم رفع بيانات خام');
  });

  test('rejects direct identifiers even when privacy boxes are checked', () => {
    expect(externalAnalysisStructureIssue({ ...validOutput, procedureSummary: 'أرسل المشارك النتيجة من participant@example.com ثم طبق الباحث جميع خطوات التحليل المطلوبة بعناية.' })).toContain('معرّفاً شخصياً');
  });

  test('rejects an analysis kind that conflicts with the approved methodology', () => {
    expect(externalAnalysisConsistencyIssue({ ...validOutput, analysisKind: 'qualitative' }, questions, hypotheses, methodology)).toContain('المنهج المعتمد كمي');
  });
});
