import { scientificNumbersAreGrounded } from '@/lib/scientific-numbers';

test.each([
  ['20 participants', 'n = 20'],
  ['٢٠ مشاركًا', '20 participants'],
  ['۲۰ participants', '20 participants'],
  ['r = -٠٫٤٢', 'r = −0.42'],
  ['r = .4200', 'r = +0.42'],
  ['1e-3', '.001'],
  ['1.2e+3', '1200'],
  ['0.00000000000000001', '1e-17'],
  ['9007199254740993', '9007199254740993'],
  ['25 percent', '25%'],
  ['٢٥ في المئة', '25%'],
  ['٢٥٪', '25 percent'],
  ['25 percentage points', '25 percentage points'],
  ['p ≤ 0.05', 'p <= .05'],
  ['p ≠ 0', 'p != 0'],
  ['p < .001', 'p < 0.001'],
  ['x ≈ 20', 'x ~ 20'],
  ['±2', '±2.00'],
  ['±+2', '±2'],
  ['-2', '− 2'],
  ['20–30 participants', '20-30 participants'],
  ['20 to 30 participants', '20–30 participants'],
  ['1٬200 participants', '1,200 participants'],
  ['r = \u061c-٠٫٤٢', 'r = -0.42'],
  ['No numerical finding was stated.', 'A numerical result was not provided.'],
] as const)('preserves equivalent expressions: %s <- %s', (value, evidence) => {
  expect(scientificNumbersAreGrounded(value, evidence)).toBe(true);
});

test.each([
  ['+0.42', '-0.42'],
  ['0.42', '−0.42'],
  ['-0.42', '+0.42'],
  ['25 participants', '25% responded'],
  ['25%', '25 participants'],
  ['25 percentage points', '25%'],
  ['25%', '25 percentage points'],
  ['٢٥ بالمئة', '25 participants'],
  ['p = .001', 'p < .001'],
  ['p > .001', 'p < .001'],
  ['p ≤ .001', 'p < .001'],
  ['p < .001', 'p ≤ .001'],
  ['0.5', '.05'],
  ['1e3', '1e-3'],
  ['-1e-3', '1e-3'],
  ['9007199254740992', '9007199254740993'],
  ['20', '≈20'],
  ['2', '±2'],
  ['±2', '2'],
  ['-2', '±-2'],
  ['1.25', '1,25'],
  ['r = -30', '20-30'],
  ['0.42', '20 −0.42'],
  ['0.42', '20 -0.42'],
  ['0.42', '20 - 0.42'],
  ['99.9% confidence', '20 participants'],
] as const)('rejects changed numerical expressions: %s <- %s', (value, evidence) => {
  expect(scientificNumbersAreGrounded(value, evidence)).toBe(false);
});

test('checks each expression against evidence without JavaScript rounding', () => {
  expect(scientificNumbersAreGrounded('20 participants; r = −.42; p < .001', 'n=20; r=-0.42; p < 1e-3')).toBe(true);
  expect(scientificNumbersAreGrounded('20 participants; r = .42; p < .001', 'n=20; r=-0.42; p < 1e-3')).toBe(false);
});
