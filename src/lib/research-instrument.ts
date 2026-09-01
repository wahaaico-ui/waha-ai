export const STUDY_INSTRUMENT_TYPES = [
  'questionnaire',
  'interview',
  'observation',
  'document_analysis',
  'test_scale',
] as const;

export type StudyInstrumentType = (typeof STUDY_INSTRUMENT_TYPES)[number];

export type InstrumentRecommendationInput = {
  approach?: unknown;
  methodologyInstrument?: unknown;
  questions?: unknown;
};

export type InstrumentRecommendation = {
  type: StudyInstrumentType;
  label: string;
  reason: string;
  guidance: string[];
  complementaryType?: StudyInstrumentType;
};

const labels: Record<StudyInstrumentType, string> = {
  questionnaire: 'استبانة',
  interview: 'مقابلة شبه منظّمة',
  observation: 'بطاقة ملاحظة',
  document_analysis: 'بطاقة تحليل وثائق/محتوى',
  test_scale: 'اختبار أو مقياس مقنّن',
};

export function isStudyInstrumentType(value: unknown): value is StudyInstrumentType {
  return typeof value === 'string' && (STUDY_INSTRUMENT_TYPES as readonly string[]).includes(value);
}

export function instrumentLabel(type: StudyInstrumentType) {
  return labels[type];
}

function normalizedText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('ar') : '';
}

function questionText(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join(' ').toLocaleLowerCase('ar')
    : '';
}

export function collectionGuidanceFor(type: StudyInstrumentType): string[] {
  const common = [
    'احصل على الموافقة الأخلاقية والمؤسسية المطلوبة قبل التواصل مع المشاركين أو الوصول إلى السجلات.',
    'نفّذ تجربة استطلاعية محدودة، ووثّق أي تعديل على الأداة قبل التطبيق الفعلي.',
    'احفظ البيانات دون معرّفات مباشرة، وطبّق خطة آمنة للصلاحيات والنسخ الاحتياطي والاحتفاظ.',
    'سجّل ظروف الجمع والانحرافات والاستجابات الناقصة؛ WAHA لا تجمع البيانات ولا تجري التحليل الإحصائي نيابةً عنك.',
  ];
  if (type === 'questionnaire') return [
    'حدّد إطار العينة وقناة التوزيع وفترة الاستجابة مسبقاً، وتجنّب إرسال الدعوة خارج مجتمع الدراسة.',
    'استخدم دعوة موحّدة، وراقب معدل الاستجابة دون جمع بيانات تعريفية غير لازمة.',
    ...common,
  ];
  if (type === 'interview') return [
    'درّب القائم بالمقابلة على الأسئلة والمتابعات المحايدة، ولا توجّه المشارك نحو إجابة بعينها.',
    'اطلب موافقة منفصلة على التسجيل، وحدّد آلية التفريغ وإخفاء الهوية ومتى يُحذف التسجيل.',
    'استمر وفق مبرر العينة المعتمد، ووثّق تشبع البيانات بدلاً من افتراضه مسبقاً.',
    ...common,
  ];
  if (type === 'observation') return [
    'عرّف السلوك أو الحدث القابل للملاحظة وحدود وحدة التسجيل قبل بدء الميدان.',
    'درّب الملاحظين واختبر اتفاقهم على الترميز عندما يوجد أكثر من ملاحظ.',
    'وثّق الوقت والمكان والسياق دون تسجيل هوية الأفراد إلا لضرورة معتمدة أخلاقياً.',
    ...common,
  ];
  if (type === 'document_analysis') return [
    'حدّد مجتمع الوثائق ومعايير الإدراج والاستبعاد والفترة الزمنية قبل الاختيار.',
    'احتفظ ببيانات المصدر وسلسلة القرار لكل وثيقة، وميّز بين النص الأصلي وتفسير الباحث.',
    'اختبر دليل الترميز على عينة وثائق، وراجع اتساق الترميز قبل استكمال corpus الدراسة.',
    ...common,
  ];
  return [
    'تحقق من الترخيص وملاءمة النسخة اللغوية والثقافية وخصائص الصدق والثبات في مجتمع قريب من مجتمعك.',
    'لا تعِد صياغة بنود مقياس محمي أو تغيّر طريقة التصحيح دون إذن صاحب الحقوق وتبرير منهجي.',
    'التزم بتعليمات التطبيق والتصحيح الرسمية، واستعن بمتخصص عندما يتطلب الاختبار تأهيلاً مهنياً.',
    ...common,
  ];
}

export function recommendStudyInstrument(input: InstrumentRecommendationInput): InstrumentRecommendation {
  const approach = normalizedText(input.approach);
  const declared = normalizedText(input.methodologyInstrument);
  const questions = questionText(input.questions);
  const combined = `${declared} ${questions}`;

  let type: StudyInstrumentType;
  let reason: string;
  let complementaryType: StudyInstrumentType | undefined;

  if (/وثائق|محتوى|سجلات|تقارير|document|content analysis/u.test(combined)) {
    type = 'document_analysis';
    reason = 'أسئلتك أو منهجيتك تعتمد على وثائق أو سجلات قائمة؛ لذلك يلزم دليل ترميز يحدد وحدة التحليل والفئات ومصدر كل دليل.';
  } else if (/ملاحظ|سلوك|صف(?:ي|ية)|observation/u.test(combined)) {
    type = 'observation';
    reason = 'التركيز على سلوك أو ممارسة قابلة للرصد يجعل بطاقة الملاحظة أكثر مباشرة من الاعتماد على التقارير الذاتية وحدها.';
  } else if (/اختبار|مقياس مقنن|مقياس مقنّن|قدرات|تحصيل|test|validated scale/u.test(combined)) {
    type = 'test_scale';
    reason = 'السؤال يتطلب قياساً معيارياً أو بنية مقنّنة؛ يجب اختيار أداة مرخّصة وموثقة الخصائص بدلاً من اختراع مقياس جديد.';
  } else if (approach === 'qualitative' || /مقابل|خبرات|تجارب|تصورات|كيف|لماذا|interview/u.test(combined)) {
    type = 'interview';
    reason = 'المنهج أو الأسئلة تستهدف الفهم المتعمق للخبرات والتفسيرات؛ المقابلة شبه المنظّمة تسمح بأسئلة ثابتة ومتابعات مرنة.';
  } else {
    type = 'questionnaire';
    reason = 'التصميم يقيس متغيرات أو أنماط استجابة قابلة للتوحيد عبر عينة؛ الاستبانة هي الأداة الأولية الأكثر اتساقاً مع هذا الغرض.';
  }

  if (approach === 'mixed') {
    complementaryType = type === 'questionnaire' ? 'interview' : 'questionnaire';
    reason += ` ولأن المنهج مختلط، يمكن إضافة ${labels[complementaryType]} كأداة مكملة بعد تحديد ترتيب الدمج بين الشقين.`;
  }

  return { type, label: labels[type], reason, guidance: collectionGuidanceFor(type), complementaryType };
}
