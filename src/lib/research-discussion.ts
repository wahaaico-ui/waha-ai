import { assessAcademicText } from '@/lib/academic-content-quality';

export type ResearchDiscussionItem = {
  questionIndex: number;
  questionText: string;
  resultStatement: string;
  interpretation: string;
  literatureComparison: string;
  supportingPaperIds: string[];
};

export type ResearchDiscussionOutput = {
  discussions: ResearchDiscussionItem[];
  overallSynthesis: string;
  limitationsInterpretation: string;
  evidenceGroundingConfirmed: true;
  noNewResultsConfirmed: true;
};

type RecordValue = Record<string, unknown>;

const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalize = (value: unknown) => asText(value).normalize('NFKC').replace(/\s+/g, ' ');
const records = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  : [];
const strings = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
  : [];

const RECOMMENDATION_PATTERN = /(?:نوصي|يوصى|يُوصى|ينبغي\s+(?:تطبيق|تنفيذ|اعتماد)|يجب\s+(?:تطبيق|تنفيذ|اعتماد)|recommend(?:ed|ation)?|should\s+be\s+(?:implemented|adopted))/iu;

function numericTokens(value: string) {
  return [...value.matchAll(/(?:^|\s)([-+]?\d+(?:[.,]\d+)?%?)(?=\s|$|[،؛:()])/gu)]
    .map((match) => match[1].replace(',', '.'));
}

function analysisEvidence(analysis: RecordValue | undefined) {
  const themes = records(analysis?.themes);
  const paperIds = new Set<string>();
  const textByPaperId = new Map<string, string[]>();
  for (const theme of themes) {
    const synthesis = asText(theme.synthesis);
    for (const paperId of strings(theme.supportingPaperIds)) {
      paperIds.add(paperId);
      textByPaperId.set(paperId, [...(textByPaperId.get(paperId) || []), synthesis]);
    }
  }
  return { paperIds, textByPaperId };
}

export function researchDiscussionStructureIssue(output: RecordValue | undefined): string | null {
  if (!output) return 'راجع المناقشة واعتمدها قبل المتابعة.';
  if (output.evidenceGroundingConfirmed !== true) return 'أكد أن المقارنة تعتمد فقط على الأدلة المختارة في مشروعك.';
  if (output.noNewResultsConfirmed !== true) return 'أكد أن المناقشة لا تضيف نتائج أو قيماً لم تظهر في التحليل المعتمد.';
  const discussions = records(output.discussions);
  if (!discussions.length) return 'يجب مناقشة نتيجة واحدة على الأقل مرتبطة بسؤال بحث.';

  for (const [index, discussion] of discussions.entries()) {
    if (!Number.isInteger(discussion.questionIndex) || Number(discussion.questionIndex) < 0) return `المناقشة ${index + 1}: ارتباط السؤال غير صالح.`;
    const interpretationIssue = assessAcademicText(discussion.interpretation, { minChars: 50, minWords: 8, label: `تفسير النتيجة ${index + 1}` });
    if (!interpretationIssue.valid) return interpretationIssue.reason;
    const comparisonIssue = assessAcademicText(discussion.literatureComparison, { minChars: 50, minWords: 8, label: `مقارنة الأدبيات ${index + 1}` });
    if (!comparisonIssue.valid) return comparisonIssue.reason;
    if (!strings(discussion.supportingPaperIds).length) return `المناقشة ${index + 1}: اختر دليلاً سابقاً واحداً على الأقل للمقارنة.`;
    if (RECOMMENDATION_PATTERN.test(`${asText(discussion.interpretation)} ${asText(discussion.literatureComparison)}`)) {
      return `المناقشة ${index + 1} تتضمن توصية تنفيذية. انقلها لاحقاً إلى مرحلة التوصيات.`;
    }
  }

  const synthesisIssue = assessAcademicText(output.overallSynthesis, { minChars: 60, minWords: 10, label: 'الخلاصة التفسيرية للمناقشة' });
  if (!synthesisIssue.valid) return synthesisIssue.reason;
  const limitationsIssue = assessAcademicText(output.limitationsInterpretation, { minChars: 35, minWords: 6, label: 'أثر حدود الدراسة في تفسير النتائج' });
  return limitationsIssue.valid ? null : limitationsIssue.reason;
}

export function researchDiscussionConsistencyIssue(
  output: RecordValue | undefined,
  resultsOutput: RecordValue | undefined,
  analysisOutput: RecordValue | undefined,
): string | null {
  const structureIssue = researchDiscussionStructureIssue(output);
  if (structureIssue || !output) return structureIssue;
  const results = records(resultsOutput?.results);
  const discussions = records(output.discussions);
  if (!results.length) return 'لا توجد نتائج معتمدة يمكن مناقشتها.';
  if (discussions.length !== results.length) return 'يجب مناقشة كل نتيجة معتمدة مرة واحدة.';

  const evidence = analysisEvidence(analysisOutput);
  if (!evidence.paperIds.size) return 'لا توجد أدلة مسندة من تحليل الأدبيات يمكن استخدامها في المناقشة.';

  for (const [index, result] of results.entries()) {
    const discussion = discussions.find((item) => Number(item.questionIndex) === Number(result.questionIndex));
    if (!discussion) return `لم تُكتب مناقشة لنتيجة السؤال ${index + 1}.`;
    if (normalize(discussion.questionText) !== normalize(result.questionText)) return `المناقشة ${index + 1}: سؤال البحث لا يطابق السؤال المعتمد.`;
    if (normalize(discussion.resultStatement) !== normalize(result.resultStatement)) return `المناقشة ${index + 1}: نص النتيجة تغيّر، ويجب مناقشة النتيجة المعتمدة كما هي.`;

    const selectedIds = [...new Set(strings(discussion.supportingPaperIds))];
    if (selectedIds.length !== strings(discussion.supportingPaperIds).length) return `المناقشة ${index + 1}: توجد أدلة مكررة.`;
    const invalidId = selectedIds.find((paperId) => !evidence.paperIds.has(paperId));
    if (invalidId) return `المناقشة ${index + 1}: الدليل المحدد غير موجود في التخليق الأدبي المعتمد.`;

    const allowedEvidenceText = selectedIds.flatMap((paperId) => evidence.textByPaperId.get(paperId) || []).join(' ');
    const allowedNumbers = new Set(numericTokens(`${asText(result.resultStatement)} ${allowedEvidenceText}`));
    const discussionNumbers = numericTokens(`${asText(discussion.interpretation)} ${asText(discussion.literatureComparison)}`);
    const inventedNumber = discussionNumbers.find((token) => !allowedNumbers.has(token));
    if (inventedNumber) return `المناقشة ${index + 1}: القيمة «${inventedNumber}» غير موجودة في النتيجة أو الأدلة المحددة.`;
  }
  return null;
}

export function buildDiscussionDraft(resultsOutput: RecordValue | undefined): ResearchDiscussionOutput | null {
  const results = records(resultsOutput?.results);
  if (!results.length) return null;
  return {
    discussions: results.map((result) => ({
      questionIndex: Number(result.questionIndex),
      questionText: asText(result.questionText),
      resultStatement: asText(result.resultStatement),
      interpretation: '',
      literatureComparison: '',
      supportingPaperIds: [],
    })),
    overallSynthesis: '',
    limitationsInterpretation: asText(resultsOutput?.limitations),
    evidenceGroundingConfirmed: true,
    noNewResultsConfirmed: true,
  };
}
