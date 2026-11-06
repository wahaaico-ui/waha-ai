import { buildOriginalityReport } from '@/lib/originality/report';
import type { OverlapSource } from '@/lib/originality/text-match';

const copied = 'تشير النتائج إلى أن استخدام الذكاء الاصطناعي التوليدي يحسن فهم الطلبة للمفاهيم المعقدة';
const pdf: OverlapSource = { id: '11111111-1111-4111-8111-111111111111', origin: 'project-pdf', title: 'Study A', url: null, year: 2023, text: `مقدمة ${copied} خاتمة` };
const open: OverlapSource = { id: 'W123', origin: 'open-source', title: 'Open study', url: 'https://doi.org/10.1/x', year: 2022, text: copied };

const checked = { projectSources: 1, openSources: 0, openSourceProviders: [] as string[] };

describe('buildOriginalityReport', () => {
  test('marks a passage uncited when no citation covers it', () => {
    const text = `هذا نص الباحث. ${copied}.`;
    const report = buildOriginalityReport({ text, sources: [pdf], citations: [], checked });
    expect(report.passages).toHaveLength(1);
    expect(report.passages[0].matches[0]).toMatchObject({ title: 'Study A', cited: false });
    expect(report.uncitedPassages).toBe(1);
  });

  test('marks a passage cited when a citation to the same source covers it', () => {
    const text = `هذا نص الباحث. ${copied}.`;
    const claimStart = text.indexOf(copied);
    const report = buildOriginalityReport({
      text, sources: [pdf], checked,
      citations: [{ sourceKind: 'pdf', sourceId: pdf.id, claimStart, claimEnd: claimStart + copied.length }],
    });
    expect(report.passages[0].matches[0].cited).toBe(true);
    expect(report.uncitedPassages).toBe(0);
  });

  test('a citation to a different source does not mark the match cited', () => {
    const text = copied;
    const report = buildOriginalityReport({
      text, sources: [pdf], checked,
      citations: [{ sourceKind: 'reference', sourceId: '22222222-2222-4222-8222-222222222222', claimStart: 0, claimEnd: text.length }],
    });
    expect(report.passages[0].matches[0].cited).toBe(false);
  });

  test('coverage is the share of words inside matched passages', () => {
    const own = 'كلمات كتبها الباحث بنفسه وحده';
    const report = buildOriginalityReport({ text: `${copied} ${own}`, sources: [pdf], citations: [], checked });
    const total = copied.split(' ').length + own.split(' ').length;
    expect(report.matchedWords).toBe(copied.split(' ').length);
    expect(report.totalWords).toBe(total);
    expect(report.coveragePercent).toBe(Math.round((copied.split(' ').length / total) * 1000) / 10);
  });

  test('states what was not checked, including the licensed service', () => {
    const report = buildOriginalityReport({ text: copied, sources: [pdf, open], citations: [], checked: { projectSources: 1, openSources: 1, openSourceProviders: ['openalex'] } });
    expect(report.licensedService).toBe('not_configured');
    expect(report.limitations.join(' ')).toMatch(/ليس تقرير أصالة رسميًا/);
    expect(report.limitations.join(' ')).toMatch(/الكتابة الآلية/);
    expect(report.passages[0].matches.map(m => m.origin).sort()).toEqual(['open-source', 'project-pdf']);
  });
});

describe('openSourceQueries', () => {
  // Imported lazily so the report tests above stay free of server modules.
  const { openSourceQueries, MAX_OPEN_QUERIES } = jest.requireActual('@/lib/originality/sources-server') as typeof import('@/lib/originality/sources-server');

  test('sends at most three phrases of at most twelve words, longest sentences first', () => {
    const long = (n: number, w: string) => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');
    const text = [long(9, 'a'), long(20, 'b'), long(15, 'c'), long(30, 'd'), 'قصيرة جدا'].join('. ');
    const queries = openSourceQueries(text);
    expect(queries).toHaveLength(MAX_OPEN_QUERIES);
    expect(queries[0].startsWith('d0')).toBe(true);
    expect(queries.every(q => q.split(' ').length <= 12)).toBe(true);
  });

  test('sends nothing when no sentence is long enough to identify a source', () => {
    expect(openSourceQueries('جملة قصيرة. وأخرى.')).toEqual([]);
  });
});
