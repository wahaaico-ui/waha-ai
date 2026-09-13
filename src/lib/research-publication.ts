import { assessAcademicText } from '@/lib/academic-content-quality';
import { firstUnsupportedResearchNumber } from '@/lib/research-numeric-integrity';

export type PublicationTargetType = 'journal' | 'conference' | 'thesis' | 'repository';
export type ManuscriptLanguage = 'ar' | 'en' | 'bilingual';
export type PublicationCitationStyle = 'apa7' | 'harvard' | 'vancouver' | 'chicago' | 'venue_specific';
export type EthicsStatus = 'approved' | 'not_required' | 'pending';

export type ResearchPublicationOutput = {
  approvedTitle: string;
  targetType: PublicationTargetType;
  targetName: string;
  manuscriptLanguage: ManuscriptLanguage;
  citationStyle: PublicationCitationStyle;
  structuredAbstract: {
    background: string;
    objective: string;
    methods: string;
    results: string;
    conclusion: string;
  };
  keywords: string[];
  ethicsStatus: EthicsStatus;
  ethicsStatement: string;
  conflictOfInterestStatement: string;
  fundingStatement: string;
  dataAvailabilityStatement: string;
  aiUseDisclosure: string;
  originalSourcesReviewedConfirmed: boolean;
  authorshipConfirmed: boolean;
  venueGuidelinesConfirmed: boolean;
  noAcceptanceGuaranteeConfirmed: boolean;
};

type RecordValue = Record<string, unknown>;

const TARGET_TYPES: readonly PublicationTargetType[] = ['journal', 'conference', 'thesis', 'repository'];
const LANGUAGES: readonly ManuscriptLanguage[] = ['ar', 'en', 'bilingual'];
const CITATION_STYLES: readonly PublicationCitationStyle[] = ['apa7', 'harvard', 'vancouver', 'chicago', 'venue_specific'];
const ETHICS_STATUSES: readonly EthicsStatus[] = ['approved', 'not_required', 'pending'];
const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const records = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is RecordValue => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  : [];

function normalize(value: unknown) {
  return asText(value).normalize('NFKC').replace(/\s+/g, ' ');
}

function significantTokens(value: unknown) {
  return new Set(normalize(value).toLocaleLowerCase('ar').split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 4));
}

function sharesMeaning(candidate: unknown, source: unknown) {
  const candidateTokens = significantTokens(candidate);
  const sourceTokens = significantTokens(source);
  if (!candidateTokens.size || !sourceTokens.size) return false;
  const shared = [...candidateTokens].filter((token) => sourceTokens.has(token)).length;
  return shared / Math.min(candidateTokens.size, sourceTokens.size) >= 0.18;
}

function stringify(value: unknown) {
  try { return JSON.stringify(value); } catch { return ''; }
}

export function isPublicationTargetType(value: unknown): value is PublicationTargetType {
  return typeof value === 'string' && (TARGET_TYPES as readonly string[]).includes(value);
}

export function isManuscriptLanguage(value: unknown): value is ManuscriptLanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isPublicationCitationStyle(value: unknown): value is PublicationCitationStyle {
  return typeof value === 'string' && (CITATION_STYLES as readonly string[]).includes(value);
}

export function isEthicsStatus(value: unknown): value is EthicsStatus {
  return typeof value === 'string' && (ETHICS_STATUSES as readonly string[]).includes(value);
}

export function researchPublicationStructureIssue(output: RecordValue | undefined): string | null {
  if (!output) return 'أكمل حزمة الجاهزية للنشر قبل إنهاء الرحلة.';
  if (!isPublicationTargetType(output.targetType)) return 'حدّد نوع المخرج المستهدف للنشر.';
  if (!isManuscriptLanguage(output.manuscriptLanguage)) return 'حدّد لغة المخطوط.';
  if (!isPublicationCitationStyle(output.citationStyle)) return 'حدّد نمط التوثيق المطلوب.';
  if (!isEthicsStatus(output.ethicsStatus)) return 'حدّد حالة المراجعة الأخلاقية.';
  if (output.ethicsStatus === 'pending') return 'الموافقة الأخلاقية ما زالت معلّقة؛ لا يمكن اعتماد الجاهزية للنشر قبل حسمها.';

  const textFields: Array<[unknown, string, number, number]> = [
    [output.approvedTitle, 'العنوان المعتمد', 15, 4],
    [output.targetName, 'اسم جهة أو مسار النشر', 5, 1],
    [(output.structuredAbstract as RecordValue | undefined)?.background, 'خلفية الملخص', 45, 8],
    [(output.structuredAbstract as RecordValue | undefined)?.objective, 'هدف الملخص', 30, 6],
    [(output.structuredAbstract as RecordValue | undefined)?.methods, 'منهجية الملخص', 45, 8],
    [(output.structuredAbstract as RecordValue | undefined)?.results, 'نتائج الملخص', 45, 8],
    [(output.structuredAbstract as RecordValue | undefined)?.conclusion, 'استنتاج الملخص', 45, 8],
    [output.ethicsStatement, 'بيان الأخلاقيات', 30, 5],
    [output.conflictOfInterestStatement, 'بيان تضارب المصالح', 20, 4],
    [output.fundingStatement, 'بيان التمويل', 15, 3],
    [output.dataAvailabilityStatement, 'بيان إتاحة البيانات', 25, 5],
    [output.aiUseDisclosure, 'بيان استخدام أدوات الذكاء الاصطناعي', 30, 5],
  ];
  for (const [value, label, minChars, minWords] of textFields) {
    const assessment = assessAcademicText(value, { minChars, minWords, label });
    if (!assessment.valid) return assessment.reason;
  }

  const keywords = Array.isArray(output.keywords) ? output.keywords.map(asText).filter(Boolean) : [];
  if (keywords.length < 3 || keywords.length > 8) return 'أضف من 3 إلى 8 كلمات مفتاحية دقيقة.';
  if (new Set(keywords.map((keyword) => keyword.toLocaleLowerCase('ar'))).size !== keywords.length) return 'احذف الكلمات المفتاحية المكررة.';
  if (keywords.some((keyword) => keyword.length < 3 || keyword.length > 80)) return 'كل كلمة مفتاحية يجب أن تكون واضحة ومختصرة.';

  if (output.originalSourcesReviewedConfirmed !== true) return 'أكد مراجعة المصادر الأصلية وصحة المراجع قبل النشر.';
  if (output.authorshipConfirmed !== true) return 'أكد مسؤولية المؤلفين وموافقتهم على النسخة.';
  if (output.venueGuidelinesConfirmed !== true) return 'أكد مراجعة تعليمات جهة النشر المستهدفة.';
  if (output.noAcceptanceGuaranteeConfirmed !== true) return 'أكد فهمك أن الجاهزية لا تعني ضمان القبول أو النشر.';
  return null;
}

export function researchPublicationConsistencyIssue(
  output: RecordValue | undefined,
  sources: {
    title?: RecordValue;
    problem?: RecordValue;
    objectives?: RecordValue;
    methodology?: RecordValue;
    design?: RecordValue;
    results?: RecordValue;
    conclusions?: RecordValue;
  },
): string | null {
  const structureIssue = researchPublicationStructureIssue(output);
  if (structureIssue || !output) return structureIssue;
  const approvedTitle = asText(sources.title?.title);
  if (!approvedTitle || normalize(output.approvedTitle) !== normalize(approvedTitle)) return 'عنوان حزمة النشر لا يطابق العنوان المعتمد في الرحلة.';

  const abstract = output.structuredAbstract as RecordValue;
  const comparisons: Array<[unknown, unknown, string]> = [
    [abstract.background, sources.problem, 'خلفية الملخص لا ترتبط بمشكلة البحث المعتمدة.'],
    [abstract.objective, sources.objectives, 'هدف الملخص لا يرتبط بالأهداف المعتمدة.'],
    [abstract.methods, { methodology: sources.methodology, design: sources.design }, 'منهجية الملخص لا ترتبط بتصميم الدراسة المعتمد.'],
    [abstract.results, sources.results, 'نتائج الملخص لا ترتبط بالنتائج المعتمدة.'],
    [abstract.conclusion, sources.conclusions, 'استنتاج الملخص لا يرتبط بالاستنتاجات المعتمدة.'],
  ];
  for (const [candidate, source, message] of comparisons) {
    if (!sharesMeaning(candidate, stringify(source))) return message;
  }

  const unsupportedNumber = firstUnsupportedResearchNumber(stringify(abstract), stringify(sources));
  if (unsupportedNumber) return `الملخص يتضمن القيمة «${unsupportedNumber}» وهي غير موجودة في المخرجات المعتمدة.`;
  return null;
}

function joinStrings(value: unknown) {
  return Array.isArray(value) ? value.map(asText).filter(Boolean).join(' ') : '';
}

function keywordsFrom(title: string) {
  const ignored = new Set(['دراسة', 'البحث', 'على', 'إلى', 'في', 'من', 'عن', 'لدى', 'بين', 'أثر', 'دور', 'the', 'and', 'for', 'with', 'from']);
  return [...significantTokens(title)].filter((token) => !ignored.has(token)).slice(0, 6);
}

export function buildPublicationDraft(outputs: Partial<Record<string, RecordValue>>): ResearchPublicationOutput | null {
  const approvedTitle = asText(outputs.title?.title);
  const results = records(outputs.results?.results);
  const conclusions = records(outputs.conclusions?.conclusions);
  if (!approvedTitle || !results.length || !conclusions.length) return null;
  const methodology = outputs.methodology || {};
  const design = outputs.design || {};
  const population = design.population && typeof design.population === 'object' ? design.population as RecordValue : {};
  const sample = design.sample && typeof design.sample === 'object' ? design.sample as RecordValue : {};
  const methods = [
    `اعتمدت الدراسة منهج ${asText(methodology.approach) || 'يتوافق مع طبيعة السؤال البحثي'}.`,
    asText(population.description) || asText(methodology.population),
    asText(sample.strategy) || asText(methodology.sample),
    asText(methodology.instrument),
  ].filter(Boolean).join(' ');

  return {
    approvedTitle,
    targetType: 'journal',
    targetName: '',
    manuscriptLanguage: 'ar',
    citationStyle: 'apa7',
    structuredAbstract: {
      background: asText(outputs.problem?.problemStatement),
      objective: joinStrings(outputs.objectives?.objectives),
      methods,
      results: asText(outputs.results?.overallSummary) || results.map((item) => asText(item.resultStatement)).join(' '),
      conclusion: asText(outputs.conclusions?.overallConclusion) || conclusions.map((item) => asText(item.conclusionStatement)).join(' '),
    },
    keywords: keywordsFrom(approvedTitle),
    ethicsStatus: 'pending',
    ethicsStatement: '',
    conflictOfInterestStatement: 'يصرّح الباحث بعدم وجود تضارب مصالح يؤثر في هذه الدراسة.',
    fundingStatement: 'لم تتلق هذه الدراسة تمويلاً خارجياً.',
    dataAvailabilityStatement: '',
    aiUseDisclosure: 'استُخدمت WAHA لتنظيم الاتساق وصياغة المسودة، وبقيت مراجعة المحتوى والمصادر ومسؤولية القرار العلمي على الباحث.',
    originalSourcesReviewedConfirmed: true,
    authorshipConfirmed: false,
    venueGuidelinesConfirmed: false,
    noAcceptanceGuaranteeConfirmed: true,
  };
}
