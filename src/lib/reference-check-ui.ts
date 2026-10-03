// Arabic wording for the reference check. Conservative by design: a reference
// is found or not found in the indexes searched; it is never called fake,
// invalid or verified.
import type { ReferenceCheckReport, ReferenceDifference, ReferenceStatus } from '@/lib/reference-check';
import type { Tone } from '@/lib/research-intelligence-ui';

export const REFERENCE_STATUS_LABELS: Record<ReferenceStatus, { label: string; tone: Tone; explanation: string }> = {
  doi_mismatch: { label: 'الـ DOI يشير إلى عمل آخر', tone: 'negative', explanation: 'المعرّف المذكور في المرجع مسجل لعمل بعنوان مختلف. راجع المعرّف أو بيانات المرجع.' },
  not_found: { label: 'لم يُعثر عليه في الفهارس التي بحثنا فيها', tone: 'negative', explanation: 'لا يوجد في هذه الفهارس سجل يقابل هذا المرجع. قد يكون موجوداً خارجها؛ تحقق منه يدوياً قبل اعتماده أو حذفه.' },
  matched_with_differences: { label: 'وُجد مع اختلاف في البيانات', tone: 'caution', explanation: 'وُجد سجل يقابل المرجع، لكن بعض البيانات المذكورة تختلف عما في الفهرس.' },
  matched: { label: 'وُجد وبياناته متطابقة', tone: 'positive', explanation: 'وُجد سجل بالعنوان نفسه، وتتفق السنة والمؤلف والمعرّف حيث ذُكرت. هذا لا يعني أن المصدر يدعم ما استُشهد به لأجله.' },
  not_checked: { label: 'لم يُفحص: تعذر الوصول إلى الفهارس', tone: 'neutral', explanation: 'لم تستجب الفهارس أثناء الفحص. أعد المحاولة لاحقاً.' },
  unparsed: { label: 'تعذرت قراءة المرجع', tone: 'neutral', explanation: 'لم نتمكن من استخراج عنوان أو معرّف من هذا المرجع.' },
};

/** Attention order: the statuses a researcher should look at first. */
export const STATUS_ORDER: ReferenceStatus[] = ['doi_mismatch', 'not_found', 'matched_with_differences', 'not_checked', 'unparsed', 'matched'];

export const DIFFERENCE_FIELD_LABELS: Record<ReferenceDifference['field'], string> = { title: 'العنوان', year: 'السنة', author: 'المؤلف الأول', doi: 'DOI' };

export const REFERENCE_PROVIDER_NAMES: Record<string, string> = { crossref: 'Crossref', openalex: 'OpenAlex' };

export const ARABIC_COVERAGE_NOTE = 'مرجع عربي: تغطية هذه الفهارس للمنشورات العربية محدودة، فعدم العثور عليه لا يدل على عدم وجوده.';

export function referenceCheckLimitations(report: Pick<ReferenceCheckReport, 'truncated' | 'totalFound' | 'arabicReferences' | 'counts' | 'sectionDetected'>, maxReferences: number) {
  const limitations = [
    'يقارن هذا الفحص كل مرجع بالسجلات التي أعادتها الفهارس التي بحثنا فيها. لا يحكم على محتوى أي عمل أو جودته، ووجود المرجع لا يعني أنه يدعم ما استُشهد به لأجله.',
    'المرجع الذي لم يُعثر عليه قد يكون موجوداً: الكتب والرسائل الجامعية وأوراق المؤتمرات والمجلات الإقليمية كثيراً ما تغيب عن هذه الفهارس. تحقق منه يدوياً قبل تعديل أي شيء.',
    'تُقرأ المراجع من النص بقواعد ثابتة، وقد يُقرأ أسلوب توثيق غير معتاد بشكل خاطئ. يُعرض لكل نتيجة المرجعُ كما قُرئ.',
  ];
  if (report.truncated) limitations.push(`فُحص أول ${maxReferences} مرجعاً فقط من أصل ${report.totalFound}.`);
  if (report.arabicReferences) limitations.push(`يتضمن النص ${report.arabicReferences} من المراجع العربية، وتغطية هذه الفهارس لها محدودة.`);
  if (report.counts.not_checked) limitations.push(`تعذر فحص ${report.counts.not_checked} من المراجع لأن الفهارس لم تستجب؛ أعد المحاولة لاحقاً.`);
  if (!report.sectionDetected) limitations.push('لم نجد عنوان قسم للمراجع، فعُومل النص كله على أنه قائمة مراجع.');
  return limitations;
}
