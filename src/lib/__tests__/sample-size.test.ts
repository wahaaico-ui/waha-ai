import { appendSampleSizeNote, calculateSampleSize, sampleInvitations, sampleSizeMethodNote, sampleSizeNumber, type SampleSizeInput } from '../sample-size';
import { calculateHypothesis, KREJCIE_MORGAN_TABLE, krejcieMorganComparison, sampleMethodology, type HypothesisInput, type SamplePlan } from '../sample-size-planning';
import { sampleFlow } from '../sample-size-flow';

const defaults: SampleSizeInput = { population: null, confidence: 95, marginPercent: 5, proportionPercent: 50, responsePercent: 100 };
const tTest: HypothesisInput = { method: 't-test', effect: 0.5, alpha: 0.05, power: 80, population: null, responsePercent: 100 };
function survey(input: Partial<SampleSizeInput> = {}): SamplePlan & { kind: 'survey' } {
  const result = calculateSampleSize({ ...defaults, ...input });
  if (!result.ok) throw new Error(result.field);
  return { kind: 'survey', result: result.result };
}
function hypothesis(input: HypothesisInput): SamplePlan & { kind: 'hypothesis' } {
  const result = calculateHypothesis(input); if (!result.ok) throw new Error(result.field);
  return { kind: 'hypothesis', result: result.result };
}

test.each([
  [null, 385], [1, 1], [50, 45], [100,80], [500,218], [1000,278], [2000,323], [10000,370],
] as const)('Cochran upward rounding for N=%s gives %s', (population, expected) => {
  expect(survey({ population }).result.completed).toBe(expected);
});

test.each([
  { population: 0 }, { population: -2 }, { population: 2.5 }, { population: Number.MAX_SAFE_INTEGER+1 },
  { confidence: 98 }, { marginPercent: 0 }, { marginPercent: NaN }, { marginPercent: 100 },
  { proportionPercent: 0 }, { proportionPercent: 100 }, { responsePercent: 0 }, { responsePercent: 101 },
  { marginPercent: 1e-300 }, { responsePercent: 1e-300 },
])('rejects invalid or unsafe survey input %p', (change) => {
  expect(calculateSampleSize({ ...defaults, ...change } as SampleSizeInput).ok).toBe(false);
});

test('nonresponse retains impossible plans instead of silently capping them', () => {
  const result = survey({ population: 50, responsePercent: 50 }).result;
  expect(result).toMatchObject({ completed: 45, contacts: 90, feasible: false });
  expect(sampleFlow({ kind: 'survey', result }, 'en').warning).toContain('Infeasible');
});
test('small expected counts are reported', () => expect(survey({ population: 30, proportionPercent: 1 }).result.smallExpectedCounts).toBe(true));
test.each([[57,57,100],[114,57,200],[23,57.5,40],[115,57.5,200],[7,.7,1000],[3,.03,10000],[1,.0000001,1000000000],[57,56.99999999999999,101],[57,57.00000000000001,100]])('decimal recruitment ceiling for %s cases at %s%% is exactly %s', (completed,rate,expected) => {
  expect(sampleInvitations(completed,rate)).toBe(expected);
});
test('survey recruitment uses decimal ratios instead of overcounting an exact quotient', () => {
  expect(survey({population:66,responsePercent:57}).result).toMatchObject({completed:57,contacts:100});
});
test('decimal recruitment never undercounts an integer-rate planning grid', () => {
  for (let rate=1;rate<=100;rate++) for(let completed=1;completed<=1000;completed++) {
    expect(sampleInvitations(completed,rate)).toBe(Math.floor((completed*100+rate-1)/rate));
  }
});
test.each([[0,57],[1,0],[1,101],[1,NaN],[Number.MAX_SAFE_INTEGER,1],[1,Number.MIN_VALUE]])('unsafe recruitment input (%s,%s) is rejected', (completed,rate) => expect(sampleInvitations(completed,rate)).toBeNull());
test.each([['١٢٣٫٥',123.5],['۱۲۳٫۵',123.5],[' 20 ',20],['-0.3',-.3],['1,000',NaN],['1e3',NaN],['0x10',NaN],['<script>',NaN],['',NaN]])('strict numeric parsing %s', (input, value) => {
  const actual = sampleSizeNumber(String(input)); if (Number.isNaN(value)) expect(actual).toBeNaN(); else expect(actual).toBe(value);
});

test('published Morgan table is not silently replaced with ceiling estimates', () => {
  expect(krejcieMorganComparison(500)?.exact).toEqual([500,217]);
  expect(krejcieMorganComparison(550)?.exact).toEqual([550,226]);
  expect(krejcieMorganComparison(750)?.exact).toEqual([750,254]);
  expect(krejcieMorganComparison(2000)?.exact).toEqual([2000,322]);
  const comparison = krejcieMorganComparison(1234)!;
  expect(comparison.exact).toBeNull(); expect(comparison.lower?.[0]).toBe(1200); expect(comparison.upper?.[0]).toBe(1300);
  expect(krejcieMorganComparison(null)).toMatchObject({ exact: null, lower: null, upper: null, formulaRounded: 384 });
  expect(krejcieMorganComparison(0)).toBeNull();
  for (let i=1; i<KREJCIE_MORGAN_TABLE.length; i++) {
    expect(KREJCIE_MORGAN_TABLE[i][0]).toBeGreaterThan(KREJCIE_MORGAN_TABLE[i-1][0]);
    expect(KREJCIE_MORGAN_TABLE[i][1]).toBeGreaterThanOrEqual(KREJCIE_MORGAN_TABLE[i-1][1]);
  }
});

test('independent group approximation returns per-group and balanced recruitment totals', () => {
  const { result } = hypothesis({ ...tTest, responsePercent: 70 });
  expect(result).toMatchObject({ perGroup: 64, completed: 128, invitationsPerGroup: 92, contacts: 184 });
  expect(sampleMethodology({ kind: 'hypothesis', result }, 'en')).toContain('64 analyzable participants per group');
});

// Exact two-sided noncentral-t sizes per group (G*Power 3.1, alpha = .05, power = .80).
// The plain normal approximation gives 393 / 63 / 25; Guenther's (1981) correction closes the gap.
test.each([[0.2, 394], [0.5, 64], [0.8, 26]])('t-test with d = %s matches the exact per-group size %s', (effect, perGroup) => {
  expect(hypothesis({ ...tTest, effect }).result.perGroup).toBe(perGroup);
});
test('correlation matches the StatsDirect published initial-estimate example', () => {
  expect(hypothesis({ ...tTest, method: 'correlation', effect: 0.4 }).result.completed).toBe(47);
  expect(hypothesis({ ...tTest, method: 'correlation', effect: -0.4 }).result.completed).toBe(47);
});
test('higher power and smaller effects increase the approximation', () => {
  expect(hypothesis({ ...tTest, power: 90 }).result.completed).toBeGreaterThan(hypothesis(tTest).result.completed);
  expect(hypothesis({ ...tTest, effect: 0.2 }).result.completed).toBeGreaterThan(hypothesis(tTest).result.completed);
});
test.each([['overall',82],['individual',108],['both',108]] as const)('Green %s is explicitly a heuristic', (target, completed) => {
  const plan = hypothesis({ method: 'green', predictors: 4, target, population: null, responsePercent: 100 });
  expect(plan.result.completed).toBe(completed);
  expect(sampleMethodology(plan,'en')).toContain('does not establish a selected statistical power');
  expect(sampleMethodology(plan,'en')).not.toContain('target power 80%');
});
test('hypothesis population is feasibility only and never applies a survey correction', () => {
  expect(hypothesis({ ...tTest, population: 50 }).result).toMatchObject({ completed: 128, feasible: false });
});
test.each([
  { ...tTest, effect: 0 }, { ...tTest, effect: -0.2 }, { ...tTest, alpha: 0.2 }, { ...tTest, power: 99 },
  { ...tTest, method: 'correlation', effect: 1 }, { ...tTest, method: 'correlation', effect: -1 }, { ...tTest, effect: 1e-200 },
  { method: 'green', predictors: 1.5, target: 'both', population: null, responsePercent: 100 },
  { method: 'green', predictors: Number.MAX_SAFE_INTEGER, target: 'overall', population: null, responsePercent: 100 },
])('rejects invalid hypothesis assumptions %p', input => expect(calculateHypothesis(input as HypothesisInput).ok).toBe(false));

test.each(['ar','en'] as const)('draft and flow preserve inputs, provenance and scope in %s', language => {
  const plan = survey({ population: 1000, responsePercent: 60 });
  const draft = sampleMethodology(plan, language), flow = sampleFlow(plan, language);
  expect(draft).toContain('278'); expect(draft).toContain('464'); expect(draft).toContain('Cochran, 1977');
  expect(draft).toContain('1970'); expect(draft).toContain('https://doi.org/10.1177/001316447003000308');
  expect(flow.nodes.map(node => node.value)).toEqual(['1000','278','464']);
  if (language === 'en') { expect(draft).not.toMatch(/[\u0600-\u06ff]/); expect(draft).toContain('not a complete methodology chapter'); }
});
test('a recalculated Morgan value is not described as a published row', () => expect(sampleMethodology(survey({ population:1234 }),'en')).toContain('not an exact published table row'));
test('unknown-population short note defines n and project insertion preserves existing edits once', () => {
  const note = sampleSizeMethodNote(survey().result, 'en'); expect(note).toContain('n = n0.');
  const current = 'Supervisor: keep this prior explanation.';
  expect(appendSampleSizeNote(current,note)).toBe(`${current}\n\n${note}`);
  expect(appendSampleSizeNote(`${current}\n\n${note}`,note)).toBe(`${current}\n\n${note}`);
});
