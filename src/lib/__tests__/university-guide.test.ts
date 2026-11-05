jest.mock('pdf-parse', () => ({ PDFParse: class {
  async getInfo() { return { total: mockTotal }; }
  async getText() { return { pages: mockPages }; }
  async destroy() { mockDestroy(); }
} }));
import { extractUniversityGuide } from '@/lib/university-guide-server';
import { normalizeUniversityPolicy, universityPolicyForExport } from '@/lib/university-policy';
import { buildProjectExportModel, buildProjectMarkdown } from '@/lib/project-export';
let mockTotal = 2; let mockPages = [{ num: 1, text: 'Use APA 7 and preserve original quotations.' }, { num: 2, text: 'راجع الأرقام ±2 و p < .05 و95% مع الدليل الأصلي.' }];
const mockDestroy = jest.fn();
const bytes = () => new Uint8Array(Buffer.from('%PDF-1.7\nDeclared fake parser fixture'));
beforeEach(() => { mockTotal = 2; mockPages = [{ num: 1, text: 'Use APA 7 and preserve original quotations.' }, { num: 2, text: 'راجع الأرقام ±2 و p < .05 و95% مع الدليل الأصلي.' }]; jest.clearAllMocks(); });
test('all pages and numeric notation are preserved, with no fabricated summary', async () => {
  const guide = await extractUniversityGuide(bytes());
  expect(guide.text).toBe(mockPages.map(page => page.text).join('\n\n')); expect(guide.emptyPages).toEqual([]); expect(mockDestroy).toHaveBeenCalledTimes(1);
});
test.each(['signature', 'oversized', 'incomplete', 'order', 'no-text', 'text-limit', 'page-limit'])('rejects %s rather than saving a truncated guide', async mode => {
  let input = bytes();
  if (mode === 'signature') input = new Uint8Array(Buffer.from('not a PDF'));
  if (mode === 'oversized') input = new Uint8Array(4 * 1024 * 1024 + 1);
  if (mode === 'incomplete') mockPages.pop();
  if (mode === 'order') mockPages[1].num = 3;
  if (mode === 'no-text') mockPages.forEach(page => { page.text = ''; });
  if (mode === 'text-limit') mockPages[0].text = 'x'.repeat(100_001);
  if (mode === 'page-limit') mockTotal = 51;
  await expect(extractUniversityGuide(input)).rejects.toThrow();
  if (mode !== 'signature' && mode !== 'oversized') expect(mockDestroy).toHaveBeenCalledTimes(1);
});
test('an image-only guide is reported as having no text layer, unlike an over-long one', async () => {
  mockPages.forEach(page => { page.text = ''; });
  await expect(extractUniversityGuide(bytes())).rejects.toThrow('guide_no_text');
  mockPages[0].text = 'x'.repeat(100_001);
  await expect(extractUniversityGuide(bytes())).rejects.toThrow('guide_text');
});
test('reports a page without a text layer for explicit original-file review', async () => {
  mockPages[1].text = ''; expect((await extractUniversityGuide(bytes())).emptyPages).toEqual([2]);
});
test('reviewed instructions appear in actual export models; legacy filenames are not exported as guide contents', () => {
  const policy = mockPages.map(page => page.text).join('\n\n');
  const project = { title: 'Declared project fixture', university_policy: policy };
  for (const language of ['ar', 'en'] as const) expect(buildProjectExportModel(project, [], [], [], 'apa-7', language).sections.find(s => s.title === (language === 'ar' ? 'تعليمات الجامعة' : 'University guidelines'))?.paragraphs).toEqual([policy]);
  expect(buildProjectMarkdown(project, [], [])).toContain('APA 7');
  expect(universityPolicyForExport('Manual PDF Upload: guide.pdf', 'en')).toContain('Only a filename');
  expect(buildProjectMarkdown({ ...project, university_policy: 'Manual PDF Upload: guide.pdf' }, [], [])).not.toContain('Manual PDF Upload');
});
test('normalizes control characters as text while preserving meaningful numbers and literal markup', () => {
  expect(normalizeUniversityPolicy(' \u0000APA 7\r\np < .05; <b>text</b> ')).toBe('APA 7\np < .05; <b>text</b>');
  expect(normalizeUniversityPolicy({ text: 'object' })).toBeNull(); expect(normalizeUniversityPolicy('Manual PDF Upload: a.pdf')).toBeNull();
});
