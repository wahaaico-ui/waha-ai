import { analyseWritingStyle, approveStyleProfile, readStyleProfile, styleInstruction, STYLE_MIN_WORDS } from '@/lib/writing-style';

const arabic = [
  'يهدف هذا البحث إلى دراسة أثر التعليم الإلكتروني في تحصيل طلبة الجامعات الفلسطينية. ويعتمد الباحث على المنهج الوصفي التحليلي لأنه يناسب طبيعة الظاهرة (عودة، 2019).',
  'وقد أظهرت دراسات سابقة أن التعليم الإلكتروني يرفع دافعية الطلبة حين يتوافر دعم تقني مستمر (Smith, 2020). غير أن هذه الدراسات ركزت على الجامعات الكبيرة، ولم تتناول الجامعات الناشئة.',
  'لذلك يسعى الباحث إلى سد هذه الفجوة من خلال دراسة ميدانية على عينة من طلبة الجامعات الناشئة. ويستخدم الباحث استبانة محكّمة لقياس التحصيل والدافعية والرضا عن التعليم الإلكتروني.',
].join('\n\n');
const sample = Array.from({ length: 3 }, () => arabic).join('\n\n');

describe('style test (DOC-26-03)', () => {
  test('a sample shorter than the minimum is refused', () => {
    expect(analyseWritingStyle('نص قصير جدًا.')).toEqual({ ok: false, words: 3, minimum: STYLE_MIN_WORDS });
  });

  test('measures sentences, paragraphs, vocabulary, terms, citations and voice from the sample only', () => {
    const result = analyseWritingStyle(sample);
    if (!result.ok) throw new Error('expected a profile');
    const { profile } = result;
    expect(profile.sample.words).toBeGreaterThanOrEqual(STYLE_MIN_WORDS);
    expect(profile.sentences.averageWords).toBeGreaterThan(8);
    expect(profile.sentences.averageWords).toBeLessThan(25);
    expect(profile.paragraphs.count).toBe(9);
    expect(profile.paragraphs.averageSentences).toBe(2);
    expect(profile.vocabulary.diversity).toBeGreaterThan(0);
    expect(profile.vocabulary.diversity).toBeLessThanOrEqual(1);
    expect(profile.terms).toEqual(expect.arrayContaining(['التعليم الإلكتروني', 'الجامعات']));
    expect(profile.citations).toEqual({ format: 'author-year', perHundredWords: expect.any(Number) });
    expect(profile.voice).toBe('third');
  });

  test('numeric citations and first-person writing are recognised', () => {
    const text = Array.from({ length: 40 }, (_, index) => `We found that the effect was strong in study ${index} [${index + 1}]. Our sample was small.`).join(' ');
    const result = analyseWritingStyle(text);
    if (!result.ok) throw new Error('expected a profile');
    expect(result.profile.citations.format).toBe('numeric');
    expect(result.profile.voice).toBe('first');
  });
});

describe('approved style profile (DOC-13-06)', () => {
  const analysed = analyseWritingStyle(sample);
  if (!analysed.ok) throw new Error('expected a profile');

  test('the researcher reviews and edits terms and choices before approving', () => {
    const approved = approveStyleProfile(analysed.profile, { terms: ['التعليم الإلكتروني', ' الدافعية ', '', 'التعليم الإلكتروني'], voice: 'first', sentenceLength: 'short' }, new Date('2026-11-13T10:00:00Z'));
    expect(approved).toMatchObject({ version: 1, approvedAt: '2026-11-13T10:00:00.000Z', terms: ['التعليم الإلكتروني', 'الدافعية'], voice: 'first', sentenceLength: 'short' });
    expect(readStyleProfile(approved)).toEqual(approved);
  });

  test('an unapproved or malformed profile is not accepted', () => {
    expect(readStyleProfile({ ...analysed.profile })).toBeNull();
    expect(readStyleProfile(null)).toBeNull();
    expect(readStyleProfile({ version: 1, approvedAt: 'x' })).toBeNull();
  });

  test('the drafting instruction carries the approved choices as data, never the sample text', () => {
    const approved = approveStyleProfile(analysed.profile, { terms: ['التعليم الإلكتروني'], voice: 'third', sentenceLength: 'medium' }, new Date());
    const instruction = styleInstruction(approved);
    expect(instruction).toContain('التعليم الإلكتروني');
    expect(instruction).toContain('author-year');
    expect(instruction).not.toContain('يهدف هذا البحث');
  });
});
