import { buildOriginalityReport } from '@/lib/originality/report';
import {
  ORIGINALITY_DOCUMENT_TYPE,
  originalityExportModel,
  readSavedOriginalityReport,
  type SavedOriginalityReport,
} from '@/lib/originality/saved-report';
import type { OverlapSource } from '@/lib/originality/text-match';

const copied = 'تشير النتائج إلى أن استخدام الذكاء الاصطناعي التوليدي يحسن فهم الطلبة للمفاهيم المعقدة';
const pdf: OverlapSource = { id: '11111111-1111-4111-8111-111111111111', origin: 'project-pdf', title: 'Study A', url: null, year: 2023, text: `مقدمة ${copied} خاتمة` };
const open: OverlapSource = { id: 'W1', origin: 'open-source', title: 'Open study', url: 'https://doi.org/10.1/x', year: 2022, text: 'عنوان آخر ومستخلص لا يشترك مع نص الباحث في أي سلسلة' };
const text = `فقرة أولى كتبها الباحث بنفسه.\n\nثم يقول الباحث: ${copied}.`;
const documentId = '4f1c2d3e-0000-4000-8000-000000000001';

const saved: SavedOriginalityReport = {
  version: 1,
  input: 'draft',
  draftSavedAt: '2026-11-10T09:30:00.000Z',
  report: buildOriginalityReport({
    text, sources: [pdf, open], citations: [], now: new Date('2026-11-11T08:05:30.000Z'),
    checked: { projectSources: 1, openSources: 1, openSourceProviders: ['openalex', 'semantic-scholar'] },
  }),
};

const model = (language: 'ar' | 'en' = 'ar', report = saved) => originalityExportModel({
  documentId, projectTitle: 'أثر الذكاء الاصطناعي في التعليم', researcherName: 'سارة أحمد', saved: report,
}, language);
const section = (title: string, built = model()) => {
  const found = built.sections.find(item => item.title === title);
  if (!found) throw new Error(`missing section ${title}`);
  return found.paragraphs;
};

describe('saved similarity report', () => {
  test('is a journey document type, so stage readers and the full export skip it', () => {
    expect(ORIGINALITY_DOCUMENT_TYPE).toBe('journey:originality_report');
  });

  test('reads back only a complete saved report', () => {
    expect(readSavedOriginalityReport(JSON.stringify(saved))).toEqual(saved);
    expect(readSavedOriginalityReport(saved)).toEqual(saved);
    expect(readSavedOriginalityReport('{broken')).toBeNull();
    expect(readSavedOriginalityReport(null)).toBeNull();
    expect(readSavedOriginalityReport({ ...saved, version: 2 })).toBeNull();
    expect(readSavedOriginalityReport({ ...saved, input: 'file' })).toBeNull();
    expect(readSavedOriginalityReport({ ...saved, report: { ...saved.report, passages: 'x' } })).toBeNull();
    expect(readSavedOriginalityReport({ ...saved, report: { ...saved.report, sources: [{ number: 1 }] } })).toBeNull();
    const [passage] = saved.report.passages;
    expect(readSavedOriginalityReport({ ...saved, report: { ...saved.report, passages: [{ ...passage, matches: [{ ...passage.matches[0], cited: 'no' }] }] } })).toBeNull();
  });
});

describe('similarity report file', () => {
  test('has the sections a reviewer needs, in reading order', () => {
    expect(model().title).toBe('تقرير التطابق الحرفي مع المصادر');
    expect(model().notice).toContain('ليس تقرير أصالة رسميًا');
    expect(model().sections.map(item => item.title)).toEqual([
      'بيانات التقرير', 'خلاصة الفحص', 'نطاق الفحص', 'المصادر المفحوصة', 'قواعد المطابقة', 'المطابقات', 'حدود الفحص',
    ]);
  });

  test('identifies the report, the project, the researcher and the checked text', () => {
    expect(section('بيانات التقرير')).toEqual([
      `رقم التقرير: ${documentId}`,
      'تاريخ الفحص: 2026-11-11 08:05 UTC',
      'المشروع: أثر الذكاء الاصطناعي في التعليم',
      'الباحث: سارة أحمد',
      'النص المفحوص: آخر مسودة في الكتابة بالدليل، المحفوظة في 2026-11-10 09:30 UTC',
      `عدد كلمات النص: ${saved.report.totalWords}`,
    ]);
    const pasted = originalityExportModel({ documentId, projectTitle: null, researcherName: null, saved: { ...saved, input: 'text', draftSavedAt: null } });
    expect(section('بيانات التقرير', pasted)).toEqual([
      `رقم التقرير: ${documentId}`,
      'تاريخ الفحص: 2026-11-11 08:05 UTC',
      'النص المفحوص: نص ألصقه الباحث في صفحة الفحص، دون استشهادات مرتبطة به',
      `عدد كلمات النص: ${saved.report.totalWords}`,
    ]);
  });

  test('gives the share with its counts, never a bare percentage', () => {
    const { coveragePercent, matchedWords, totalWords } = saved.report;
    expect(section('خلاصة الفحص')).toEqual([
      `نسبة النص المطابق للمصادر المفحوصة: ${coveragePercent}%، أي ${matchedWords} كلمة من ${totalWords}.`,
      'المقاطع المطابقة: 1، منها 1 غير موثّقة.',
      'النسبة وحدها لا تحكم على أصالة العمل؛ راجع المقاطع غير الموثّقة ومصادرها أدناه.',
    ]);
  });

  test('states the scope: what was compared and what was not', () => {
    expect(section('نطاق الفحص')).toEqual([
      'مصادر المشروع التي قورن النص بنصوصها الكاملة: 1.',
      'السجلات العلمية المفتوحة التي قورن بها النص: 1، بعناوينها ومستخلصاتها فقط، من OpenAlex, Semantic Scholar.',
      'قواعد النصوص الكاملة المرخّصة: لم تُفحص لأن الخدمة المرخّصة غير مُعدّة.',
    ]);
  });

  test('numbers every checked source so each match can be traced to it', () => {
    expect(section('المصادر المفحوصة')).toEqual([
      'المصدر 1: Study A (2023) — ملف PDF في المشروع — مطابقات: 1',
      'المصدر 2: Open study (2022) — مصدر علمي مفتوح — لا مطابقة',
      'الرابط: https://doi.org/10.1/x',
    ]);
  });

  test('states the matching rules', () => {
    const rules = section('قواعد المطابقة').join('\n');
    expect(rules).toContain('7 كلمات متتالية');
    expect(rules).toContain('موثّقًا');
    expect(rules).toContain('÷');
  });

  test('locates every match in the text and points it at its numbered source', () => {
    const [passage] = saved.report.passages;
    expect(section('المطابقات')).toEqual([
      `المقطع 1: الفقرة 2، الكلمات من ${passage.firstWord} إلى ${passage.lastWord}، وعددها ${passage.wordCount} — غير موثّق`,
      `«${passage.text}»`,
      'وُجد في المصدر 1: Study A — غير موثّق',
    ]);
  });

  test('says plainly when nothing matched', () => {
    const clean = { ...saved, report: buildOriginalityReport({ text: 'نص كتبه الباحث بنفسه ولا يشترك مع أي مصدر في سبع كلمات', sources: [pdf], citations: [], checked: saved.report.checked }) };
    expect(section('المطابقات', model('ar', clean))).toEqual(['لم يُعثر على مقاطع تتطابق حرفيًا مع المصادر المفحوصة.']);
    expect(section('خلاصة الفحص', model('ar', clean))[1]).toBe('لم يُعثر على مقاطع تتطابق حرفيًا مع المصادر المفحوصة.');
  });

  test('keeps the limits of the check', () => {
    expect(section('حدود الفحص')).toEqual(saved.report.limitations);
  });

  test('an English file has no untranslated label', () => {
    const englishCopy = 'Students who revised drafts with generative tools reported clearer argument structure in their final theses';
    const englishSource: OverlapSource = { ...pdf, title: 'Study A', text: `Intro ${englishCopy} end` };
    const english: SavedOriginalityReport = {
      version: 1, input: 'text', draftSavedAt: null,
      report: buildOriginalityReport({ text: `My own framing. ${englishCopy}.`, sources: [englishSource, open], citations: [], checked: { projectSources: 1, openSources: 1, openSourceProviders: ['openalex'] } }),
    };
    const built = originalityExportModel({ documentId, projectTitle: 'AI in education', researcherName: 'Sara Ahmed', saved: english }, 'en');
    const all = [built.title, built.notice, ...built.sections.flatMap(item => [item.title, ...item.paragraphs])].join('\n');
    expect(all.replace(open.text, '')).not.toMatch(/\p{Script=Arabic}/u);
    expect(all).toContain('Source 1: Study A (2023)');
  });
});
