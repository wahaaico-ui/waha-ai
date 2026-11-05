import { translateUiText } from '@/lib/i18n/ui-text';
import english from '@/lib/i18n/en.json';
import { buildProjectExportModel, buildProjectMarkdown } from '@/lib/project-export';
import { supervisorExportModel } from '@/lib/supervisor-review';
import { languageExportModel } from '@/lib/research-task-export';

test('English UI messages preserve parameters and unknown research text', () => {
  expect(translateUiText('المصادر المحفوظة ({0})', 'en', [50])).toBe('Saved sources (50)');
  const content = 'النص البحثي الأصلي 42 DOI:10.1234/example <script>alert(1)</script>';
  expect(translateUiText(content, 'en')).toBe(content);
  expect(translateUiText('نص باحث\n\n  مع تنسيق محفوظ', 'en')).toBe('نص باحث\n\n  مع تنسيق محفوظ');
  expect(translateUiText('__proto__', 'en')).toBe('__proto__');
  expect(translateUiText('constructor', 'en')).toBe('constructor');
  expect(translateUiText('النص المعدّل', 'ar')).toBe('النص المعدّل');
});

test('every catalog entry preserves its interpolation slots and has an English value', () => {
  for (const [key, value] of Object.entries(english)) {
    expect(value.trim().length).toBeGreaterThan(0);
    expect(value.match(/\{\d+\}/g)?.sort() || []).toEqual(key.match(/\{\d+\}/g)?.sort() || []);
    expect(value).not.toMatch(/[\u0600-\u06ff]/);
  }
});

test('known validation messages translate their labels and retain exact numeric evidence', () => {
  expect(translateUiText('السؤال 1: النص أقصر من الحد المطلوب.', 'en')).toBe('Question 1: The text is too short.');
  const numericWarning = translateUiText('النتيجة 2: القيمة «0.003» غير موجودة في التحليل المعتمد. احذفها أو صحح مخرج التحليل أولاً.', 'en');
  expect(numericWarning).toContain('0.003');
  expect(numericWarning).not.toMatch(/[\u0600-\u06ff]/);
  expect(translateUiText('أكمل مرحلة «المشكلة» واحفظها أولاً.', 'en')).not.toMatch(/[\u0600-\u06ff]/);
});

test('English exports localize only system labels and preserve multilingual research and citations', () => {
  const original = 'نص الباحث كما كتبه with 42 and [1].';
  const project = { title: 'بحث خاص', university_policy: 'تعليمات مخصصة من الجامعة' };
  const docs = [{ type: 'journey:results', content: { overallSummary: original }, version: 2 }];
  const model = buildProjectExportModel(project, docs, [], [], 'apa-7', 'en');
  expect(model.title).toBe(project.title);
  expect(model.sections[0]).toEqual({ title: 'University guidelines', paragraphs: [project.university_policy] });
  expect(model.sections[1].title).toBe('Results - Version 2');
  expect(model.sections[1].paragraphs).toContain(original);
  expect(model.sections[1].paragraphs).not.toContain('الخلاصة العامة للنتائج:');
  expect(buildProjectMarkdown(project, docs, [], [], 'apa-7', 'en').replace(/\\/g, '')).toContain(original);
  const review = supervisorExportModel({ originalText: original, revisedText: original + ' Revised.', notes: [] }, 'en');
  expect(review.title).toBe('Supervisor review');
  expect(review.sections[0]).toEqual({ title: 'Revised text', paragraphs: [original + ' Revised.'] });
  const task = languageExportModel({ operation: 'translate', text: original, targetLanguage: 'en', output: 'Reviewed output 42 [1].', status: 'completed' }, 'en');
  expect(task.sections[0]).toEqual({ title: 'Original input', paragraphs: [original] });
});
