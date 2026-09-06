import { assessAcademicText } from '@/lib/academic-content-quality';

export type ResearchResultItem = {
  questionIndex: number;
  questionText: string;
  hypothesisIndex: number | null;
  hypothesisText: string | null;
  sourceFindingSummary: string;
  sourceEvidenceSummary: string;
  resultStatement: string;
};

export type ResearchResultsOutput = {
  results: ResearchResultItem[];
  overallSummary: string;
  limitations: string;
  reportingOnlyConfirmed: true;
};

const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalize = (value: unknown) => asText(value).normalize('NFKC').replace(/\s+/g, ' ');
const records = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  : [];

const DISCUSSION_PATTERN = /(?:نوصي|يوصى|يُعزى|يرجع\s+ذلك|يفس[ّ]?ر|بسبب|يبرهن|يثبت\s+أن|تتفق\s+مع|تختلف\s+عن|recommend|because|explains?|proves?|consistent\s+with)/iu;

function numericTokens(value: string) {
  return [...value.matchAll(/(?:^|\s)([-+]?\d+(?:[.,]\d+)?%?)(?=\s|$|[،؛:()])/gu)].map((match) => match[1].replace(',', '.'));
}

export function researchResultsStructureIssue(output: Record<string, unknown> | undefined): string | null {
  if (!output) return 'راجع صياغة النتائج واعتمدها قبل المتابعة.';
  if (output.reportingOnlyConfirmed !== true) return 'أكد أن هذا القسم يعرض النتائج فقط ويؤجل تفسيرها إلى المناقشة.';
  const results = records(output.results);
  if (!results.length) return 'يجب أن توجد نتيجة واحدة على الأقل مرتبطة بسؤال بحث.';
  for (const [index, result] of results.entries()) {
    if (!Number.isInteger(result.questionIndex) || Number(result.questionIndex) < 0) return `النتيجة ${index + 1}: ارتباط السؤال غير صالح.`;
    const issue = assessAcademicText(result.resultStatement, { minChars: 35, minWords: 6, label: `صياغة النتيجة ${index + 1}` });
    if (!issue.valid) return issue.reason;
    if (DISCUSSION_PATTERN.test(asText(result.resultStatement))) return `النتيجة ${index + 1} تتضمن تفسيراً أو توصية. انقل هذا المعنى لاحقاً إلى المناقشة أو التوصيات.`;
  }
  const summaryIssue = assessAcademicText(output.overallSummary, { minChars: 45, minWords: 8, label: 'الخلاصة العامة للنتائج' });
  if (!summaryIssue.valid) return summaryIssue.reason;
  const limitationsIssue = assessAcademicText(output.limitations, { minChars: 20, minWords: 4, label: 'حدود عرض النتائج' });
  return limitationsIssue.valid ? null : limitationsIssue.reason;
}

export function researchResultsConsistencyIssue(
  output: Record<string, unknown> | undefined,
  analysisInput: Record<string, unknown> | undefined,
): string | null {
  const structureIssue = researchResultsStructureIssue(output);
  if (structureIssue || !output) return structureIssue;
  const findings = records(analysisInput?.findings);
  const results = records(output.results);
  if (!findings.length) return 'لا توجد مخرجات تحليل خارجي معتمدة لبناء النتائج.';
  if (results.length !== findings.length) return 'يجب صياغة نتيجة واحدة لكل مخرج تحليل معتمد.';

  for (const [index, finding] of findings.entries()) {
    const result = results.find((item) => Number(item.questionIndex) === Number(finding.questionIndex));
    if (!result) return `لم تُصغ نتيجة للسؤال ${index + 1}.`;
    const lockedFields: Array<[unknown, unknown, string]> = [
      [result.questionText, finding.questionText, 'السؤال'],
      [result.hypothesisText, finding.hypothesisText, 'الفرضية'],
      [result.sourceFindingSummary, finding.findingSummary, 'خلاصة التحليل'],
      [result.sourceEvidenceSummary, finding.evidenceSummary, 'الدليل التحليلي'],
    ];
    const changed = lockedFields.find(([actual, expected]) => normalize(actual) !== normalize(expected));
    if (changed) return `النتيجة ${index + 1}: ${changed[2]} لا يطابق المخرج المعتمد ولا يمكن تغييره من هذه المرحلة.`;
    const sourceNumbers = numericTokens(`${asText(finding.findingSummary)} ${asText(finding.evidenceSummary)}`);
    const statementNumbers = new Set(numericTokens(asText(result.resultStatement)));
    const missingNumber = sourceNumbers.find((token) => !statementNumbers.has(token));
    if (missingNumber) return `النتيجة ${index + 1}: القيمة «${missingNumber}» موجودة في التحليل المعتمد لكنها سقطت من الصياغة.`;
  }
  return null;
}

export function buildResultsDraft(analysisInput: Record<string, unknown> | undefined): ResearchResultsOutput | null {
  const findings = records(analysisInput?.findings);
  if (!findings.length) return null;
  const results = findings.map((finding) => {
    const findingSummary = asText(finding.findingSummary);
    const evidenceSummary = asText(finding.evidenceSummary);
    return {
      questionIndex: Number(finding.questionIndex),
      questionText: asText(finding.questionText),
      hypothesisIndex: Number.isInteger(finding.hypothesisIndex) ? Number(finding.hypothesisIndex) : null,
      hypothesisText: asText(finding.hypothesisText) || null,
      sourceFindingSummary: findingSummary,
      sourceEvidenceSummary: evidenceSummary,
      resultStatement: `${findingSummary} ويستند هذا الوصف إلى المخرج التحليلي الآتي: ${evidenceSummary}`,
    } satisfies ResearchResultItem;
  });
  return {
    results,
    overallSummary: `أظهرت مخرجات التحليل المعتمدة نتائج مرتبطة بأسئلة الدراسة، وتمثلت بصورة عامة في: ${results.map((item) => item.sourceFindingSummary).join('؛ ')}.`,
    limitations: asText(analysisInput?.limitations),
    reportingOnlyConfirmed: true,
  };
}
