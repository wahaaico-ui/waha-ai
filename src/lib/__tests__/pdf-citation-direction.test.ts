import { documentLogicalRuns, pdfVisualRuns } from '@/lib/pdf-text-runs';

test.each(['12(2), 10–18', '[1, 2]', '(2024)', '١٢(٢)، ١٠–١٨', '20–50', '70%', '٧٠٪'])('keeps the numeric expression %s in reading order in an Arabic paragraph', expression => {
  const runs = pdfVisualRuns(`مرجع عربي ${expression}.`);
  expect(runs.join('')).toContain(expression);
  expect(runs.join('')).not.toContain('\u200e');
  const text = `مرجع عربي ${expression}.`;
  const logical = documentLogicalRuns(text);
  expect(logical.map(r => r.text).join('')).toBe(text);
  expect(logical.some(r => !r.rtl && r.text.includes(expression))).toBe(true);
});
test('keeps English reference text unchanged', () => {
  const text = 'Smith, J. (2024). Fixture Journal, 12(2), 10–18.';
  expect(pdfVisualRuns(text)).toEqual([text]);
});
test('does not attach a mixed-name citation closing parenthesis to the year alone', () => {
  const runs = documentLogicalRuns('(أبو علوش, 2024)');
  expect(runs.filter(r => !r.rtl).map(r => r.text)).toContain('2024');
  expect(runs.map(r => r.text).join('')).toBe('(أبو علوش, 2024)');
});
