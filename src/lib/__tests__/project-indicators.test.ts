import { guideRuleCandidates, readSavedGuide, saveGuideEnvelope, type SavedGuide } from '@/lib/guide-workflow';
import { JOURNAL_PRESETS } from '@/lib/journal-template';
import { guideIndicator, publicationIndicator, timeIndicator, type ProjectIndicator } from '@/lib/project-indicators';

const GUIDE_TEXT = [
  'نظام التوثيق: APA 7',
  '1 . يجب ألا يزيد عدد كلمات الرسالة عن ( 40000 ) كلمة باستثناء الملاحق.',
  '2 . لا يتجاوز الملخص 300 كلمة باللغة العربية.',
  'يكون ترقيم الصفحات في أسفل الصفحة في المنتصف.',
].join('\n');

function approvedGuide(): SavedGuide {
  const envelope = saveGuideEnvelope(GUIDE_TEXT, guideRuleCandidates(GUIDE_TEXT).map(rule => ({ ...rule, status: 'approved' as const })));
  if (!envelope) throw new Error('fixture guide was not accepted');
  return readSavedGuide(envelope);
}
const words = (count: number) => Array.from({ length: count }, (_, index) => `كلمة${index}`).join(' ');
const states = (indicator: ProjectIndicator) => indicator.lines.map(line => line.state);
/** No indicator may show a number unless it measured it. */
const numbersIn = (indicator: ProjectIndicator) => indicator.lines.flatMap(line => line.values ?? []).filter(value => typeof value === 'number');

describe('guide compliance indicator (DOC-38-01)', () => {
  test('without an approved guide it is not assessed and shows no number', () => {
    for (const guide of [null, { text: 'دليل قديم بلا قواعد معتمدة', rules: [] }]) {
      const indicator = guideIndicator({ guide, draft: { text: words(500), citationStyle: 'apa-7' }, abstractText: words(100) });
      expect(indicator).toMatchObject({ id: 'guide', state: 'not_assessed', lines: [] });
      expect(indicator.missing).toEqual([{ text: 'لا توجد قواعد معتمدة من دليل الجامعة؛ أضف الدليل واعتمد قواعده من «تعليمات الجامعة».' }]);
      expect(numbersIn(indicator)).toEqual([]);
    }
  });

  test('an unreadable saved guide is not assessed, and says so', () => {
    const indicator = guideIndicator({ guide: null, guideUnreadable: true, draft: null, abstractText: null });
    expect(indicator.state).toBe('not_assessed');
    expect(indicator.missing).toEqual([{ text: 'تعذر قراءة الدليل المحفوظ؛ افتحه في «تعليمات الجامعة» وأعد حفظه.' }]);
  });

  test('a draft within the limits and in the required citation style meets the guide', () => {
    const indicator = guideIndicator({ guide: approvedGuide(), draft: { text: words(500), citationStyle: 'apa-7' }, abstractText: words(120) });
    expect(indicator.state).toBe('met');
    expect(indicator.lines).toEqual(expect.arrayContaining([
      { text: 'المسودة {0} كلمة، وحد الدليل {1} كلمة.', values: [500, 40000], state: 'met' },
      { text: 'الملخص {0} كلمة، وحد الدليل {1} كلمة.', values: [120, 300], state: 'met' },
      { text: 'نظام التوثيق في المسودة يطابق الدليل: {0}.', values: ['APA 7'], state: 'met' },
    ]));
    expect(indicator.missing).toEqual([]);
  });

  test('an abstract over the limit or another citation style needs follow-up, with the numbers behind it', () => {
    const indicator = guideIndicator({ guide: approvedGuide(), draft: { text: words(500), citationStyle: 'ieee' }, abstractText: words(320) });
    expect(indicator.state).toBe('attention');
    expect(indicator.lines).toEqual(expect.arrayContaining([
      { text: 'الملخص {0} كلمة، وحد الدليل {1} كلمة.', values: [320, 300], state: 'attention' },
      { text: 'الدليل يطلب {0}، والمسودة مضبوطة على {1}.', values: ['APA 7', 'IEEE'], state: 'attention' },
    ]));
  });

  test('missing draft and abstract are listed instead of guessed', () => {
    const indicator = guideIndicator({ guide: approvedGuide(), draft: null, abstractText: null });
    expect(states(indicator)).not.toContain('attention');
    expect(indicator.missing).toEqual([
      { text: 'لا توجد مسودة في «الكتابة بالدليل» لمقارنتها بقواعد الدليل.' },
      { text: 'لم يُكتب الملخص بعد في مرحلة «جاهزية النشر».' },
    ]);
    // Nothing could be measured, so it is not assessed; the page number rule is still applied by the Word export.
    expect(indicator.state).toBe('not_assessed');
    expect(indicator.lines).toContainEqual({ text: 'قواعد التنسيق المعتمدة ({0}) تُطبَّق تلقائيًا في ملف Word عند التصدير.', values: [1], state: 'info' });
  });
});

describe('time indicator (DOC-38-01)', () => {
  const now = new Date('2026-11-11T12:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  test('without the researcher\'s available time it is not assessed', () => {
    const indicator = timeIndicator({ time: null, completed: 5, total: 17, startedAt: daysAgo(30), now });
    expect(indicator.state).toBe('not_assessed');
    expect(indicator.missing).toEqual([{ text: 'لم تحدد الوقت المتاح في «خمسة أسئلة قبل أن تختار».' }]);
    expect(indicator.lines).toEqual([{ text: 'أنجزت {0} من {1} مرحلة.', values: [5, 17], state: 'info' }]);
  });

  test('too few finished stages give no pace and no estimate', () => {
    const indicator = timeIndicator({ time: 'short', completed: 2, total: 17, startedAt: daysAgo(10), now });
    expect(indicator.state).toBe('not_assessed');
    expect(indicator.missing).toEqual([{ text: 'لا تكفي المراحل المنجزة لتقدير الوتيرة؛ يلزم إنجاز ثلاث مراحل على الأقل.' }]);
  });

  test('a pace that fits the available time is met; one that exceeds it needs follow-up, with the basis', () => {
    const fits = timeIndicator({ time: 'medium', completed: 6, total: 17, startedAt: daysAgo(30), now });
    expect(fits.state).toBe('met');
    expect(fits.lines).toEqual([
      { text: 'أنجزت {0} من {1} مرحلة.', values: [6, 17], state: 'info' },
      { text: 'مضى {0} يومًا منذ حفظ أول مرحلة، أي نحو {1} يومًا لكل مرحلة.', values: [30, 5], state: 'info' },
      { text: 'بهذه الوتيرة تحتاج المراحل الباقية نحو {0} يومًا.', values: [55], state: 'info' },
      { text: 'هذا ضمن الوقت المتاح لك: {0}.', values: ['من ستة أشهر إلى سنة'], state: 'met' },
    ]);
    const exceeds = timeIndicator({ time: 'short', completed: 3, total: 17, startedAt: daysAgo(90), now });
    expect(exceeds.state).toBe('attention');
    expect(exceeds.lines.at(-1)).toEqual({ text: 'هذا يتجاوز الوقت المتاح لك: {0}؛ ضيّق النطاق أو اختر مسارًا أقصر.', values: ['أقل من ستة أشهر'], state: 'attention' });
  });

  test('over a year has no upper bound to compare with', () => {
    const indicator = timeIndicator({ time: 'long', completed: 3, total: 17, startedAt: daysAgo(90), now });
    expect(indicator.state).toBe('met');
    expect(indicator.lines.at(-1)).toEqual({ text: 'الوقت المتاح لك أكثر من سنة، فلا حد أعلى للمقارنة.', state: 'met' });
  });

  test('a finished journey is met whatever the time answer', () => {
    expect(timeIndicator({ time: null, completed: 17, total: 17, startedAt: daysAgo(3), now })).toMatchObject({ state: 'met', missing: [] });
  });
});

describe('publishability indicator (DOC-38-01)', () => {
  test('without a journal template it is not assessed', () => {
    const indicator = publicationIndicator({ template: null, outputs: {}, referenceCount: 12 });
    expect(indicator).toMatchObject({ id: 'publication', state: 'not_assessed', lines: [] });
    expect(indicator.missing).toEqual([{ text: 'لم تُحفظ تعليمات مجلة في «حزمة النشر والتصدير».' }]);
  });

  test('checks the manuscript against the saved template, line by line', () => {
    const template = { ...JOURNAL_PRESETS.imrad, sections: ['introduction' as const], wordLimit: 100, referenceLimit: 10 };
    const outputs = {
      problem: { problemStatement: words(40) },
      publication: { structuredAbstract: { background: words(30) }, keywords: ['تعلم', 'تمريض', 'منصات'] },
    };
    const indicator = publicationIndicator({ template, outputs, referenceCount: 12 });
    expect(indicator.state).toBe('attention');
    expect(indicator.lines).toEqual([
      { text: 'الأقسام المكتملة: {0} من {1}.', values: [1, 1], state: 'met' },
      { text: 'عدد كلمات البحث {0}، وحد المجلة {1}.', values: [40, 100], state: 'met' },
      { text: 'كلمات الملخص {0}، وحد المجلة {1}.', values: [30, 250], state: 'met' },
      { text: 'الكلمات المفتاحية {0}، والمطلوب {1}.', values: [3, '3–6'], state: 'met' },
      { text: 'المراجع {0}، وحد المجلة {1}.', values: [12, 10], state: 'attention' },
    ]);
  });
});
