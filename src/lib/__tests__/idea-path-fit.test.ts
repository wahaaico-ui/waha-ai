import { parseConstraints } from '@/lib/idea-selection/questions';
import { narrowingSuggestion, rankPathsByConstraints, type RankedPath } from '@/lib/idea-selection/path-fit';

const paths = [
  { id: 'local-context', title: 'التعلم المدمج في سياق فلسطين' },
  { id: 'recent-evidence', title: 'التعلم المدمج: قراءة في أدلة السنوات الخمس الأخيرة' },
  { id: 'geographic-comparison', title: 'التعلم المدمج: مقارنة سياقية بين الأردن ومصر' },
  { id: 'replication', title: 'التعلم المدمج: إعادة اختبار نتائج دراسة مرجعية' },
  { id: 'disciplinary-lens', title: 'التعلم المدمج من منظور تعليم الرياضيات' },
];
const order = (ranked: RankedPath[]) => ranked.map(path => path.id);
const find = (ranked: RankedPath[], id: string) => ranked.find(path => path.id === id)!;

describe('constraint answers', () => {
  test('accept only the offered choices; an absent or unanswered choice is left out', () => {
    expect(parseConstraints(undefined)).toEqual({});
    expect(parseConstraints(null)).toEqual({});
    expect(parseConstraints({ access: 'partly', data: 'no', time: 'short' })).toEqual({ access: 'partly', data: 'no', time: 'short' });
    expect(parseConstraints({ access: '', other: 'x' })).toEqual({});
    expect(parseConstraints({ time: 'forever' })).toBeNull();
    expect(parseConstraints({ access: 'maybe' })).toBeNull();
    expect(parseConstraints('short')).toBeNull();
    expect(parseConstraints(['short'])).toBeNull();
  });
});

describe('ordering research paths by the researcher\'s constraints (DOC-23-03)', () => {
  test('without constraint answers the report order stays', () => {
    const ranked = rankPathsByConstraints(paths, {});
    expect(order(ranked)).toEqual(paths.map(path => path.id));
    expect(ranked.every(path => path.weight === 0 && path.reasons.length === 0)).toBe(true);
  });

  test('changing the time from over a year to under six months reorders the paths, with the reason', () => {
    const long = rankPathsByConstraints(paths, { time: 'long' });
    const short = rankPathsByConstraints(paths, { time: 'short' });
    expect(order(long)).toEqual(paths.map(path => path.id));
    expect(order(short)).toEqual(['recent-evidence', 'disciplinary-lens', 'local-context', 'replication', 'geographic-comparison']);
    expect(find(short, 'geographic-comparison')).toMatchObject({ weight: 2 });
    expect(find(short, 'geographic-comparison').reasons).toContainEqual({ text: 'يحتاج عادةً {0}، والوقت المتاح لك {1}.', values: ['أكثر من سنة', 'أقل من ستة أشهر'] });
    expect(find(short, 'local-context').reasons).toContainEqual({ text: 'يحتاج عادةً {0}، والوقت المتاح لك {1}.', values: ['من ستة أشهر إلى سنة', 'أقل من ستة أشهر'] });
    expect(find(short, 'recent-evidence').reasons).toContainEqual({ text: 'يعتمد على الدراسات المنشورة، فيناسب الوقت المتاح لك.' });
    expect(find(short, 'disciplinary-lens').reasons).toContainEqual({ text: 'لا يحدد هذا المسار طريقة جمع البيانات؛ تتبع ما تختاره داخل تخصصك.' });
  });

  test('limited access to people or data moves the paths that need field data down', () => {
    const ranked = rankPathsByConstraints(paths, { access: 'no', data: 'partly' });
    expect(order(ranked).slice(0, 2)).toEqual(['recent-evidence', 'disciplinary-lens']);
    expect(find(ranked, 'replication')).toMatchObject({ weight: 3 });
    expect(find(ranked, 'replication').reasons).toEqual([
      { text: 'يحتاج الوصول إلى مشاركين أو حالات، ووصولك إليهم {0}.', values: ['غير ممكن'] },
      { text: 'يحتاج بيانات ميدانية، وهي {0} لك.', values: ['متاحة جزئيًا'] },
    ]);
    expect(find(ranked, 'recent-evidence').reasons).toContainEqual({ text: 'لا يحتاج مشاركين ولا بيانات ميدانية؛ يعتمد على الدراسات المنشورة.' });
  });

  test('met needs say so instead of staying silent', () => {
    const ranked = rankPathsByConstraints(paths, { access: 'yes', data: 'yes', time: 'long' });
    expect(order(ranked)).toEqual(paths.map(path => path.id));
    expect(find(ranked, 'local-context').reasons).toEqual([{ text: 'وصولك وبياناتك ووقتك تكفي لما يحتاجه هذا المسار عادةً.' }]);
  });

  test('the researcher\'s passion breaks ties but never outranks a constraint', () => {
    const ranked = rankPathsByConstraints(paths, { time: 'short' }, { 'disciplinary-lens': 5, 'recent-evidence': 2, 'geographic-comparison': 5 });
    expect(order(ranked).slice(0, 2)).toEqual(['disciplinary-lens', 'recent-evidence']);
    expect(order(ranked).at(-1)).toBe('geographic-comparison');
    expect(find(ranked, 'disciplinary-lens').reasons).toContainEqual({ text: 'قيّمت شغفك به {0} من 5.', values: ['5'] });
  });

  test('a path of an unknown kind keeps its place and says its needs are not stated', () => {
    const ranked = rankPathsByConstraints([{ id: 'future-kind', title: 'مسار جديد' }, ...paths], { time: 'short', access: 'no' });
    expect(find(ranked, 'future-kind')).toMatchObject({ weight: 0 });
    expect(find(ranked, 'future-kind').reasons).toContainEqual({ text: 'لا يحدد هذا المسار طريقة جمع البيانات؛ تتبع ما تختاره داخل تخصصك.' });
  });
});

describe('narrowing the idea from the five answers and the profile (DOC-23-04)', () => {
  const answers = {
    interest: 'أثر التطبيقات التفاعلية على الفهم',
    problem: 'ضعف فهم الطلبة للمفاهيم المجردة',
    access: 'أدرّس في مدرسة حكومية',
    data: 'لا توجد بيانات منشورة عن مدرستنا',
    time: 'فصل دراسي واحد',
  };

  test('every answer and the profile shape the initial narrowing', () => {
    const narrowing = narrowingSuggestion({ answers, constraints: { access: 'yes', data: 'no', time: 'short' }, countryName: 'فلسطين', specialty: 'التربية وعلم النفس — تعليم الرياضيات' });
    expect(narrowing.lines).toEqual([
      { label: 'الظاهرة أو المشكلة', value: 'ضعف فهم الطلبة للمفاهيم المجردة' },
      { label: 'زاويتك فيها', value: 'أثر التطبيقات التفاعلية على الفهم' },
      { label: 'السياق', value: 'فلسطين' },
      { label: 'التخصص', value: 'التربية وعلم النفس — تعليم الرياضيات' },
      { label: 'الوصول إلى المشاركين', value: 'ممكن', note: 'أدرّس في مدرسة حكومية' },
      { label: 'البيانات', value: 'غير متاحة', note: 'لا توجد بيانات منشورة عن مدرستنا' },
      { label: 'الوقت المتاح', value: 'أقل من ستة أشهر', note: 'فصل دراسي واحد' },
    ]);
    expect(narrowing.advice).toBe('ابدأ بمسار يعتمد على الدراسات المنشورة أو على بيانات متاحة لك، وأجّل جمع بيانات ميدانية جديدة.');
  });

  test('the advice follows the constraints', () => {
    const advice = (constraints: Parameters<typeof narrowingSuggestion>[0]['constraints']) => narrowingSuggestion({ answers: {}, constraints, countryName: null, specialty: null }).advice;
    expect(advice({ access: 'yes', data: 'yes', time: 'long' })).toBe('وصولك وبياناتك ووقتك تسمح بدراسة ميدانية؛ حدّد مجتمع الدراسة ومكانها وفترتها قبل اعتماد العنوان.');
    expect(advice({ access: 'partly', data: 'yes', time: 'medium' })).toBe('يمكنك جمع بيانات ميدانية على نطاق صغير: اختر مجتمعًا تصل إليه فعلًا وأداة جاهزة.');
    expect(advice({ access: 'yes', data: 'yes', time: 'short' })).toBe('ابدأ بمسار يعتمد على الدراسات المنشورة أو على بيانات متاحة لك، وأجّل جمع بيانات ميدانية جديدة.');
    expect(advice({ time: 'long' })).toBe('أجب عن أسئلة الوصول والبيانات والوقت ليظهر اقتراح يناسب قيودك.');
  });

  test('unanswered questions leave their lines out', () => {
    expect(narrowingSuggestion({ answers: { problem: 'مشكلة' }, constraints: {}, countryName: null, specialty: null }).lines)
      .toEqual([{ label: 'الظاهرة أو المشكلة', value: 'مشكلة' }]);
  });
});
