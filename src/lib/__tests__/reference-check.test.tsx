// Reference check v0: deterministic reading of reference lists, comparison with
// index records, and conservative reporting (never "fake" or "verified").
jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn() }));
jest.mock('@/lib/reference-check-providers', () => ({ REFERENCE_PROVIDERS: [] }));

import { renderToStaticMarkup } from 'react-dom/server';
import ReferenceCheckReportView from '@/components/reference-check/ReferenceCheckReportView';
import { POST } from '@/app/api/research/reference-check/route';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import {
  checkReference, checkReferenceList, extractReferenceSection, MAX_REFERENCES, parseReference, splitReferences, titleSimilarity,
  type FoundRecord, type ReferenceProvider,
} from '@/lib/reference-check';
import { REFERENCE_STATUS_LABELS } from '@/lib/reference-check-ui';

const APA = `Smith, J., & Lee, K. (2021). Artificial intelligence in university governance: A systematic review. Journal of Higher Education Policy, 43(2), 101–118. https://doi.org/10.1080/1360080X.2021.1234567
Brown, A. (2019). Decision support systems in
higher education institutions. Computers & Education, 128, 1–12.
العتيبي، محمد. (2020). واقع التحول الرقمي في الجامعات السعودية. مجلة العلوم التربوية، 12(3)، 45–70.
Garcia, M. (2023). A study that does not exist anywhere at all. Imaginary Journal, 1(1), 1–2.`;

const record = (overrides: Partial<FoundRecord> = {}): FoundRecord => ({ provider: 'crossref', title: 'Artificial intelligence in university governance: A systematic review', authors: ['John Smith', 'Kim Lee'], year: 2021, doi: '10.1080/1360080x.2021.1234567', url: null, ...overrides });

function provider(id: ReferenceProvider['id'], byDoi: Record<string, FoundRecord | null>, catalogue: FoundRecord[], down = false): ReferenceProvider {
  return {
    id,
    async byDoi(doi) { if (down) throw new Error('down'); return byDoi[doi] ?? null; },
    async search(query) { if (down) throw new Error('down'); return catalogue.filter((item) => titleSimilarity(query, item.title) > 0.3); },
  };
}

describe('reading a reference list', () => {
  test('author-year references are split, wrapped lines joined, and DOI, year, title and author read', () => {
    const entries = splitReferences(APA);
    expect(entries).toHaveLength(4);
    expect(entries[1]).toBe('Brown, A. (2019). Decision support systems in higher education institutions. Computers & Education, 128, 1–12.');
    const first = parseReference(entries[0], 1);
    expect(first).toEqual(expect.objectContaining({ doi: '10.1080/1360080x.2021.1234567', year: 2021, firstAuthor: 'Smith', arabic: false }));
    expect(first.title).toBe('Artificial intelligence in university governance: A systematic review');
    const arabic = parseReference(entries[2], 3);
    expect(arabic).toEqual(expect.objectContaining({ year: 2020, arabic: true, title: 'واقع التحول الرقمي في الجامعات السعودية' }));
  });

  test('numbered references are split on their numbers', () => {
    const entries = splitReferences('[1] A. Author, "Machine learning for academic advising," IEEE Access, vol. 9, 2021.\n[2] B. Writer, "Learning analytics dashboards in practice," Computers in Human Behavior, 2020.');
    expect(entries).toHaveLength(2);
    expect(parseReference(entries[0], 1).title).toBe('Machine learning for academic advising');
  });

  test('the reference section is taken from the body, not the table of contents, and stops at the appendices', () => {
    const document = ['المحتويات', 'المقدمة 1', 'المراجع 90', ...Array(40).fill('نص الفصل'), 'المراجع', APA, 'الملاحق', 'استبانة الدراسة'].join('\n');
    const { section, detected } = extractReferenceSection(document);
    expect(detected).toBe(true);
    expect(section).toContain('Smith, J.');
    expect(section).not.toContain('نص الفصل');
    expect(section).not.toContain('استبانة الدراسة');
  });
});

describe('comparing with the indexes', () => {
  const catalogue = [record(), record({ title: 'Decision support systems in higher education institutions', authors: ['Alice Brown'], year: 2017, doi: null })];

  test('a matching record is reported as found with matching details', async () => {
    const result = await checkReference(parseReference(splitReferences(APA)[0], 1), [provider('crossref', { '10.1080/1360080x.2021.1234567': record() }, catalogue)]);
    expect(result.status).toBe('matched');
    expect(result.differences).toEqual([]);
  });

  test('a different year is shown as a difference, not hidden', async () => {
    const result = await checkReference(parseReference(splitReferences(APA)[1], 2), [provider('crossref', {}, catalogue)]);
    expect(result.status).toBe('matched_with_differences');
    expect(result.differences).toEqual([{ field: 'year', cited: '2019', found: '2017' }]);
  });

  test('a DOI that belongs to a different work is reported as such', async () => {
    const other = record({ title: 'Soil microbiology of alpine meadows', authors: ['Q. Other'] });
    const result = await checkReference(parseReference(splitReferences(APA)[0], 1), [provider('crossref', { '10.1080/1360080x.2021.1234567': other }, [])]);
    expect(result.status).toBe('doi_mismatch');
    expect(result.record?.title).toBe('Soil microbiology of alpine meadows');
  });

  test('a loosely similar search result is never reported as found; it is shown only as the closest record', async () => {
    const lookalike = record({ title: 'Artificial intelligence adoption in university governance: A case study', authors: ['P. Real'], year: 2022, doi: '10.1/real' });
    const invented = parseReference('Al-Harbi, S., & Thompson, R. (2022). Artificial intelligence adoption in Gulf university governance: A mixed-methods study. Journal of Educational Leadership in the Arab World, 8(2), 55–79.', 1);
    const score = titleSimilarity(invented.title as string, lookalike.title);
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThan(0.75);
    const result = await checkReference(invented, [provider('crossref', {}, [lookalike])]);
    expect(result.status).toBe('not_found');
    expect(result.record).toBeNull();
    const html = renderToStaticMarkup(<ReferenceCheckReportView report={{ checkedAt: '2026-10-03T00:00:00.000Z', totalFound: 1, truncated: false, sectionDetected: false, results: [{ ...result, closest: lookalike }], counts: { matched: 0, matched_with_differences: 0, doi_mismatch: 0, not_found: 1, not_checked: 0, unparsed: 0 }, providers: ['crossref'], arabicReferences: 0 }} />);
    expect(html).toContain('ليس مطابقاً للمرجع');
  });

  test('a reference absent from every reachable index is not found; unreachable indexes mean not checked', async () => {
    const missing = parseReference(splitReferences(APA)[3], 4);
    const notFound = await checkReference(missing, [provider('crossref', {}, catalogue), provider('openalex', {}, [], true)]);
    expect(notFound.status).toBe('not_found');
    expect(notFound.providersSearched).toEqual(['crossref']);
    expect(notFound.providersUnavailable).toEqual(['openalex']);
    const unchecked = await checkReference(missing, [provider('crossref', {}, [], true), provider('openalex', {}, [], true)]);
    expect(unchecked.status).toBe('not_checked');
  });

  test('a whole list is counted, capped and flags Arabic references', async () => {
    const report = await checkReferenceList(APA, [provider('crossref', { '10.1080/1360080x.2021.1234567': record() }, catalogue)]);
    expect(report.counts).toEqual(expect.objectContaining({ matched: 1, matched_with_differences: 1, not_found: 2 }));
    expect(report.arabicReferences).toBe(1);
    const long = Array.from({ length: MAX_REFERENCES + 5 }, (_, index) => `Author${index}, A. (2020). Title number ${index} about governance. Journal, 1, 1.`).join('\n');
    const capped = await checkReferenceList(long, [provider('crossref', {}, [])]);
    expect(capped.results).toHaveLength(MAX_REFERENCES);
    expect(capped.truncated).toBe(true);
  });
});

describe('the report', () => {
  const FORBIDDEN = /مزيف|مزيّف|مختلق|وهمي|غير صحيح|موثّق|موثق|تم التحقق|verified|fake|fabricated|invalid/i;

  test('shows the counts, each reference as read, the Arabic coverage note and the limitations, without accusing or certifying', async () => {
    const catalogue = [record()];
    const report = await checkReferenceList(APA, [provider('crossref', { '10.1080/1360080x.2021.1234567': record() }, catalogue), provider('openalex', {}, [], true)]);
    const html = renderToStaticMarkup(<ReferenceCheckReportView report={report} />);
    expect(html).toContain('لم يُعثر عليه في الفهارس التي بحثنا فيها');
    expect(html).toContain('وُجد وبياناته متطابقة');
    expect(html).toContain('تغطية هذه الفهارس للمنشورات العربية محدودة');
    expect(html).toContain('حدود هذا الفحص');
    expect(html).toContain('تعذر الوصول إلى: OpenAlex');
    expect(html).toContain('A study that does not exist anywhere at all');
    expect(html).not.toMatch(FORBIDDEN);
    for (const status of Object.values(REFERENCE_STATUS_LABELS)) expect(`${status.label} ${status.explanation}`).not.toMatch(FORBIDDEN);
    // Attention order: what needs the researcher's attention comes first.
    expect(html.indexOf('data-status="not_found"')).toBeLessThan(html.indexOf('data-status="matched"'));
  });
});

describe('route', () => {
  const auth = requireAuthenticatedUser as jest.Mock;
  const post = (body: unknown) => POST(new Request('http://localhost/api/research/reference-check', { method: 'POST', body: JSON.stringify(body) }));

  test('requires a signed-in researcher and validates the input', async () => {
    auth.mockResolvedValue(null);
    expect((await post({ text: APA })).status).toBe(401);
    auth.mockResolvedValue({ user: { id: 'u' } });
    expect((await post({ text: 'short' })).status).toBe(400);
    expect((await post({ text: 'x'.repeat(200_001) })).status).toBe(413);
    expect((await post({ text: 'This text has no references in it at all, only prose.' })).status).toBe(200);
  });
});
