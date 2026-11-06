import { findOverlaps, normaliseWord, tokenise, SHINGLE_SIZE } from '@/lib/originality/text-match';

const source = (id: string, text: string) => ({ id, origin: 'project-pdf' as const, title: `Source ${id}`, url: null, year: 2024, text });

describe('normaliseWord', () => {
  test('unifies Arabic letter forms and removes diacritics and tatweel', () => {
    expect(normaliseWord('الإِحْصَـــائيّة')).toBe(normaliseWord('الاحصائية'));
    expect(normaliseWord('مدرسة')).toBe(normaliseWord('مدرسه'));
    expect(normaliseWord('على')).toBe(normaliseWord('علي'));
  });

  test('lower-cases Latin words and drops punctuation', () => {
    expect(normaliseWord('Students,')).toBe('students');
    expect(normaliseWord('«التعليم»')).toBe(normaliseWord('التعليم'));
  });
});

describe('tokenise', () => {
  test('keeps the character range of every word in the original text', () => {
    const text = 'أثر   الذكاء، الاصطناعي';
    const tokens = tokenise(text);
    expect(tokens.map(t => text.slice(t.start, t.end))).toEqual(['أثر', 'الذكاء،', 'الاصطناعي']);
  });
});

describe('findOverlaps', () => {
  const copied = 'تشير النتائج إلى أن استخدام الذكاء الاصطناعي التوليدي يحسن فهم الطلبة للمفاهيم المعقدة';

  test('finds a passage copied from a source and maps it back to the original text', () => {
    const draft = `مقدمة من كلمات الباحث نفسه. ${copied}. وهذه خاتمة مختلفة تمامًا.`;
    const [passage] = findOverlaps(draft, [source('a', `في الدراسة السابقة ${copied} بشكل ملحوظ`)]);
    expect(passage).toBeDefined();
    expect(draft.slice(passage.start, passage.end)).toContain('استخدام الذكاء الاصطناعي التوليدي');
    expect(passage.matches.map(m => m.sourceId)).toEqual(['a']);
  });

  test('matches despite diacritics and letter-form differences', () => {
    const draft = 'تُشيرُ النتائجُ إلى أنّ استخدامَ الذكاءِ الاصطناعيّ التوليديّ يحسّن فهمَ الطلبةِ للمفاهيم';
    expect(findOverlaps(draft, [source('a', copied)])).toHaveLength(1);
  });

  test('ignores shared runs shorter than the shingle size', () => {
    const shortRun = copied.split(' ').slice(0, SHINGLE_SIZE - 1).join(' ');
    expect(findOverlaps(`${shortRun} ثم كلام آخر لا يتكرر في المصدر أبدًا`, [source('a', copied)])).toEqual([]);
  });

  test('merges overlapping shingles into one passage and lists every matching source', () => {
    const passages = findOverlaps(copied, [source('a', copied), source('b', `بداية ${copied}`)]);
    expect(passages).toHaveLength(1);
    expect(passages[0].matches.map(m => m.sourceId).sort()).toEqual(['a', 'b']);
    expect(passages[0].wordCount).toBe(copied.split(' ').length);
  });

  test('reports separate passages for separate copied runs', () => {
    const second = 'the sample consisted of four hundred undergraduate students from two public universities';
    const draft = `${copied} نص فاصل من كلمات الباحث وحده هنا الآن ${second}`;
    const passages = findOverlaps(draft, [source('a', copied), source('b', second)]);
    expect(passages.map(p => p.matches[0].sourceId)).toEqual(['a', 'b']);
  });

  test('returns nothing for original text', () => {
    expect(findOverlaps('هذه فقرة كتبها الباحث بنفسه ولا تتكرر في أي مصدر من المصادر المفحوصة', [source('a', copied)])).toEqual([]);
  });
});
