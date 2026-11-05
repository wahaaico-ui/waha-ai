const MESSAGES = {
  export_writing_invalid: {
    ar: 'تحتاج المسودة المحفوظة إلى مراجعة. افتح الكتابة واحفظ نسخة جديدة قبل التنزيل.',
    en: 'Your saved draft needs review. Open the writing workspace and save a new version before downloading.',
  },
  export_claim_changed: {
    ar: 'تغيّرت جملة مرتبطة بمصدر. راجع ربطها بالدليل واحفظ المسودة قبل التنزيل.',
    en: 'A sentence linked to a source has changed. Review its evidence link and save the draft before downloading.',
  },
  export_source_missing: {
    ar: 'أحد المصادر المستخدمة لم يعد متاحًا في المشروع. أعد إضافته أو راجع الإحالات المرتبطة به قبل التنزيل.',
    en: 'A source used in this project is no longer available. Restore it or review its citations before downloading.',
  },
  export_source_changed: {
    ar: 'تغيّر نص مصدر أو بياناته. افتحه وراجع الاقتباسات المرتبطة به، ثم احفظ المسودة وأعد التنزيل.',
    en: 'A source text or its details have changed. Open it, review its linked passages, and save the draft before downloading again.',
  },
  export_analysis_invalid: {
    ar: 'تعذر مطابقة تحليل محفوظ مع مصدره. افتح المصدر وأعد التحليل قبل تنزيل الملف الكامل.',
    en: 'A saved analysis could not be matched to its source. Open the source and rerun the analysis before downloading the complete file.',
  },
} as const;
export type ProjectExportEvidenceCode = keyof typeof MESSAGES;
export function projectExportEvidenceMessage(code: unknown, language: 'ar' | 'en'): string | null {
  return typeof code === 'string' && Object.hasOwn(MESSAGES, code) ? MESSAGES[code as ProjectExportEvidenceCode][language] : null;
}
export class ProjectExportEvidenceError extends Error {
  constructor(readonly code: ProjectExportEvidenceCode) { super(code); this.name = 'ProjectExportEvidenceError'; }
}
