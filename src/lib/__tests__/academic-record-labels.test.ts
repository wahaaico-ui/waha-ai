import { academicRecordLabel } from '@/lib/academic-record-labels';

test('labels record types whatever spelling the index used', () => {
  expect(academicRecordLabel('Dataset')).toBe('مجموعة بيانات');
  expect(academicRecordLabel('Dissertation')).toBe('أطروحة');
  expect(academicRecordLabel('book chapter')).toBe('فصل كتاب');
  expect(academicRecordLabel('book_chapter')).toBe('فصل كتاب');
  expect(academicRecordLabel('article')).toBe('مقالة');
  // An unknown type stays as the index wrote it rather than being guessed.
  expect(academicRecordLabel('Peer review report')).toBe('Peer review report');
});
