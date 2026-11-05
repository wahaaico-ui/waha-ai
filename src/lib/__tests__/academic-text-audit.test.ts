import { auditAcademicText } from '@/lib/academic-text-audit';

test('finds explicit Arabic punctuation and numeral issues without rewriting the source', () => {
  const text = 'نحن أجرينا الدراسة ،ثم و الباحثون قارنوا ١٠ من 20 حالة.';
  const codes = auditAcademicText(text, 'ar').map(issue => issue.code);
  expect(codes).toEqual(expect.arrayContaining(['first_person', 'space_before_punctuation', 'space_after_punctuation', 'detached_conjunction', 'mixed_numerals']));
  expect(text).toContain('نحن');
});

test('flags a long English sentence and first person but avoids assigning a grammar verdict', () => {
  const text = 'We ' + Array.from({ length: 40 }, () => 'measured').join(' ') + '.';
  expect(auditAcademicText(text, 'en').map(issue => issue.code)).toEqual(expect.arrayContaining(['first_person', 'long_sentence']));
  expect(auditAcademicText('The method was evaluated.', 'en')).toEqual([]);
});
