/** Adapted from OpenEpi SSPropor.js (MIT), with design effect = 1.
 * Copyright (c) 2003, 2008 Andrew G. Dean and Kevin M. Sullivan.
 * Source and license: public/open-source/openepi/{NOTICE,LICENSE}.txt
 * This estimates a single proportion, not general study power. */
export const SAMPLE_CONFIDENCE_LEVELS = [90, 95, 99] as const;
export type SampleConfidence = typeof SAMPLE_CONFIDENCE_LEVELS[number];
const Z = { 90: 1.6448536269514722, 95: 1.959963984540054, 99: 2.5758293035489004 } as const;
export type SampleSizeInput = { population: number | null; confidence: SampleConfidence; marginPercent: number; proportionPercent: number; responsePercent: number };
export type SampleSizeResult = { input: SampleSizeInput; z: number; unadjusted: number; adjusted: number; completed: number; contacts: number; feasible: boolean; smallExpectedCounts: boolean };
export type SampleSizeError = keyof SampleSizeInput | 'precision';
type Calculation = { ok: true; result: SampleSizeResult } | { ok: false; field: SampleSizeError };
export const SAMPLE_SIZE_SOURCES = {
  formula: 'https://www.openepi.com/SampleSize/SSPropor.htm',
  guidance: 'https://www.cdc.gov/epiinfo/user-guide/statcalc/samplesize.html',
  license: '/open-source/openepi/LICENSE.txt',
} as const;
const percentage = (value: unknown, include100 = false): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && (include100 ? value <= 100 : value < 100);

/** Ceil(completed * 100 / responsePercent) in decimal arithmetic.
 * The binary expression 57 / (57 / 100) exceeds 100 by one floating-point
 * ulp and incorrectly rounds to 101. An epsilon would undercount genuinely
 * smaller response rates. Integer ratios preserve the displayed input. */
export function sampleInvitations(completed: number, responsePercent: number): number | null {
  if (!Number.isSafeInteger(completed) || completed < 1 || !percentage(responsePercent, true)) return null;
  const [coefficient, exponent = '0'] = String(responsePercent).split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent);
  let numerator = BigInt(completed) * 100n;
  let denominator = BigInt(whole + fraction);
  if (scale >= 0) numerator *= 10n ** BigInt(scale);
  else denominator *= 10n ** BigInt(-scale);
  const invitations = (numerator + denominator - 1n) / denominator;
  return invitations <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(invitations) : null;
}

export function calculateSampleSize(input: SampleSizeInput): Calculation {
  if (input.population !== null && (!Number.isSafeInteger(input.population) || input.population < 1)) return { ok: false, field: 'population' };
  if (!SAMPLE_CONFIDENCE_LEVELS.includes(input.confidence)) return { ok: false, field: 'confidence' };
  if (!percentage(input.marginPercent)) return { ok: false, field: 'marginPercent' };
  if (!percentage(input.proportionPercent)) return { ok: false, field: 'proportionPercent' };
  if (!percentage(input.responsePercent, true)) return { ok: false, field: 'responsePercent' };
  const z = Z[input.confidence], p = input.proportionPercent / 100, e = input.marginPercent / 100;
  const unadjusted = z * z * p * (1 - p) / (e * e);
  if (!Number.isFinite(unadjusted) || unadjusted <= 0 || unadjusted > Number.MAX_SAFE_INTEGER) return { ok: false, field: 'precision' };
  // Equivalent to n0/(1+(n0-1)/N), avoiding cancellation for N=1 or tiny n0.
  const adjusted = input.population === null ? unadjusted : input.population / (1 + (input.population - 1) / unadjusted);
  const completed = Math.max(1, Math.ceil(adjusted));
  const contacts = sampleInvitations(completed, input.responsePercent);
  if (!Number.isSafeInteger(completed) || contacts === null || contacts < completed) return { ok: false, field: 'precision' };
  return { ok: true, result: { input: { ...input }, z, unadjusted, adjusted, completed, contacts, feasible: input.population === null || contacts <= input.population, smallExpectedCounts: completed * p < 5 || completed * (1 - p) < 5 } };
}

/** Arabic/Persian digits and decimal separator are supported; never guess
 * whether a comma is a decimal point or a thousands separator. */
export function sampleSizeNumber(value: string): number {
  const normalized = value.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0)).replace(/٫/g, '.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export function sampleSizeMethodNote(result: SampleSizeResult, language: 'ar' | 'en'): string {
  const { input, completed, contacts, z } = result;
  const ar = language === 'ar';
  const n = (value: number) => String(value);
  return [
    ar ? 'تقدير حجم عينة لتقدير نسبة واحدة — معادلة كوكران' : 'Sample-size estimate for one population proportion — Cochran formula',
    ar ? 'افتراض الحساب: عينة عشوائية بسيطة دون إرجاع، وتأثير تصميم يساوي 1.' : 'Assumption: simple random sampling without replacement, with design effect equal to 1.',
    `${ar ? 'مستوى الثقة' : 'Confidence level'}: ${input.confidence}%; Z = ${z.toFixed(9)}.`,
    `${ar ? 'هامش الخطأ المطلق' : 'Absolute margin of error'}: ±${n(input.marginPercent)} ${ar ? 'نقطة مئوية' : 'percentage points'}; e = ${n(input.marginPercent / 100)}.`,
    `${ar ? 'النسبة المتوقعة' : 'Expected proportion'}: ${n(input.proportionPercent)}%; p = ${n(input.proportionPercent / 100)}.`,
    input.population === null ? (ar ? 'حجم المجتمع غير محدد؛ لم يُطبق تصحيح المجتمع المحدود.' : 'Population size unspecified; no finite-population correction applied.') : `${ar ? 'حجم المجتمع المحدود' : 'Finite population size'}: N = ${n(input.population)}.`,
    'n0 = Z² × p × (1 − p) / e².',
    ...(input.population === null ? ['n = n0.'] : ['n = n0 / (1 + (n0 − 1) / N).']),
    `${ar ? 'الاستجابات المكتملة المطلوبة بعد التقريب للأعلى' : 'Completed responses required, rounded upward'}: ${completed}.`,
    `${ar ? 'نسبة الاستجابة المتوقعة' : 'Expected response rate'}: ${n(input.responsePercent)}%; r = ${n(input.responsePercent / 100)}.`,
    `m = ceil(ceil(n) / r) = ${contacts}.`,
    ar ? 'عدد الدعوات تقدير تخطيطي للاستجابة المتوقعة، وليس ضمانًا للتحصيل أو علاجًا لتحيز عدم الاستجابة.' : 'Invitations are a planning estimate, not a guarantee of responses or a correction for nonresponse bias.',
    ...(!result.feasible ? [ar ? 'الخطة تتطلب دعوات أكثر من حجم المجتمع؛ راجع الافتراضات قبل اعتمادها.' : 'The plan requires more invitations than the population; revise assumptions before using it.'] : []),
    ...(result.smallExpectedCounts ? [ar ? 'بعض الأعداد المتوقعة صغيرة؛ قد لا يلائم التقريب الطبيعي هذه المدخلات.' : 'Some expected counts are small; the normal approximation may not suit these inputs.'] : []),
    ar ? 'هذا الحساب لا يحدد القدرة لاختبار فروق بين مجموعات أو عينات عنقودية أو تشبع بحث نوعي.' : 'This calculation does not establish power for between-group tests, cluster samples or qualitative saturation.',
    `OpenEpi: ${SAMPLE_SIZE_SOURCES.formula}`,
    `CDC: ${SAMPLE_SIZE_SOURCES.guidance}`,
  ].join('\n');
}

export function appendSampleSizeNote(existing: string, note: string): string {
  return existing.includes(note) ? existing : [existing.trimEnd(), note].filter(Boolean).join('\n\n');
}
