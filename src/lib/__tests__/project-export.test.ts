import { buildProjectMarkdown } from '@/lib/project-export';
import { buildProjectExportModel } from '@/lib/project-export';
import { CITATION_STYLES } from '@/lib/citations/types';

const project = { title: 'بحث عربي', university_policy: null };
describe('project Markdown export', () => {
  it('includes the most recent immutable supervisor review in the full project export', () => {
    const review = { originalText: 'Original research text kept for comparison.', revisedText: 'Revised research text limits the conclusion.', notes: [{ id: '00000000-0000-4000-8000-000000000001', comment: 'حدد حدود الدراسة.', location: 'Conclusion', response: 'حصرت الاستنتاج في مجتمع الدراسة.', status: 'addressed' }] };
    const documents = [
      { type: 'journey:supervisor_review', version: 1, created_at: '2026-10-10T10:00:00Z', content: { ...review, revisedText: 'OBSOLETE revision that must not be selected.' } },
      { type: 'journey:supervisor_review', version: 1, created_at: '2026-10-10T11:00:00Z', content: review },
    ];
    const model = buildProjectExportModel(project, documents, [], []);
    expect(model.sections.find((section) => section.title === 'النص المعدّل')?.paragraphs).toEqual([review.revisedText]);
    expect(model.sections.some((section) => section.paragraphs.some((paragraph) => paragraph.includes(review.notes[0].response)))).toBe(true);
    const markdown = buildProjectMarkdown(project, documents, []);
    expect(markdown).toContain('مراجعة ملاحظات المشرف'); expect(markdown).toContain('Revised research text limits the conclusion\\.');
    expect(markdown).not.toContain('OBSOLETE'); expect(markdown).not.toContain('journey:supervisor_review');
  });
  it.each(CITATION_STYLES)('includes all 50 references formatted as %s with stored DOI and no invented metadata', (style) => {
    const references = Array.from({ length: 50 }, (_, index) => ({ title: `Declared reference ${index}`, authors: ['A. Author'], publication_year: 2025, publication_title: 'Test journal', doi: `10.1234/test${index}`, url: null, citation_data: { volume: '4', pages: '10–20' } }));
    const model = buildProjectExportModel(project, [], [], references, style);
    const bibliography = model.sections.find((section) => section.title === `قائمة المراجع — ${style}`)!;
    expect(bibliography.paragraphs).toHaveLength(51);
    // CSL IEEE prints "doi:" rather than a URL; every identifier must remain.
    expect(bibliography.paragraphs.filter((paragraph) => paragraph.includes('10.1234/'))).toHaveLength(50);
    expect(buildProjectMarkdown(project, [], [], references, style)).toContain(`قائمة المراجع — ${style}`);
  });
  it('includes saved library metadata without inventing missing values or rendering HTML', () => {
    const result = buildProjectMarkdown(project, [], [], [{ title: 'مرجع المكتبة', authors: ['باحث', { name: 'باحثة' }, null], publication_year: null, publication_title: null, doi: '10/123', url: '<img src=x>' }]);
    expect(result).toContain('مرجع المكتبة');
    expect(result).toContain('باحث، باحثة');
    expect(result).toContain('DOI: 10/123');
    expect(result).not.toContain('سنة النشر:');
    expect(result).not.toContain('<img');
  });
  it('exports latest versions in workflow order without internal decisions or raw JSON', () => {
    const result = buildProjectMarkdown(project, [
      { type: 'journey:objectives', version: 1, content: JSON.stringify({ objectives: ['هدف عربي'] }) },
      { type: 'journey:problem', version: 1, content: 'قديم' },
      { type: 'journey:decision', version: 9, content: 'INTERNAL' },
      { type: 'journey:problem', version: 2, content: JSON.stringify({ problemStatement: 'مشكلة جديدة' }) },
    ], []);
    expect(result).toContain('مشكلة البحث:\nمشكلة جديدة');
    expect(result).toContain('هدف عربي');
    expect(result).not.toMatch(/قديم|INTERNAL|journey:|problemStatement|\{"/);
    expect(result.indexOf('المشكلة والفجوة')).toBeLessThan(result.indexOf('## الأهداف'));
  });
  it('keeps long text without the email size cap and neutralizes markup', () => {
    const result = buildProjectMarkdown(project, [{ type: 'notes', version: 1, content: 'أ'.repeat(25_000) + '<script>alert(1)</script>![x](https://example.com)' }], []);
    expect(result).toContain('أ'.repeat(25_000));
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('![x]');
  });
  it('retains unknown fields, malformed JSON and source text rather than inventing citations', () => {
    const result = buildProjectMarkdown(project, [{ type: 'notes', version: 1, content: '{broken' }], [{ raw_text: 'المصدر الأصلي', parsed_citation_apa: null, parsed_citation_ieee: null }]);
    expect(result).toContain('broken');
    expect(result).toContain('المصدر الأصلي');
    expect(result).not.toContain('APA:');
  });
});
