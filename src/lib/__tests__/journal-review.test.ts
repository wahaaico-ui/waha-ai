import { buildResponseLetter, parseJournalReview } from '@/lib/journal-review';

const id = (n: number) => `0000000${n}-0000-4000-8000-00000000000${n}`;
const comment = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n), reviewer: 'reviewer-1', comment: `ملاحظة المحكم رقم ${n} حول المنهجية`, location: 'المنهجية، ص 4', response: '', status: 'open', ...extra,
});

describe('parseJournalReview', () => {
  test('accepts a round with open comments', () => {
    const review = parseJournalReview({ journal: 'مجلة الدراسات التربوية', round: 1, decision: 'major', comments: [comment(1)] });
    expect(review).toMatchObject({ round: 1, decision: 'major', comments: [{ reviewer: 'reviewer-1', status: 'open' }] });
  });

  test('requires a response for addressed and declined comments', () => {
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'minor', comments: [comment(1, { status: 'addressed' })] })).toBeNull();
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'minor', comments: [comment(1, { status: 'declined' })] })).toBeNull();
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'minor', comments: [comment(1, { status: 'declined', response: 'لا نتفق لأن العينة محددة بالسياق.' })] })).not.toBeNull();
  });

  test('rejects unknown decisions, reviewers, duplicate ids and bad rounds', () => {
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'maybe', comments: [comment(1)] })).toBeNull();
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'major', comments: [comment(1, { reviewer: 'reviewer-9' })] })).toBeNull();
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'major', comments: [comment(1), comment(1)] })).toBeNull();
    expect(parseJournalReview({ journal: 'J', round: 0, decision: 'major', comments: [comment(1)] })).toBeNull();
    expect(parseJournalReview({ journal: 'J', round: 1, decision: 'major', comments: [] })).toBeNull();
  });
});

describe('buildResponseLetter', () => {
  const review = parseJournalReview({
    journal: 'مجلة الدراسات التربوية', round: 2, decision: 'major',
    comments: [
      comment(1, { status: 'addressed', response: 'أضفنا وصفًا لطريقة اختيار العينة.' }),
      comment(2, { reviewer: 'editor', status: 'declined', response: 'أبقينا العنوان لأنه يطابق متغيرات الدراسة.' }),
      comment(3, { reviewer: 'reviewer-2' }),
    ],
  })!;

  test('lists every comment point by point with the reviewer, response and status', () => {
    const letter = buildResponseLetter(review, 'ar');
    expect(letter).toContain('مجلة الدراسات التربوية');
    expect(letter).toContain('الجولة 2');
    expect(letter).toMatch(/المحكم 1[\s\S]*أضفنا وصفًا لطريقة اختيار العينة/);
    expect(letter).toMatch(/المحرر[\s\S]*أبقينا العنوان/);
    expect(letter).toContain('لم يُعالج بعد');
  });

  test('summarises counts and writes English when asked', () => {
    const letter = buildResponseLetter(review, 'en');
    expect(letter).toContain('Round 2');
    expect(letter).toContain('Reviewer 2');
    expect(letter).toMatch(/1 addressed, 1 declined, 1 open/);
  });
});
