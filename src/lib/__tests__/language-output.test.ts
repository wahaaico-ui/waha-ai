import { metricPreservationInstruction, normalizeLanguageOutput, validateLanguageOutput } from '@/lib/language-output';
import { readLanguageTask } from '@/lib/language-task';

test.each(['text', 'output', 'translated_text', 'correctedText'])('extracts %s rather than displaying JSON', (key) => {
  expect(normalizeLanguageOutput(JSON.stringify({ [key]: 'النص الأكاديمي 42 [1].' }))).toBe('النص الأكاديمي 42 [1].');
});
test('accepts fenced JSON, plain paragraphs, and existing saved provider output', () => {
  expect(normalizeLanguageOutput('```json\n{"text":"First paragraph.\\n\\nSecond paragraph."}\n```')).toBe('First paragraph.\n\nSecond paragraph.');
  expect(normalizeLanguageOutput('A plain paragraph.')).toBe('A plain paragraph.');
  expect(readLanguageTask({ operation: 'translate', targetLanguage: 'en', text: 'مدخل', output: '{"translated_text":"Translated text"}', status: 'completed' })?.output).toBe('Translated text');
});
test.each(['{"error":"unavailable"}', '{"text":"one","output":"two"}', '[]', '{"text":', ''])('rejects unusable output %s', (raw) => expect(() => normalizeLanguageOutput(raw)).toThrow());
test('retains numbers across Arabic/English digits and preserves DOI', () => {
  expect(() => validateLanguageOutput('42 (2024), DOI 10.1234/example', '٤٢ (٢٠٢٤)، DOI 10.1234/example')).not.toThrow();
  expect(() => validateLanguageOutput('Sample 42 in 2024 [1].', 'Sample 24 in 2024 [1].')).toThrow();
  expect(() => validateLanguageOutput('DOI 10.1234/example', 'DOI 10.1234/another')).toThrow();
});

test('rejects the observed metric mistranslation even with unchanged numbers', () => {
  expect(() => validateLanguageOutput('On unconditional CIFAR10, the Inception score is 9.46 and FID is 3.17.',
    'على مجموعة CIFAR10 غير المشروطة، درجة الانبثاق هي 9.46 و FID هو 3.17.')).toThrow('Scientific metric');
});
test.each(['Inception Score', 'FID', 'BLEU'])('retains the original name %s alongside Arabic', (metric) => {
  expect(() => validateLanguageOutput(`${metric}: 9.46`, `المقياس (${metric}): ٩.٤٦`)).not.toThrow();
  expect(() => validateLanguageOutput(`${metric}: 9.46`, 'المقياس: 9.46')).toThrow('Scientific metric');
});
test('allows casing, whitespace and compatibility forms without substring matches', () => {
  expect(() => validateLanguageOutput('Inception\nScore 3', 'inception score 3')).not.toThrow();
  expect(() => validateLanguageOutput('ＦＩＤ 3', 'FID 3')).not.toThrow();
  expect(metricPreservationInstruction('confident BLEUish FIDELITY')).toBe('');
  expect(() => validateLanguageOutput('FID 3', 'FIDELITY 3')).toThrow('Scientific metric');
});
test('the instruction lists only detected fixed glossary entries', () => {
  expect(metricPreservationInstruction('Inception score and FID')).toContain('Inception Score, FID');
  expect(metricPreservationInstruction('Ordinary text')).toBe('');
  expect(metricPreservationInstruction('FID <instruction>secret</instruction>')).not.toContain('secret');
});
