import { decisionSummary, journalSummary, summaryExportModel } from '@/lib/project-summaries';

const publication = {
  approvedTitle: 'أثر المحاكاة في تعليم التمريض', targetType: 'journal', targetName: 'BMC Nursing',
  structuredAbstract: { background: 'خلفية الدراسة', objective: 'هدف الدراسة', methods: 'منهج الدراسة', results: 'نتائج الدراسة', conclusion: 'خاتمة الدراسة' },
  keywords: ['المحاكاة', 'التمريض', 'التعليم'],
};
const outputs = {
  problem: { problemStatement: 'ضعف المهارات السريرية لدى طلبة التمريض قبل التدريب الميداني.' },
  results: { results: [], overallSummary: 'تحسنت المهارات في المجموعة التجريبية.', limitations: 'عينة من جامعة واحدة.', reportingOnlyConfirmed: true },
  conclusions: { conclusions: [{ questionIndex: 0, questionText: 'س', resultStatement: 'ن', discussionInterpretation: 'م', conclusionStatement: 'المحاكاة ترتبط بتحسن المهارات.' }], overallConclusion: 'خلاصة', scopeStatement: 'تنطبق على طلبة السنة الثالثة.', noNewEvidenceConfirmed: true, noRecommendationsConfirmed: true },
  recommendations: { recommendations: [
    { questionIndex: 0, questionText: 'س', conclusionStatement: 'ك', recommendationType: 'policy', targetAudience: 'عمادة الكلية', implementationHorizon: 'short_term', recommendationText: 'إدراج المحاكاة في الخطة الدراسية.' },
    { questionIndex: 0, questionText: 'س', conclusionStatement: 'ك', recommendationType: 'future_research', targetAudience: 'الباحثون', implementationHorizon: 'long_term', recommendationText: 'دراسة أثر طويل المدى.' },
  ], overallPriorities: 'أ', feasibilityNote: 'ب', conclusionGroundingConfirmed: true, noNewFindingsConfirmed: true },
  publication,
};
const template = { preset: 'imrad' as const, sections: [], wordLimit: 8000, abstractMaxWords: 8, keywordsMin: 3, keywordsMax: 6, referenceLimit: null };

describe('journal summary (DOC-39-04)', () => {
  test('follows the structured abstract headings, word for word from the saved publication stage', () => {
    const summary = journalSummary(outputs, template);
    expect(summary.title).toBe('أثر المحاكاة في تعليم التمريض');
    expect(summary.sections.map(section => [section.heading, section.text])).toEqual([
      ['الخلفية', 'خلفية الدراسة'], ['الهدف', 'هدف الدراسة'], ['المنهج', 'منهج الدراسة'], ['النتائج', 'نتائج الدراسة'], ['الخاتمة', 'خاتمة الدراسة'],
      ['الكلمات المفتاحية', 'المحاكاة; التمريض; التعليم'],
    ]);
    expect(summary.missing).toEqual([]);
  });

  test('checks the abstract and keywords against the saved journal template', () => {
    const checks = journalSummary(outputs, template).checks;
    expect(checks).toEqual([
      { text: 'الملخص {0} كلمات، وحد المجلة {1} كلمة.', values: [10, 8], state: 'attention' },
      { text: 'الكلمات المفتاحية {0}، والمطلوب من {1} إلى {2}.', values: [3, 3, 6], state: 'met' },
    ]);
  });

  test('without a template or an abstract it says what is missing instead of guessing', () => {
    const summary = journalSummary({ ...outputs, publication: { ...publication, structuredAbstract: { ...publication.structuredAbstract, methods: '' } } }, null);
    expect(summary.sections.map(section => section.heading)).not.toContain('المنهج');
    expect(summary.missing).toEqual([
      { text: 'الجزء «{0}» من الملخص المهيكل فارغ في مرحلة «جاهزية النشر».', values: ['المنهج'] },
      { text: 'لم يُحفظ قالب المجلة بعد، فلم تُقارن حدود الملخص والكلمات المفتاحية.' },
    ]);
    expect(journalSummary({}, null).sections).toEqual([]);
  });
});

describe('decision-maker summary (DOC-39-04)', () => {
  test('problem, findings, what it means for practice or policy, and the limits of the results', () => {
    const summary = decisionSummary(outputs);
    expect(summary.sections).toEqual([
      { heading: 'المشكلة', text: 'ضعف المهارات السريرية لدى طلبة التمريض قبل التدريب الميداني.' },
      { heading: 'ما توصلت إليه الدراسة', text: 'تحسنت المهارات في المجموعة التجريبية.\nالمحاكاة ترتبط بتحسن المهارات.' },
      { heading: 'ما يعنيه للقرار', text: 'إدراج المحاكاة في الخطة الدراسية. — عمادة الكلية — قصيرة المدى' },
      { heading: 'حدود النتائج', text: 'عينة من جامعة واحدة.\nتنطبق على طلبة السنة الثالثة.' },
    ]);
    expect(summary.missing).toEqual([]);
  });

  test('never offers a decision without the limits, and leaves research-only recommendations out', () => {
    const summary = decisionSummary({ ...outputs, results: { ...outputs.results, limitations: '' }, conclusions: { ...outputs.conclusions, scopeStatement: '' } });
    expect(summary.sections.map(section => section.heading)).not.toContain('حدود النتائج');
    expect(summary.missing).toContainEqual({ text: 'لم تُذكر حدود النتائج في مرحلتي «النتائج» و«الاستنتاجات»؛ لا يُسلَّم ملخص القرار دونها.' });
    expect(JSON.stringify(summary)).not.toContain('دراسة أثر طويل المدى');
  });
});

test('the file carries the summary, its checks and what is missing, and says nothing was added', () => {
  const model = summaryExportModel(decisionSummary({ problem: outputs.problem }), 'ar');
  expect(model.title).toBe('ملخص لصانع القرار');
  expect(model.notice).toContain('لا يضيف');
  expect(model.sections.at(-1)).toEqual({ title: 'ما ينقص هذا الملخص', paragraphs: expect.arrayContaining([expect.stringContaining('النتائج')]) });
});
