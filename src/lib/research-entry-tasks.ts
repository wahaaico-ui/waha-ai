export const researchEntryTasks = {
  writing: { label: 'الكتابة بالدليل', description: 'اكتب بمصادرك، واستخرج معلومات الدراسات، وراجع الاستشهادات داخل مشروعك قبل التصدير.', input: 'نص تبدأ منه (اختياري)', placeholder: 'الصق نصك أو اتركه فارغًا لتبدأ الكتابة داخل مشروعك', action: 'افتح محرر الكتابة بالدليل' },
  sources: { label: 'مراجع لموضوعي', description: 'دراسات مرتبطة بموضوعك وروابطها الأصلية، تحفظها في مكتبة مشروعك.', input: 'موضوع البحث', placeholder: 'مثال: مقاومة المضادات الحيوية في الطب البيطري', action: 'ابدأ البحث عن المراجع' },
  compare: { label: 'مقارنة الدراسات', description: 'مقارنة المستخلصات المختارة: محاور مشتركة، اختلافات، وإحالات إلى المصادر.', input: 'موضوع الدراسات التي تريد مقارنتها', placeholder: 'اكتب الموضوع؛ ثم اختر الدراسات من مكتبتك للمقارنة', action: 'افتح مقارنة الدراسات' },
  language: { label: 'ترجمة وتدقيق', description: 'نص محسّن أو مترجم بجانب الأصل، تراجعه وتحفظه قبل التصدير.', input: 'النص الذي تريد ترجمته أو تدقيقه', placeholder: 'الصق فقرة من مسودتك هنا؛ ستختار الترجمة أو التدقيق داخل مساحة العمل', action: 'افتح أدوات النص' },
  supervisor: { label: 'ملاحظات المشرف', description: 'النص قبل التعديل وبعده، وملاحظات المشرف وردودك وحالة كل ملاحظة.', input: 'النص الذي تريد مراجعته', placeholder: 'الصق النص الأصلي؛ ثم أضف ملاحظات المشرف وتعديلاتك في مساحة المراجعة', action: 'افتح مراجعة المشرف' },
  files: { label: 'قراءة ملفات PDF', description: 'نص مستخرج من ملف PDF نصي، جاهز للقراءة والمراجعة داخل مشروعك.', input: 'اسم العمل (اختياري)', placeholder: 'يمكنك تركه فارغاً ورفع الملف في الخطوة التالية', action: 'افتح مساحة PDF' },
} as const;

export type ResearchEntryTask = keyof typeof researchEntryTasks;

export function isResearchEntryTask(value: unknown): value is ResearchEntryTask {
  return typeof value === 'string' && Object.hasOwn(researchEntryTasks, value);
}
