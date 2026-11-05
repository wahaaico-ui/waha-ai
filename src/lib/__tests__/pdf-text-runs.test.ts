import { pdfVisualRuns } from '@/lib/pdf-text-runs';

test('mixed Arabic preserves numeric runs, DOI and English title before PDF shaping', () => {
  const runs = pdfVisualRuns('هذه دراسة 42 عام 2024 والإحالة [12] DOI 10.1234/fixture');
  expect(runs.join('')).toContain('42'); expect(runs.join('')).toContain('2024'); expect(runs.join('')).toContain('[12]');
  expect(runs.join('')).toContain('10.1234/fixture');
  expect(pdfVisualRuns('[1] Fixture Study 1 — دراسة اختبارية').join('')).toContain('Fixture Study 1');
  expect(pdfVisualRuns('Academic text 42')).toEqual(['Academic text 42']);
});
