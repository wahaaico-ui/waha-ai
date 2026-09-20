import { FIELD_LABELS, STAGE_LABELS } from '@/lib/email/project-snapshot';

type ExportDocument = { type: string | null; content: unknown; version: number | null };
type ExportSource = { raw_text: string | null; parsed_citation_apa: string | null; parsed_citation_ieee: string | null };
export type ExportReference = { title: string; authors: unknown; publication_year: number | null; publication_title: string | null; doi: string | null; url: string | null };
export type ProjectExportSection = { title: string; paragraphs: string[] };
export type ProjectExportModel = { title: string; notice: string; sections: ProjectExportSection[] };

function referenceAuthors(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.flatMap((author) => typeof author === 'string' ? [author]
    : author && typeof author === 'object' && typeof author.name === 'string' ? [author.name] : []).join('، ');
}

// Content remains text: prevent stored HTML, links and Markdown from becoming executable markup.
function text(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~>-])/g, '\\$1');
}

function lines(value: unknown, depth = 0): string[] {
  if (depth > 30) throw new Error('Export nesting exceeds supported depth');
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [text(value)];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item, index) => [`${index + 1}.`, ...lines(item, depth + 1)]);
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => [
    `${text(FIELD_LABELS[key] || key)}:`, ...lines(item, depth + 1), '',
  ]);
  return [];
}

function content(value: unknown): string {
  if (typeof value === 'string') {
    try { return lines(JSON.parse(value)).join('\n'); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return lines(value).join('\n');
}

function plainText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function plainLines(value: unknown, depth = 0): string[] {
  if (depth > 30) throw new Error('Export nesting exceeds supported depth');
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [plainText(value)].filter(Boolean);
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item, index) => plainLines(item, depth + 1).map((line, lineIndex) => lineIndex === 0 ? `${index + 1}. ${line}` : line));
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => {
    const itemLines = plainLines(item, depth + 1);
    return itemLines.length ? [`${plainText(FIELD_LABELS[key] || key)}:`, ...itemLines] : [];
  });
  return [];
}

function plainContent(value: unknown): string[] {
  if (typeof value === 'string') {
    try { return plainLines(JSON.parse(value)); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return plainLines(value);
}

function latestExportDocuments(documents: ExportDocument[]) {
  const stages = Object.keys(STAGE_LABELS);
  const latest = new Map<string, ExportDocument>();
  for (const document of documents) {
    const type = document.type || 'document';
    if (type.startsWith('journey:') && !stages.includes(type.slice(8))) continue;
    const previous = latest.get(type);
    if (!previous || (document.version || 0) > (previous.version || 0)) latest.set(type, document);
  }
  const rank = (type: string) => type.startsWith('journey:') ? stages.indexOf(type.slice(8)) : stages.length;
  return [...latest.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

export function buildProjectExportModel(project: { title: string | null; university_policy: string | null }, documents: ExportDocument[], sources: ExportSource[], references: ExportReference[] = []): ProjectExportModel {
  const documentSections = latestExportDocuments(documents).map(([type, document]) => {
    const stage = type.slice(8) as keyof typeof STAGE_LABELS;
    const label = type.startsWith('journey:') ? STAGE_LABELS[stage].ar : type;
    return { title: `${plainText(label)} - النسخة ${document.version || 1}`, paragraphs: plainContent(document.content) };
  });
  const sourceSections = sources.map((source, index) => ({
    title: `المصدر ${index + 1}`,
    paragraphs: [source.raw_text, source.parsed_citation_apa && `APA: ${source.parsed_citation_apa}`, source.parsed_citation_ieee && `IEEE: ${source.parsed_citation_ieee}`]
      .filter((value): value is string => Boolean(value)).map(plainText),
  }));
  const referenceSections = references.map((reference, index) => ({
    title: `المرجع ${index + 1}`,
    paragraphs: [
      `العنوان: ${reference.title}`,
      referenceAuthors(reference.authors) && `المؤلفون: ${referenceAuthors(reference.authors)}`,
      reference.publication_year !== null && `سنة النشر: ${reference.publication_year}`,
      reference.publication_title && `جهة النشر: ${reference.publication_title}`,
      reference.doi && `DOI: ${reference.doi}`,
      reference.url && `الرابط: ${reference.url}`,
    ].filter((value): value is string => typeof value === 'string' && Boolean(value)).map(plainText),
  }));
  return {
    title: plainText(project.title || 'مشروع بحثي'),
    notice: 'نسخة من آخر المخرجات المحفوظة؛ لا تعني اعتماد المخطوط أو ضمان قبوله للنشر.',
    sections: [
      { title: 'تعليمات الجامعة', paragraphs: [plainText(project.university_policy || 'لم تُحدد')] },
      ...documentSections,
      { title: 'المصادر المحفوظة', paragraphs: ['هذه بيانات المصادر كما حُفظت، وليست توثيقاً متحققاً منه تلقائياً.'] },
      ...sourceSections,
      { title: 'مكتبة مراجع المشروع', paragraphs: ['بيانات ببليوغرافية محفوظة؛ يجب مراجعتها قبل اعتماد نمط التوثيق النهائي.'] },
      ...referenceSections,
    ],
  };
}

export function buildProjectMarkdown(project: { title: string | null; university_policy: string | null }, documents: ExportDocument[], sources: ExportSource[], references: ExportReference[] = []): string {
  const sections = latestExportDocuments(documents);
  return [
    `# ${text(project.title || 'مشروع بحثي')}`, '',
    'نسخة من آخر المخرجات المحفوظة؛ لا تعني اعتماد المخطوط أو ضمان قبوله للنشر.', '',
    '## تعليمات الجامعة', content(project.university_policy || 'لم تُحدد'), '',
    ...sections.flatMap(([type, document]) => {
      const stage = type.slice(8) as keyof typeof STAGE_LABELS;
      const label = type.startsWith('journey:') ? STAGE_LABELS[stage].ar : type;
      return [`## ${text(label)} — النسخة ${document.version || 1}`, '', content(document.content), ''];
    }),
    '## المصادر المحفوظة', 'هذه بيانات المصادر كما حُفظت، وليست توثيقاً متحققاً منه تلقائياً.', '',
    ...sources.flatMap((source, index) => [`### المصدر ${index + 1}`,
      ...[source.raw_text, source.parsed_citation_apa && `APA: ${source.parsed_citation_apa}`, source.parsed_citation_ieee && `IEEE: ${source.parsed_citation_ieee}`].filter((value): value is string => Boolean(value)).map(text), '']),
    '## مكتبة مراجع المشروع',
    'بيانات ببليوغرافية محفوظة؛ لا تعني التحقق من المصدر أو اعتماد نمط توثيق معين.', '',
    ...references.flatMap((reference, index) => [`### المرجع ${index + 1}`,
      ...[
        `العنوان: ${reference.title}`,
        referenceAuthors(reference.authors) && `المؤلفون: ${referenceAuthors(reference.authors)}`,
        reference.publication_year !== null && `سنة النشر: ${reference.publication_year}`,
        reference.publication_title && `جهة النشر: ${reference.publication_title}`,
        reference.doi && `DOI: ${reference.doi}`,
        reference.url && `الرابط: ${reference.url}`,
      ].filter((value): value is string => typeof value === 'string' && Boolean(value)).map(text), '']),
    'أُعد بمساعدة الواحة.', '',
  ].join('\n');
}
