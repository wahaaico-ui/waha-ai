function cleanText(value: unknown, maxLength = 800) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function buildProblemDraftFallback(context: Record<string, unknown>) {
  const title = cleanText(record(context.title)?.title, 500);
  if (!title) return null;

  const verify = record(context.verify);
  const firstGap = Array.isArray(verify?.gaps)
    ? verify.gaps.map((item) => cleanText(item, 500)).find(Boolean) || ''
    : '';

  // A title or an exploration hint is not evidence about the state of the literature.
  // This fallback provides a review scaffold, never a finding about missing studies.
  const problemStatement = `هذه صياغة إرشادية أولية لدراسة موضوع «${title}»، وليست وصفاً لواقع ثبت بالأدلة. لتحديد مشكلة قابلة للدراسة، يوضح الباحث الظاهرة التي يريد فهمها، ومن يتأثر بها، وحدود المكان والزمن، ثم يربط هذا الوصف بملاحظات أو مصادر يمكن مراجعتها. بعد ذلك يحدد المفاهيم وطريقة فحصها بما يناسب طبيعة السؤال، دون افتراض وجود أثر أو علاقة أو نتيجة مسبقاً. يلزم استكمال هذه المعطيات ومراجعة الصياغة قبل اعتمادها مشكلةً للبحث.`;
  const researchGap = firstGap
    ? `ملاحظة محفوظة غير متحققة من الاستكشاف: «${firstGap}». هذه الملاحظة ليست دليلاً على فجوة علمية في موضوع «${title}». افحص الدراسات الأصلية وسياقاتها ومناهجها، وسجّل مراجع ما حُسم وما بقي غير محسوم قبل صياغة الفجوة. بيانات الانتماء المؤسسي للمؤلفين وحدها لا تحدد مجتمع الدراسة أو مدى تغطية موضوعها.`
    : `لا يمكن تحديد فجوة علمية من العنوان وحده في موضوع «${title}». عدم وجود مراجع في هذه المسودة لا يعني غياب الدراسات أو محدوديتها. ابدأ بمراجعة الدراسات الأصلية وتوثيق أسئلتها ومناهجها وسياقاتها وحدودها، ثم بيّن بدليل قابل للفحص ما الذي بقي غير محسوم وكيف يمكن للدراسة المقترحة تناوله. هذه إرشادات لاستكمال الفجوة وليست فجوة معتمدة.`;

  return { problemStatement, researchGap };
}

export function buildObjectivesDraftFallback(context: Record<string, unknown>) {
  const title = cleanText(record(context.title)?.title, 500);
  const problem = record(context.problem);
  const problemStatement = cleanText(problem?.problemStatement, 1_200);
  const researchGap = cleanText(problem?.researchGap, 800);
  if (!title || !problemStatement || !researchGap) return null;

  return {
    objectives: [
      `تحديد الأبعاد الأساسية لموضوع «${title}» ضمن المجتمع والسياق اللذين سيحددهما الباحث في تصميم الدراسة.`,
      `تحليل طبيعة الأثر أو العلاقة المرتبطة بموضوع «${title}» بالاستناد إلى مؤشرات قابلة للفحص ومنهج مناسب.`,
      `تقييم مدى إسهام الأدلة الميدانية في معالجة الفجوة المحتملة المرتبطة بموضوع «${title}» دون افتراض النتائج مسبقاً.`,
    ],
  };
}

function listOfText(value: unknown, maxItems = 12) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, maxItems)
    : [];
}

function designVariableNames(context: Record<string, unknown>) {
  const variables = record(context.design)?.variables;
  if (!Array.isArray(variables)) return [];
  return variables.flatMap((item) => {
    const name = cleanText(record(item)?.name, 160);
    return name ? [name] : [];
  }).slice(0, 10);
}

function instrumentItems(type: StudyInstrumentType, variable: string) {
  if (type === 'interview') return [
    { text: `كيف تصف خبرتك المتعلقة بـ${variable} في سياق الدراسة؟`, kind: 'long_text', required: true, options: ['ما الموقف الذي يوضح ذلك؟', 'ما العوامل التي أثرت في هذه الخبرة؟'] },
    { text: `ما أبرز التحديات أو العوامل المرتبطة بـ${variable} من وجهة نظرك؟`, kind: 'long_text', required: true, options: ['لماذا تعد هذه العوامل مهمة؟', 'كيف تعاملت معها؟'] },
  ];
  if (type === 'observation') return [
    { text: `يظهر السلوك المرتبط بـ${variable} بصورة قابلة للملاحظة.`, kind: 'single_choice', required: true, options: ['لم يُلاحظ', 'لوحظ مرة', 'لوحظ مراراً'] },
    { text: `تتكرر الممارسة الدالة على ${variable} أثناء فترة الرصد.`, kind: 'single_choice', required: true, options: ['لم تُلاحظ', 'حدثت أحياناً', 'حدثت بانتظام'] },
  ];
  if (type === 'document_analysis') return [
    { text: `تتضمن الوثيقة دليلاً صريحاً مرتبطاً بـ${variable}.`, kind: 'single_choice', required: true, options: ['غير موجود', 'موجود بصورة جزئية', 'موجود بصورة واضحة'] },
    { text: `دوّن المقتطف أو المؤشر الذي يبرر ترميز ${variable}.`, kind: 'long_text', required: true, options: [] },
  ];
  if (type === 'test_scale') return [
    { text: `اسم الأداة المقننة المرشحة لقياس ${variable} ومصدرها الأصلي.`, kind: 'long_text', required: true, options: [] },
    { text: `دليل الترخيص والملاءمة اللغوية والثقافية لقياس ${variable}.`, kind: 'long_text', required: true, options: [] },
  ];
  return [
    { text: `يتحقق ${variable} في سياق الدراسة بدرجة واضحة.`, kind: 'likert5', required: true, options: ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة'] },
    { text: `تتوفر العوامل الداعمة لـ${variable} بصورة منتظمة.`, kind: 'likert5', required: true, options: ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة'] },
    { text: `أواجه تحديات تؤثر في مستوى ${variable} ضمن السياق المحدد.`, kind: 'likert5', required: true, options: ['لا أوافق بشدة', 'لا أوافق', 'محايد', 'أوافق', 'أوافق بشدة'] },
  ];
}

export function buildInstrumentDraftFallback(context: Record<string, unknown>, type: StudyInstrumentType) {
  const variables = designVariableNames(context);
  if (!variables.length) return null;
  const title = cleanText(record(context.title)?.title, 500) || 'موضوع الدراسة المعتمد';
  const questions = listOfText(record(context.questions)?.questions);
  const label = instrumentLabel(type);

  return {
    instrumentType: type,
    title: `${label} حول ${title}`.slice(0, 300),
    description: `مسودة ${label} تغطي المتغيرات أو المفاهيم المعتمدة في تصميم الدراسة، وتحتاج مراجعة الباحث والمحكّمين وتجربة استطلاعية قبل التطبيق.`,
    consentStatement: 'المشاركة طوعية، ويمكن للمشارك الانسحاب في أي وقت دون تبعات. ستستخدم الإجابات لأغراض البحث فقط، وتُحفظ دون معرّفات مباشرة وفق موافقة الجهة الأخلاقية المختصة.',
    instructions: `راجع كل بند وأجب وفق خبرتك الفعلية. لا توجد إجابة صحيحة مفترضة، ويجب عدم إدخال اسم أو معلومة تعريفية غير لازمة.${type === 'test_scale' ? ' لا تستخدم أي مقياس قبل التحقق من الترخيص وتعليمات التطبيق والتصحيح الرسمية.' : ''}`,
    respondentFields: [],
    sections: variables.map((variable, index) => ({
      title: `محور ${variable}`,
      variableName: variable,
      description: `مسودة بنود مرتبطة بالتعريف الإجرائي لمفهوم ${variable}.${questions[index] ? ` السؤال المرتبط: ${questions[index]}` : ''}`,
      items: instrumentItems(type, variable),
    })),
    collectionGuidance: collectionGuidanceFor(type),
  };
}
import { collectionGuidanceFor, instrumentLabel, type StudyInstrumentType } from '@/lib/research-instrument';
