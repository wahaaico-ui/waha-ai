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
    ? cleanText(verify.gaps.find((item) => typeof item === 'string'), 500)
    : '';

  const problemStatement = `تتمثل مشكلة البحث في الحاجة إلى فهم موضوع «${title}» ضمن نطاق علمي محدد يوضح الظاهرة محل الدراسة والفئة أو المجتمع المتأثر والسياق المكاني والزمني المناسب. وتشير المعطيات الأولية في المشروع إلى أن المعرفة المتاحة لا تكفي وحدها لتفسير طبيعة الأثر أو العلاقة بصورة قابلة للقياس والتحقق. لذلك يحتاج البحث إلى جمع أدلة منظمة، وتحديد المفاهيم والمتغيرات إجرائياً، وفحصها بمنهج يتناسب مع السؤال البحثي دون افتراض النتائج مسبقاً.`;
  const researchGap = firstGap
    ? `تشير مراجعة الاستكشاف الأولية إلى فجوة محتملة مرتبطة بموضوع «${title}»، وقد ظهرت الملاحظة الآتية: ${firstGap}. تحتاج هذه الفجوة إلى تحقق أعمق من الدراسات الأصلية وتحديد السياق والمجتمع قبل اعتمادها كفجوة نهائية.`
    : `تتمثل الفجوة المحتملة في محدودية الأدلة المحددة للسياق والمجتمع المرتبطين بموضوع «${title}»، وعدم وضوح ما إذا كانت النتائج المنشورة تفسر الظاهرة في النطاق المقترح. يلزم التحقق من الدراسات الأصلية وتحديد حدود المكان والزمن والمنهج قبل اعتماد الفجوة نهائياً.`;

  return { problemStatement, researchGap };
}
