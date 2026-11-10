/** Topic timing from real yearly publication counts (DOC-24-07). */

export type YearCount = { year: number; count: number };
export type TimingStage = 'insufficient' | 'emerging' | 'peak' | 'saturated' | 'limited';
export type Timing = {
  stage: TimingStage;
  total: number;
  /** Growth of the topic's share of all research: rawGrowth / baseGrowth. */
  growth: number;
  rawGrowth: number;
  /** Growth of everything OpenAlex indexes over the same years (1 when unknown). */
  baseGrowth: number;
  years: YearCount[];
};

export const TIMING_WINDOW = 5;
const MIN_TOTAL = 20;
const LARGE_FIELD = 500;

/**
 * The last TIMING_WINDOW complete years before `currentYear`. The current year
 * is still being indexed and a few records carry future dates; both are dropped.
 */
export function completeYears(counts: YearCount[], currentYear: number): YearCount[] {
  const byYear = new Map(counts.map(({ year, count }) => [year, count]));
  return Array.from({ length: TIMING_WINDOW }, (_, i) => {
    const year = currentYear - TIMING_WINDOW + i;
    return { year, count: byYear.get(year) ?? 0 };
  });
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Last two years over the first two. */
export function windowGrowth(years: YearCount[]): number {
  const counts = years.map(y => y.count);
  const early = (counts[0] ?? 0) + (counts[1] ?? 0);
  const late = (counts.at(-1) ?? 0) + (counts.at(-2) ?? 0);
  return late / Math.max(1, early);
}

/**
 * A stated heuristic over five complete years. OpenAlex indexes more works
 * every year, so raw growth makes every topic look rising; the verdict uses the
 * growth of the topic's share of all research (`base`) instead.
 */
export function classifyTiming(years: YearCount[], base?: YearCount[]): Timing {
  const total = years.reduce((sum, y) => sum + y.count, 0);
  const rawGrowth = windowGrowth(years);
  const baseGrowth = base && base.some(y => y.count > 0) ? windowGrowth(base) : 1;
  const growth = rawGrowth / Math.max(Number.EPSILON, baseGrowth);

  let stage: TimingStage;
  if (total < MIN_TOTAL) stage = 'insufficient';
  else if (total < LARGE_FIELD && growth >= 1.5) stage = 'emerging';
  else if (growth >= 1.2) stage = 'peak';
  else if (total >= LARGE_FIELD) stage = 'saturated';
  else stage = 'limited';

  return { stage, total, growth: round(growth), rawGrowth: round(rawGrowth), baseGrowth: round(baseGrowth), years };
}
