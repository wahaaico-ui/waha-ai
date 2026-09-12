import { buildProjectMarkdown } from '@/lib/project-export';

const project = { title: 'بحث عربي', university_policy: null };
describe('project Markdown export', () => {
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
