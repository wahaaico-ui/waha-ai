import { writingExportModel } from '@/lib/evidence-writing-export';
import { inferDocumentDirection, type DocumentDirection } from '@/lib/document-direction';
import { translateUiText, type UiLanguage } from '@/lib/i18n/ui-text';
import { FIELD_LABELS, STAGE_LABELS } from '@/lib/email/project-snapshot';
import type { CitationStyle } from '@/lib/citations/types';
import { buildSourceBibliography, citationIssueText } from '@/lib/citations/writing-citations';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';
import { readSupervisorReview, supervisorExportModel, SUPERVISOR_DOCUMENT_TYPE } from '@/lib/supervisor-review';
import { readSavedWriting, safeWritingUrl, WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { analysisExportSections, assessmentStillApplies, readWritingAnalysis, WRITING_ANALYSIS_TYPE, type WritingAnalysis } from '@/lib/writing-analysis';
import type { WritingRenderBlock } from '@/lib/writing-rich-text';
import { writingBlocksMarkdown } from '@/lib/writing-markdown';
import { universityPolicyForExport } from '@/lib/university-policy';
import { extractAcademicStyleProfile, type AcademicStyleProfile } from '@/lib/academic-style-profile';
import { approvedStyleProfile, readSavedGuide } from '@/lib/guide-workflow';

export type ExportDocument = { id?: string; type: string | null; content: unknown; version: number | null; created_at?: string };
type ExportSource = { raw_text: string | null; parsed_citation_apa: string | null; parsed_citation_ieee: string | null };
export type ExportReference = { title: string; authors: unknown; publication_year: number | null; publication_title: string | null; doi: string | null; url: string | null; citation_data?: unknown };
export type ProjectExportSection = { title: string; paragraphs: string[]; blocks?: WritingRenderBlock[] };
export type ProjectExportModel = { language?: UiLanguage; documentDirection?: DocumentDirection; title: string; notice: string; sections: ProjectExportSection[]; styleProfile?: AcademicStyleProfile; citationStyle?: CitationStyle };

function referenceAuthors(reference: ExportReference, language: UiLanguage = 'ar'): string {
  return bibliographyFromReference({ ...reference, citation_data: reference.citation_data ?? {} }).authors
    .map(name => 'literal' in name ? name.literal : [name.given, name.family].filter(Boolean).join(' ')).join(language === 'ar' ? '، ' : ', ');
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

function plainLines(value: unknown, depth = 0, language: UiLanguage = 'ar'): string[] {
  if (depth > 30) throw new Error('Export nesting exceeds supported depth');
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [plainText(value)].filter(Boolean);
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item, index) => plainLines(item, depth + 1, language).map((line, lineIndex) => lineIndex === 0 ? `${index + 1}. ${line}` : line));
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => {
    const itemLines = plainLines(item, depth + 1, language);
    return itemLines.length ? [`${plainText(translateUiText(FIELD_LABELS[key] || key, language))}:`, ...itemLines] : [];
  });
  return [];
}

function plainContent(value: unknown, language: UiLanguage = 'ar'): string[] {
  if (typeof value === 'string') {
    try { return plainLines(JSON.parse(value), 0, language); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return plainLines(value, 0, language);
}

function latestExportDocuments(documents: ExportDocument[]) {
  const stages = Object.keys(STAGE_LABELS);
  const latest = new Map<string, ExportDocument>();
  for (const document of documents) {
    const type = document.type || 'document';
    if (type === WRITING_DOCUMENT_TYPE || type === WRITING_ANALYSIS_TYPE || type === 'pdf-original:v1') continue;
    if (type.startsWith('journey:') && !stages.includes(type.slice(8))) continue;
    const previous = latest.get(type);
    if (!previous || (document.version || 0) > (previous.version || 0)) latest.set(type, document);
  }
  const rank = (type: string) => type.startsWith('journey:') ? stages.indexOf(type.slice(8)) : stages.length;
  return [...latest.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

function latestSupervisorReview(documents: ExportDocument[], language: UiLanguage = 'ar') {
  const latest = documents.filter((document) => document.type === SUPERVISOR_DOCUMENT_TYPE)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
  const review = latest && readSupervisorReview(latest.content);
  return review ? supervisorExportModel(review, language) : null;
}

export function latestWritingExportDraft(documents: ExportDocument[]) {
  const latest = documents.filter(document => document.type === WRITING_DOCUMENT_TYPE)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
  if (!latest) return null;
  const draft = readSavedWriting(latest.content);
  if (!draft) throw new Error('Saved writing could not be restored for export');
  return draft;
}

function latestEvidenceWriting(documents: ExportDocument[], language: UiLanguage, citationStyle?: CitationStyle) {
  const draft = latestWritingExportDraft(documents);
  return draft ? writingExportModel(draft, language, citationStyle) : null;
}

/** Shared by rendering and the server trust check so both inspect the same rows. */
export function selectWritingExportAnalyses(documents: ExportDocument[], language: UiLanguage) {
  const draft = latestWritingExportDraft(documents);
  const selected = new Map<string, WritingAnalysis>();
  for (const doc of documents.filter(d => d.type === WRITING_ANALYSIS_TYPE).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))) {
    const record = readWritingAnalysis(doc.content); if (!record) throw new Error('Saved source analysis could not be restored for export');
    if (record.operation === 'citation' && (!draft || !assessmentStillApplies(draft, record))) continue;
    const key = JSON.stringify([record.operation, record.source.kind, record.source.id, ...(record.operation === 'citation' ? [record.citationId, record.claimText, record.quoteText] : [])]);
    const previous = selected.get(key);
    if (!previous || (previous.sourceHash === record.sourceHash && previous.language !== language && record.language === language)) selected.set(key, record);
  }
  return [...selected.values()];
}

function writingAnalysisSections(documents: ExportDocument[], language: UiLanguage) {
  return analysisExportSections(selectWritingExportAnalyses(documents, language), language, latestWritingExportDraft(documents));
}

function formattedReferences(references: ExportReference[], style: CitationStyle) {
  return buildSourceBibliography(references.map((reference, index) => ({ id: `library-${index}`, kind: 'reference', title: reference.title,
    year: reference.publication_year, url: safeWritingUrl(reference.url), origin: 'saved-library',
    bibliography: bibliographyFromReference({ ...reference, citation_data: reference.citation_data ?? {} }),
  })), style);
}

export function buildProjectExportModel(project: { title: string | null; university_policy: string | null }, documents: ExportDocument[], sources: ExportSource[], references: ExportReference[] = [], citationStyle?: CitationStyle, language: UiLanguage = 'ar'): ProjectExportModel {
  const ui = (message: string, values?: readonly unknown[]) => translateUiText(message, language, values);
  const review = latestSupervisorReview(documents, language);
  const writing = latestEvidenceWriting(documents, language, citationStyle);
  const library = !writing && citationStyle ? formattedReferences(references, citationStyle) : null;
  const documentSections = latestExportDocuments(documents).map(([type, document]) => {
    const stage = type.slice(8) as keyof typeof STAGE_LABELS;
    const label = type.startsWith('journey:') ? STAGE_LABELS[stage][language] : type;
    return { title: ui('{0} - النسخة {1}', [plainText(label), document.version || 1]), paragraphs: plainContent(document.content, language) };
  });
  const sourceSections = sources.map((source, index) => ({
    title: ui('المصدر {0}', [index + 1]),
    paragraphs: [source.raw_text, source.parsed_citation_apa && `APA: ${source.parsed_citation_apa}`, source.parsed_citation_ieee && `IEEE: ${source.parsed_citation_ieee}`]
      .filter((value): value is string => Boolean(value)).map(plainText),
  }));
  const referenceSections = references.map((reference, index) => ({
    title: ui('المرجع {0}', [index + 1]),
    paragraphs: [
      `${ui('العنوان:')} ${reference.title}`,
      referenceAuthors(reference, language) && `${ui('المؤلفون:')} ${referenceAuthors(reference, language)}`,
      reference.publication_year !== null && `${ui('سنة النشر:')} ${reference.publication_year}`,
      reference.publication_title && `${ui('جهة النشر:')} ${reference.publication_title}`,
      reference.doi && `DOI: ${reference.doi}`,
      reference.url && `${ui('الرابط:')} ${reference.url}`,
    ].filter((value): value is string => typeof value === 'string' && Boolean(value)).map(plainText),
  }));
  return {
    language,
    documentDirection: writing?.documentDirection ?? review?.documentDirection ?? inferDocumentDirection(documentSections.flatMap(section => section.paragraphs).join('\n') || project.title || ''),
    ...(citationStyle ? { citationStyle } : {}),
    ...(project.university_policy ? { styleProfile: project.university_policy.startsWith('WAHA_GUIDE_V1:')
      ? approvedStyleProfile(readSavedGuide(project.university_policy))
      : extractAcademicStyleProfile(project.university_policy) } : {}),
    title: plainText(project.title || ui('مشروع بحثي')),
    notice: ui('نسخة من آخر المخرجات المحفوظة؛ لا تعني اعتماد المخطوط أو ضمان قبوله للنشر.'),
    sections: [
      { title: ui('تعليمات الجامعة'), paragraphs: [plainText(universityPolicyForExport(project.university_policy, language))] },
      ...documentSections,
      ...(writing ? [{ title: writing.title, paragraphs: [writing.notice] }, ...writing.sections] : []),
      ...writingAnalysisSections(documents, language),
      ...(review ? [{ title: review.title, paragraphs: [review.notice] }, ...review.sections] : []),
      { title: ui('المصادر المحفوظة'), paragraphs: [ui('هذه بيانات المصادر كما حُفظت، وليست توثيقاً متحققاً منه تلقائياً.')] },
      ...sourceSections,
      { title: ui('مكتبة مراجع المشروع'), paragraphs: [ui('بيانات ببليوغرافية محفوظة؛ يجب مراجعتها قبل اعتماد نمط التوثيق النهائي.')] },
      ...referenceSections,
      ...(library ? [{ title: ui('قائمة المراجع — {0}', [citationStyle]), paragraphs: [ui('منسقة من البيانات المحفوظة. راجع الحقول ومطابقة الإحالات داخل النص وتعليمات الجهة قبل التسليم.'), ...library.bibliography.map(entry => entry.text)] },
        ...(library.issues.length ? [{ title: language === 'ar' ? 'بيانات مراجع تحتاج مراجعة' : 'Reference details to review', paragraphs: library.issues.map(issue => citationIssueText(issue, language)) }] : []),
      ] : []),
    ],
  };
}

export function buildProjectMarkdown(project: { title: string | null; university_policy: string | null }, documents: ExportDocument[], sources: ExportSource[], references: ExportReference[] = [], citationStyle?: CitationStyle, language: UiLanguage = 'ar'): string {
  if (language === 'en') {
    const model = buildProjectExportModel(project, documents, sources, references, citationStyle, language);
    return [`# ${text(model.title)}`, '', text(model.notice), ...model.sections.flatMap((section) => [`## ${text(section.title)}`, ...(section.blocks ? writingBlocksMarkdown(section.blocks) : section.paragraphs.map(text)), ''])].join('\n');
  }
  const sections = latestExportDocuments(documents);
  const review = latestSupervisorReview(documents);
  const writing = latestEvidenceWriting(documents, 'ar', citationStyle);
  const library = !writing && citationStyle ? formattedReferences(references, citationStyle) : null;
  return [
    `# ${text(project.title || 'مشروع بحثي')}`, '',
    'نسخة من آخر المخرجات المحفوظة؛ لا تعني اعتماد المخطوط أو ضمان قبوله للنشر.', '',
    '## تعليمات الجامعة', content(universityPolicyForExport(project.university_policy, 'ar')), '',
    ...sections.flatMap(([type, document]) => {
      const stage = type.slice(8) as keyof typeof STAGE_LABELS;
      const label = type.startsWith('journey:') ? STAGE_LABELS[stage].ar : type;
      return [`## ${text(label)} — النسخة ${document.version || 1}`, '', content(document.content), ''];
    }),
    ...(writing ? [`## ${text(writing.title)}`, text(writing.notice), '', ...writing.sections.flatMap(section => [`### ${text(section.title)}`, ...(section.blocks ? writingBlocksMarkdown(section.blocks) : section.paragraphs.map(text)), ''])] : []),
    ...writingAnalysisSections(documents, 'ar').flatMap(section => [`## ${text(section.title)}`, ...section.paragraphs.map(text), '']),
    ...(review ? [`## ${text(review.title)}`, text(review.notice), '', ...review.sections.flatMap((section) => [`### ${text(section.title)}`, ...section.paragraphs.map(text), ''])] : []),
    '## المصادر المحفوظة', 'هذه بيانات المصادر كما حُفظت، وليست توثيقاً متحققاً منه تلقائياً.', '',
    ...sources.flatMap((source, index) => [`### المصدر ${index + 1}`,
      ...[source.raw_text, source.parsed_citation_apa && `APA: ${source.parsed_citation_apa}`, source.parsed_citation_ieee && `IEEE: ${source.parsed_citation_ieee}`].filter((value): value is string => Boolean(value)).map(text), '']),
    '## مكتبة مراجع المشروع',
    'بيانات ببليوغرافية محفوظة؛ لا تعني التحقق من المصدر أو اعتماد نمط توثيق معين.', '',
    ...references.flatMap((reference, index) => [`### المرجع ${index + 1}`,
      ...[
        `العنوان: ${reference.title}`,
        referenceAuthors(reference) && `المؤلفون: ${referenceAuthors(reference)}`,
        reference.publication_year !== null && `سنة النشر: ${reference.publication_year}`,
        reference.publication_title && `جهة النشر: ${reference.publication_title}`,
        reference.doi && `DOI: ${reference.doi}`,
        reference.url && `الرابط: ${reference.url}`,
      ].filter((value): value is string => typeof value === 'string' && Boolean(value)).map(text), '']),
    ...(library ? [`## قائمة المراجع — ${citationStyle}`, 'منسقة من البيانات المحفوظة؛ راجع مطابقة الإحالات وتعليمات الجهة قبل التسليم.', '', ...library.bibliography.map(entry => text(entry.text)), '',
      ...(library.issues.length ? ['## بيانات مراجع تحتاج مراجعة', ...library.issues.map(issue => text(citationIssueText(issue, 'ar'))), ''] : []),
    ] : []),
    'أُعد بمساعدة الواحة.', '',
  ].join('\n');
}
