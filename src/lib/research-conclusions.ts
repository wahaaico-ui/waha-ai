import { assessAcademicText } from '@/lib/academic-content-quality';

export type ResearchConclusionItem = {
  questionIndex: number;
  questionText: string;
  resultStatement: string;
  discussionInterpretation: string;
  conclusionStatement: string;
};

export type ResearchConclusionsOutput = {
  conclusions: ResearchConclusionItem[];
  overallConclusion: string;
  scopeStatement: string;
  noNewEvidenceConfirmed: true;
  noRecommendationsConfirmed: true;
};

type RecordValue = Record<string, unknown>;

const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalize = (value: unknown) => asText(value).normalize('NFKC').replace(/\s+/g, ' ');
const records = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  : [];

const RECOMMENDATION_PATTERN = /(?:نوصي|يوصى|يُوصى|ينبغي\s+(?:تطبيق|تنفيذ|اعتماد)|يجب\s+(?:تطبيق|تنفيذ|اعتماد)|recommend(?:ed|ation)?|should\s+be\s+(?:implemented|adopted))/iu;

function numericTokens(value: string) {
  return [...value.matchAll(/(?:^|\s)([-+]?\d+(?:[.,]\d+)?%?)(?=\s|$|[،؛:()])/gu)]
    .map((match) => match[1].replace(',', '.'));
}

export function researchConclusionsStructureIssue(output: RecordValue | undefined): string | null {
  if (!output) return 'راجع الاستنتاجات واعتمدها قبل المتابعة.';
  if (output.noNewEvidenceConfirmed !== true) return 'أكد أن الاستنتاجات لا تضيف دليلاً أو نتيجة جديدة.';
  if (output.noRecommendationsConfirmed !== true) return 'أكد أن التوصيات مؤجلة إلى مرحلتها المستقلة.';
  const conclusions = records(output.conclusions);
  if (!conclusions.length) return 'يجب أن يوجد استنتاج واحد على الأقل مرتبط بسؤال البحث.';

  for (const [index, conclusion] of conclusions.entries()) {
    if (!Number.isInteger(conclusion.questionIndex) || Number(conclusion.questionIndex) < 0) return `الاستنتاج ${index + 1}: ارتباط السؤال غير صالح.`;
    const issue = assessAcademicText(conclusion.conclusionStatement, { minChars: 45, minWords: 8, label: `صياغة الاستنتاج ${index + 1}` });
    if (!issue.valid) return issue.reason;
    if (RECOMMENDATION_PATTERN.test(asText(conclusion.conclusionStatement))) return `الاستنتاج ${index + 1} يتضمن توصية تنفيذية. انقلها إلى مرحلة التوصيات.`;
  }

  const overallIssue = assessAcademicText(output.overallConclusion, { minChars: 60, minWords: 10, label: 'الاستنتاج العام للدراسة' });
  if (!overallIssue.valid) return overallIssue.reason;
  const scopeIssue = assessAcademicText(output.scopeStatement, { minChars: 35, minWords: 6, label: 'حدود انطباق الاستنتاجات' });
  return scopeIssue.valid ? null : scopeIssue.reason;
}

export function researchConclusionsConsistencyIssue(
  output: RecordValue | undefined,
  discussionOutput: RecordValue | undefined,
): string | null {
  const structureIssue = researchConclusionsStructureIssue(output);
  if (structureIssue || !output) return structureIssue;
  const discussions = records(discussionOutput?.discussions);
  const conclusions = records(output.conclusions);
  if (!discussions.length) return 'لا توجد مناقشة معتمدة يمكن اشتقاق الاستنتاجات منها.';
  if (conclusions.length !== discussions.length) return 'يجب صياغة استنتاج واحد لكل نتيجة تمت مناقشتها.';

  for (const [index, discussion] of discussions.entries()) {
    const conclusion = conclusions.find((item) => Number(item.questionIndex) === Number(discussion.questionIndex));
    if (!conclusion) return `لم يُكتب استنتاج للسؤال ${index + 1}.`;
    const lockedFields: Array<[unknown, unknown, string]> = [
      [conclusion.questionText, discussion.questionText, 'سؤال البحث'],
      [conclusion.resultStatement, discussion.resultStatement, 'نص النتيجة'],
      [conclusion.discussionInterpretation, discussion.interpretation, 'تفسير المناقشة'],
    ];
    const changed = lockedFields.find(([actual, expected]) => normalize(actual) !== normalize(expected));
    if (changed) return `الاستنتاج ${index + 1}: ${changed[2]} لا يطابق المرحلة المعتمدة السابقة.`;

    const allowedNumbers = new Set(numericTokens(`${asText(discussion.resultStatement)} ${asText(discussion.interpretation)} ${asText(discussion.literatureComparison)}`));
    const inventedNumber = numericTokens(asText(conclusion.conclusionStatement)).find((token) => !allowedNumbers.has(token));
    if (inventedNumber) return `الاستنتاج ${index + 1}: القيمة «${inventedNumber}» لم تظهر في النتيجة أو المناقشة المعتمدتين.`;
  }
  return null;
}

export function buildConclusionsDraft(discussionOutput: RecordValue | undefined): ResearchConclusionsOutput | null {
  const discussions = records(discussionOutput?.discussions);
  if (!discussions.length) return null;
  return {
    conclusions: discussions.map((discussion) => ({
      questionIndex: Number(discussion.questionIndex),
      questionText: asText(discussion.questionText),
      resultStatement: asText(discussion.resultStatement),
      discussionInterpretation: asText(discussion.interpretation),
      conclusionStatement: '',
    })),
    overallConclusion: '',
    scopeStatement: asText(discussionOutput?.limitationsInterpretation),
    noNewEvidenceConfirmed: true,
    noRecommendationsConfirmed: true,
  };
}
