/** Topic timing from real yearly publication counts (DOC-24-07). */

export type YearCount = { year: number; count: number };
export type TimingStage = 'insufficient' | 'emerging' | 'peak' | 'saturated' | 'limited';
export type Timing = { stage: TimingStage; total: number; growth: number; years: YearCount[] };

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

/**
 * A stated heuristic over five complete years: growth compares the last two
 * years with the first two. The counts are returned so the page can show them.
 */
export function classifyTiming(years: YearCount[]): Timing {
  const counts = years.map(y => y.count);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const early = (counts[0] ?? 0) + (counts[1] ?? 0);
  const late = (counts.at(-1) ?? 0) + (counts.at(-2) ?? 0);
  const growth = Math.round((late / Math.max(1, early)) * 100) / 100;

  let stage: TimingStage;
  if (total < MIN_TOTAL) stage = 'insufficient';
  else if (total < LARGE_FIELD && growth >= 1.5) stage = 'emerging';
  else if (growth >= 1.2) stage = 'peak';
  else if (total >= LARGE_FIELD) stage = 'saturated';
  else stage = 'limited';

  return { stage, total, growth, years };
}
