import { careerExportModel, normalizeOrcid, toCitationProfile, toNextDirections, toTimeline } from '@/lib/scholarly-career';

describe('ORCID iD', () => {
  test('accepts a valid iD in any common form and rejects a wrong checksum', () => {
    expect(normalizeOrcid('0000-0003-1613-5981')).toBe('0000-0003-1613-5981');
    expect(normalizeOrcid('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('0000-0002-1694-233X')).toBe('0000-0002-1694-233X');
    expect(normalizeOrcid('0000-0003-1613-5982')).toBeNull();
    expect(normalizeOrcid('not an id')).toBeNull();
  });
});

const works = [
  { id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/a', title: 'The state of OA', publication_year: 2018, cited_by_count: 1510, primary_location: { source: { display_name: 'PeerJ' } }, primary_topic: { id: 'https://openalex.org/T1', display_name: 'Academic Publishing and Open Access' } },
  { id: 'https://openalex.org/W2', doi: null, title: 'OpenAlex index', publication_year: 2022, cited_by_count: 1290, primary_location: null, primary_topic: { id: 'https://openalex.org/T2', display_name: 'scientometrics and bibliometrics research' } },
  { id: 'https://openalex.org/W3', doi: null, title: '', publication_year: 2020, cited_by_count: 1, primary_location: null, primary_topic: null },
];

describe('career timeline (DOC-30-03)', () => {
  test('lists the researcher\'s works newest first, by their identifiers', () => {
    expect(toTimeline(works)).toEqual([
      { id: 'W2', title: 'OpenAlex index', year: 2022, doi: null, venue: null, citations: 1290, topic: 'scientometrics and bibliometrics research' },
      { id: 'W1', title: 'The state of OA', year: 2018, doi: 'https://doi.org/10.1/a', venue: 'PeerJ', citations: 1510, topic: 'Academic Publishing and Open Access' },
    ]);
  });
});

describe('citation tracking (DOC-30-01)', () => {
  const group = (key: string, name: string, count: number) => ({ key, key_display_name: name, count });
  test('counts, years, journals and countries of the works citing one exact work; contexts are not available', () => {
    const profile = toCitationProfile(
      { id: 'https://openalex.org/W1', title: 'The state of OA', cited_by_count: 1510, counts_by_year: [{ year: 2026, cited_by_count: 241 }, { year: 2025, cited_by_count: 188 }] },
      [group('US', 'United States', 328), group('GB', 'United Kingdom', 133)],
      [group('https://openalex.org/S1', 'Scientometrics', 63)],
    );
    expect(profile).toEqual({
      workId: 'W1', title: 'The state of OA', citations: 1510,
      byYear: [{ year: 2025, count: 188 }, { year: 2026, count: 241 }],
      journals: [{ name: 'Scientometrics', count: 63 }],
      countries: [{ name: 'United States', count: 328 }, { name: 'United Kingdom', count: 133 }],
      contexts: null,
    });
  });
});

describe('next directions from the researcher\'s own works (DOC-30-02)', () => {
  test('topics where the citing works go and the researcher has not published, each tied to the work that drew them', () => {
    const directions = toNextDirections(works, {
      W1: [{ key: 'https://openalex.org/T1', key_display_name: 'Academic Publishing and Open Access', count: 386 }, { key: 'https://openalex.org/T9', key_display_name: 'Library Science and Information', count: 87 }],
      W2: [{ key: 'https://openalex.org/T8', key_display_name: 'Research Data Management', count: 40 }, { key: 'https://openalex.org/T9', key_display_name: 'Library Science and Information', count: 20 }],
    });
    expect(directions).toEqual([
      { topicId: 'T9', topic: 'Library Science and Information', citingWorks: 107, fromWorks: [{ id: 'W1', title: 'The state of OA' }, { id: 'W2', title: 'OpenAlex index' }] },
      { topicId: 'T8', topic: 'Research Data Management', citingWorks: 40, fromWorks: [{ id: 'W2', title: 'OpenAlex index' }] },
    ]);
  });
});

describe('career file (DOC-30-03)', () => {
  const career = {
    orcid: '0000-0003-1613-5981', author: null, checkedAt: '2026-11-12T10:00:00.000Z', source: 'openalex' as const,
    timeline: toTimeline(works),
    citations: [{ workId: 'W1', title: 'The state of OA', citations: 1510, byYear: [{ year: 2026, count: 241 }], journals: [{ name: 'Scientometrics', count: 63 }], countries: [], contexts: null }],
    directions: [{ topicId: 'T9', topic: 'Library Science and Information', citingWorks: 107, fromWorks: [{ id: 'W1', title: 'The state of OA' }, { id: 'W2', title: 'OpenAlex index' }] }],
  };

  test('every section states its basis, and contexts are said to be unavailable', () => {
    const model = careerExportModel(career);
    expect(model.title).toBe('المسيرة البحثية');
    expect(model.notice).toContain('0000-0003-1613-5981');
    expect(model.sections.map(section => section.title)).toEqual(['الباحث', 'الأعمال المنشورة', 'تتبع الاستشهادات', 'اتجاهات تالية مقترحة']);
    const text = JSON.stringify(model.sections);
    expect(text).toContain('لم يُعثر على ملف باحث بهذا المعرّف في OpenAlex.');
    expect(text).toContain('سياقات الاستشهاد: غير متاحة؛ لا تنشرها OpenAlex.');
    expect(text).toContain('انطلاقًا من: The state of OA — OpenAlex index. الموضوع: Library Science and Information');
  });

  test('the English file carries no Arabic', () => {
    const model = careerExportModel(career, 'en');
    expect(model.documentDirection).toBe('ltr');
    expect(JSON.stringify(model)).not.toMatch(/[؀-ۿ]/);
  });
});
