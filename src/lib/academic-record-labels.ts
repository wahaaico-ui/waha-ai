/** Index record types describe metadata; they do not establish peer review. */
export const ACADEMIC_RECORD_LABELS: Readonly<Record<string, string>> = {
  article: 'مقالة', review: 'مراجعة علمية', preprint: 'مسودة قبل التحكيم',
  book: 'كتاب', 'book-chapter': 'فصل كتاب', editorial: 'افتتاحية',
  dissertation: 'أطروحة', dataset: 'مجموعة بيانات', other: 'نوع آخر',
};

export function similarReferenceTitles(items: readonly { title: string }[]) {
  const counts = new Map<string, number>();
  for (const { title } of items) {
    const key = title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

export function academicRecordLabel(type: string) {
  // Indexes spell the same type differently: "Dataset", "book chapter", "book_chapter".
  const key = type.trim().toLowerCase().replace(/[\s_]+/gu, '-');
  return Object.hasOwn(ACADEMIC_RECORD_LABELS, key) ? ACADEMIC_RECORD_LABELS[key] : type;
}
