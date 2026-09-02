import { assessAcademicText } from '@/lib/academic-content-quality';

export const EXTERNAL_ANALYSIS_KINDS = ['quantitative', 'qualitative', 'mixed'] as const;
export type ExternalAnalysisKind = (typeof EXTERNAL_ANALYSIS_KINDS)[number];

export const ANALYST_ROLES = ['researcher', 'statistical_specialist', 'research_team'] as const;
export type AnalystRole = (typeof ANALYST_ROLES)[number];

export type ExternalAnalysisFinding = {
  questionIndex: number;
  questionText: string;
  hypothesisIndex: number | null;
  hypothesisText: string | null;
  findingSummary: string;
  evidenceSummary: string;
};

export type ExternalAnalysisInput = {
  analysisKind: ExternalAnalysisKind;
  analyzedBy: AnalystRole;
  softwareOrMethod: string;
  sampleAnalyzed: string;
  procedureSummary: string;
  findings: ExternalAnalysisFinding[];
  limitations: string;
  noRawDataConfirmed: true;
  noPersonalDataConfirmed: true;
};

const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalize = (value: unknown) => asText(value).normalize('NFKC').replace(/\s+/g, ' ');
const asTextList = (value: unknown) => Array.isArray(value)
  ? value.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : [])
  : [];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){8,}/u;
const IDENTIFIER_LABEL_PATTERN = /(?:رقم\s*(?:الهوية|الجوال|الهاتف)|اسم\s*(?:المشارك|المبحوث)|national\s+id|participant\s+name|phone\s+number)/iu;

function hasLikelyDirectIdentifier(value: unknown): boolean {
  if (typeof value === 'string') return EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value) || IDENTIFIER_LABEL_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(hasLikelyDirectIdentifier);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasLikelyDirectIdentifier);
  return false;
}

function findingRecords(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

export function externalAnalysisStructureIssue(output: Record<string, unknown> | undefined): string | null {
  if (!output) return 'أدخل ملخص مخرجات التحليل الذي أُنجز خارج WAHA.';
  if (!(EXTERNAL_ANALYSIS_KINDS as readonly unknown[]).includes(output.analysisKind)) return 'حدّد نوع التحليل الذي أُنجز خارج WAHA.';
  if (!(ANALYST_ROLES as readonly unknown[]).includes(output.analyzedBy)) return 'حدّد من نفّذ التحليل الخارجي.';
  if (output.noRawDataConfirmed !== true || output.noPersonalDataConfirmed !== true) return 'يجب تأكيد عدم رفع بيانات خام أو معلومات شخصية قبل الحفظ.';
  if (hasLikelyDirectIdentifier(output)) return 'يبدو أن المخرج يتضمن اسماً أو بريداً أو هاتفاً أو معرّفاً شخصياً. احذفه وأدخل ملخصاً مجهول الهوية فقط.';

  const fieldChecks = [
    assessAcademicText(output.softwareOrMethod, { minChars: 8, minWords: 2, label: 'أداة أو طريقة التحليل' }),
    assessAcademicText(output.sampleAnalyzed, { minChars: 15, minWords: 3, label: 'ملخص البيانات التي شملها التحليل' }),
    assessAcademicText(output.procedureSummary, { minChars: 30, minWords: 6, label: 'إجراءات التحليل' }),
    assessAcademicText(output.limitations, { minChars: 20, minWords: 4, label: 'حدود التحليل' }),
  ];
  const fieldIssue = fieldChecks.find((result) => !result.valid);
  if (fieldIssue) return fieldIssue.reason;

  const findings = findingRecords(output.findings);
  if (!findings.length) return 'أضف مخرجاً واحداً على الأقل مرتبطاً بسؤال البحث.';
  for (const [index, finding] of findings.entries()) {
    if (!Number.isInteger(finding.questionIndex) || Number(finding.questionIndex) < 0) return `المخرج ${index + 1}: ارتباط سؤال البحث غير صالح.`;
    const findingIssue = assessAcademicText(finding.findingSummary, { minChars: 25, minWords: 5, label: `خلاصة المخرج ${index + 1}` });
    if (!findingIssue.valid) return findingIssue.reason;
    const evidenceIssue = assessAcademicText(finding.evidenceSummary, { minChars: 20, minWords: 4, label: `دليل المخرج ${index + 1}` });
    if (!evidenceIssue.valid) return evidenceIssue.reason;
  }
  return null;
}

export function externalAnalysisConsistencyIssue(
  output: Record<string, unknown> | undefined,
  questionsOutput: Record<string, unknown> | undefined,
  hypothesesOutput: Record<string, unknown> | undefined,
  methodologyOutput: Record<string, unknown> | undefined,
): string | null {
  const structureIssue = externalAnalysisStructureIssue(output);
  if (structureIssue || !output) return structureIssue;

  const questions = asTextList(questionsOutput?.questions);
  if (!questions.length) return 'لا توجد أسئلة بحث معتمدة لربط مخرجات التحليل بها.';
  const findings = findingRecords(output.findings);
  if (findings.length !== questions.length) return 'يجب تسجيل مخرج واحد واضح لكل سؤال بحث معتمد.';

  const byQuestion = new Map(findings.map((finding) => [Number(finding.questionIndex), finding]));
  if (byQuestion.size !== questions.length) return 'توجد مخرجات مكررة لسؤال واحد أو سؤال بلا مخرج.';
  for (const [questionIndex, question] of questions.entries()) {
    const finding = byQuestion.get(questionIndex);
    if (!finding || normalize(finding.questionText) !== normalize(question)) return `المخرج المرتبط بالسؤال ${questionIndex + 1} لا يطابق السؤال المعتمد في المشروع.`;
  }

  const hypothesesRequired = hypothesesOutput?.mode === 'required';
  const hypotheses = hypothesesRequired ? asTextList(hypothesesOutput?.hypotheses) : [];
  if (hypothesesRequired && hypotheses.length !== questions.length) return 'عدد الفرضيات المعتمدة لا يطابق أسئلة البحث؛ راجع مرحلة الفرضيات أولاً.';
  for (const [questionIndex, finding] of byQuestion) {
    if (!hypothesesRequired) {
      if (finding.hypothesisIndex !== null || asText(finding.hypothesisText)) return 'هذه الدراسة لا تستخدم فرضيات؛ احذف ربط الفرضية من المخرج.';
      continue;
    }
    if (Number(finding.hypothesisIndex) !== questionIndex || normalize(finding.hypothesisText) !== normalize(hypotheses[questionIndex])) {
      return `المخرج المرتبط بالسؤال ${questionIndex + 1} لا يطابق الفرضية المعتمدة المقابلة له.`;
    }
  }

  const approach = normalize(methodologyOutput?.approach).toLowerCase();
  const analysisKind = output.analysisKind;
  if (approach === 'quantitative' && analysisKind !== 'quantitative' && analysisKind !== 'mixed') return 'المنهج المعتمد كمي؛ سجّل تحليلاً كمياً أو مختلطاً متسقاً معه.';
  if (approach === 'qualitative' && analysisKind !== 'qualitative' && analysisKind !== 'mixed') return 'المنهج المعتمد نوعي؛ سجّل تحليلاً نوعياً أو مختلطاً متسقاً معه.';
  if (approach === 'mixed' && analysisKind !== 'mixed') return 'المنهج المعتمد مختلط؛ يجب أن يلخص المخرج جانبي التحليل الكمي والنوعي.';
  return null;
}
