import {
  buildResultsDraft,
  researchResultsConsistencyIssue,
  researchResultsStructureIssue,
} from '@/lib/research-results';

const analysisInput = {
  analysisKind: 'quantitative',
  analyzedBy: 'researcher',
  softwareOrMethod: 'برنامج SPSS وتحليل الانحدار المتعدد',
  sampleAnalyzed: 'شمل التحليل 214 استجابة صالحة من طلبة الدراسات العليا',
  procedureSummary: 'تم فحص الافتراضات ثم تطبيق تحليل الانحدار وفق مستوى الدلالة المعتمد.',
  findings: [{
    questionIndex: 0,
    questionText: 'ما أثر استخدام المنصة على جودة تعلم طلبة الدراسات العليا؟',
    hypothesisIndex: 0,
    hypothesisText: 'يوجد أثر لاستخدام المنصة على جودة تعلم طلبة الدراسات العليا.',
    findingSummary: 'ظهر أثر إيجابي لاستخدام المنصة على جودة التعلم لدى أفراد العينة.',
    evidenceSummary: 'بلغ معامل الانحدار 0.42 عند مستوى دلالة 0.01 ضمن النموذج المختبر.',
  }],
  limitations: 'تقتصر النتائج على عينة الدراسة الحالية ولا تسمح بتعميم سببي خارج سياق الجامعة.',
  noRawDataConfirmed: true,
  noPersonalDataConfirmed: true,
};

describe('research results stage', () => {
  test('builds an honest draft from the approved external analysis without inventing values', () => {
    const draft = buildResultsDraft(analysisInput);
    expect(draft).not.toBeNull();
    expect(draft?.results).toHaveLength(1);
    expect(draft?.results[0].resultStatement).toContain('0.42');
    expect(draft?.results[0].resultStatement).toContain('0.01');
    expect(draft?.results[0].sourceFindingSummary).toBe(analysisInput.findings[0].findingSummary);
  });

  test('rejects changing the approved question or analysis evidence', () => {
    const draft = buildResultsDraft(analysisInput)!;
    expect(researchResultsConsistencyIssue({ ...draft, results: [{ ...draft.results[0], questionText: 'سؤال آخر غير معتمد' }] }, analysisInput)).toContain('السؤال');
    expect(researchResultsConsistencyIssue({ ...draft, results: [{ ...draft.results[0], sourceEvidenceSummary: 'دليل بديل غير معتمد' }] }, analysisInput)).toContain('الدليل');
  });

  test('rejects dropping a numeric value from the approved analysis', () => {
    const draft = buildResultsDraft(analysisInput)!;
    const changed = {
      ...draft,
      results: [{ ...draft.results[0], resultStatement: 'ظهر أثر إيجابي واضح لاستخدام المنصة على جودة التعلم، وفق المخرج التحليلي المعتمد للدراسة الحالية.' }],
    };
    expect(researchResultsConsistencyIssue(changed, analysisInput)).toContain('0.42');
  });

  test('keeps discussion and recommendations out of the results section', () => {
    const draft = buildResultsDraft(analysisInput)!;
    const changed = {
      ...draft,
      results: [{ ...draft.results[0], resultStatement: `${draft.results[0].resultStatement} ونوصي بتعميم المنصة بسبب هذه النتيجة.` }],
    };
    expect(researchResultsStructureIssue(changed)).toContain('تفسيراً أو توصية');
  });

  test('accepts the generated draft when it stays grounded in every approved output', () => {
    const draft = buildResultsDraft(analysisInput)!;
    expect(researchResultsStructureIssue(draft)).toBeNull();
    expect(researchResultsConsistencyIssue(draft, analysisInput)).toBeNull();
  });
});
