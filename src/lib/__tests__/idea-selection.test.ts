import { classifyTiming, completeYears } from '@/lib/idea-selection/timing';
import { rankDirections } from '@/lib/idea-selection/trends';
import { placeOnMatrix, parseRatings } from '@/lib/idea-selection/matrix';
import { OPEN_QUESTIONS, parseAnswers } from '@/lib/idea-selection/questions';

describe('completeYears', () => {
  test('keeps the last five complete years, filling missing years with zero', () => {
    const counts = [{ year: 2019, count: 1 }, { year: 2021, count: 4 }, { year: 2025, count: 9 }, { year: 2026, count: 99 }, { year: 2027, count: 2 }];
    expect(completeYears(counts, 2026)).toEqual([
      { year: 2021, count: 4 }, { year: 2022, count: 0 }, { year: 2023, count: 0 }, { year: 2024, count: 0 }, { year: 2025, count: 9 },
    ]);
  });
});

describe('classifyTiming', () => {
  const series = (...counts: number[]) => counts.map((count, i) => ({ year: 2021 + i, count }));

  test('too few studies give no verdict', () => {
    expect(classifyTiming(series(1, 2, 3, 4, 5)).stage).toBe('insufficient');
  });
  test('few studies growing fast are emerging', () => {
    expect(classifyTiming(series(10, 15, 30, 60, 90)).stage).toBe('emerging');
  });
  test('many studies still growing are at their peak', () => {
    expect(classifyTiming(series(2593, 3451, 4925, 11452, 25676)).stage).toBe('peak');
  });
  test('many studies without growth are saturated', () => {
    expect(classifyTiming(series(900, 950, 920, 940, 910)).stage).toBe('saturated');
  });
  test('few studies without growth are limited and stable', () => {
    expect(classifyTiming(series(30, 32, 31, 30, 33)).stage).toBe('limited');
  });
  test('reports the numbers behind the verdict', () => {
    const timing = classifyTiming(series(10, 10, 20, 30, 50));
    expect(timing).toMatchObject({ total: 120, growth: 4 });
    expect(timing.years).toHaveLength(5);
  });
});

describe('classifyTiming against overall publication growth', () => {
  const series = (...counts: number[]) => counts.map((count, i) => ({ year: 2021 + i, count }));
  // OpenAlex as a whole grew about 1.26x between 2021-22 and 2024-25.
  const base = series(10426605, 10092578, 10799780, 11049078, 14743061);

  test('a topic growing only as fast as all research is not at its peak', () => {
    const timing = classifyTiming(series(399, 389, 413, 434, 635), base);
    expect(timing.stage).toBe('saturated');
    expect(timing.growth).toBeCloseTo(1.08, 1);
  });
  test('a topic growing much faster than all research is still detected', () => {
    expect(classifyTiming(series(0, 0, 16, 104, 183), base).stage).toBe('emerging');
  });
  test('reports raw and overall growth alongside the share growth', () => {
    const timing = classifyTiming(series(97, 108, 108, 135, 214), base);
    expect(timing.rawGrowth).toBeCloseTo(1.7, 1);
    expect(timing.baseGrowth).toBeCloseTo(1.26, 1);
  });
});

describe('rankDirections', () => {
  test('a topic that grew only as much as all research is not a direction', () => {
    const directions = rankDirections([{ id: 'S', name: 'Same pace', count: 126 }, { id: 'F', name: 'Faster', count: 200 }],
      [{ id: 'S', name: 'Same pace', count: 100 }, { id: 'F', name: 'Faster', count: 100 }], 1.26);
    expect(directions.map(d => d.id)).toEqual(['F']);
    expect(directions[0].increase).toBe(74);
  });

  test('ranks topics by the increase in works and keeps at most twenty', () => {
    const recent = Array.from({ length: 25 }, (_, i) => ({ id: `T${i}`, name: `Topic ${i}`, count: 100 + i }));
    const prior = recent.map(t => ({ id: t.id, name: t.name, count: 100 }));
    const directions = rankDirections(recent, prior);
    expect(directions).toHaveLength(20);
    expect(directions[0]).toMatchObject({ id: 'T24', recent: 124, prior: 100, increase: 24 });
  });
  test('ignores topics with fewer than ten recent works and topics that shrank', () => {
    const directions = rankDirections(
      [{ id: 'A', name: 'A', count: 9 }, { id: 'B', name: 'B', count: 50 }, { id: 'C', name: 'C', count: 40 }],
      [{ id: 'B', name: 'B', count: 60 }, { id: 'C', name: 'C', count: 10 }],
    );
    expect(directions.map(d => d.id)).toEqual(['C']);
  });
  test('a topic new in the recent window counts its whole recent total as increase', () => {
    expect(rankDirections([{ id: 'N', name: 'New', count: 15 }], [])[0]).toMatchObject({ prior: 0, increase: 15 });
  });
});

describe('matrix', () => {
  test('places paths in the four quadrants', () => {
    expect(placeOnMatrix({ passion: 5, feasibility: 4 })).toBe('pursue');
    expect(placeOnMatrix({ passion: 4, feasibility: 2 })).toBe('make-feasible');
    expect(placeOnMatrix({ passion: 2, feasibility: 5 })).toBe('reconsider-interest');
    expect(placeOnMatrix({ passion: 3, feasibility: 3 })).toBe('set-aside');
  });
  test('accepts only whole ratings from 1 to 5 for distinct paths', () => {
    expect(parseRatings([{ pathId: 'a', passion: 5, feasibility: 1 }])).toEqual([{ pathId: 'a', passion: 5, feasibility: 1 }]);
    expect(parseRatings([{ pathId: 'a', passion: 6, feasibility: 1 }])).toBeNull();
    expect(parseRatings([{ pathId: 'a', passion: 2.5, feasibility: 1 }])).toBeNull();
    expect(parseRatings([{ pathId: 'a', passion: 1, feasibility: 1 }, { pathId: 'a', passion: 2, feasibility: 2 }])).toBeNull();
  });
});

describe('questions', () => {
  test('there are exactly five fixed questions', () => {
    expect(OPEN_QUESTIONS).toHaveLength(5);
    expect(new Set(OPEN_QUESTIONS.map(q => q.id)).size).toBe(5);
  });
  test('keeps answers to known questions within 1,000 characters', () => {
    expect(parseAnswers({ interest: '  الأثر على الطلبة  ', unknown: 'x' })).toEqual({ interest: 'الأثر على الطلبة' });
    expect(parseAnswers({ interest: 'x'.repeat(1001) })).toBeNull();
    expect(parseAnswers('not an object')).toBeNull();
  });
});
