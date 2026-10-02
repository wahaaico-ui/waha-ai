import path from 'node:path';
import {
  AlignmentType,
  Document as WordDocument,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx';
import PDFDocument from 'pdfkit';
import type { ProjectExportModel, ProjectExportSection } from '@/lib/project-export';

const arabicFontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoNaskhArabic.ttf');

function rtlParagraph(text: string, options: { headingLevel?: 1 | 2; title?: boolean } = {}) {
  const isHeading = Boolean(options.headingLevel);
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    heading: options.title ? HeadingLevel.TITLE : options.headingLevel === 2 ? HeadingLevel.HEADING_2 : options.headingLevel === 1 ? HeadingLevel.HEADING_1 : undefined,
    keepNext: isHeading,
    spacing: { after: options.title ? 360 : isHeading ? 220 : 140, line: 360 },
    children: [new TextRun({
      text,
      bold: options.title || isHeading,
      color: '111827',
      size: options.title ? 40 : options.headingLevel === 1 ? 30 : options.headingLevel === 2 ? 26 : 24,
      rightToLeft: true,
    })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function tocParagraph(section: ProjectExportSection) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    indent: { right: section.level === 2 ? 420 : 0 },
    spacing: { after: 120, line: 320 },
    children: [new TextRun({
      text: section.title,
      bold: section.level !== 2,
      color: section.level === 2 ? '475569' : '1F2937',
      size: section.level === 2 ? 22 : 24,
      rightToLeft: true,
    })],
  });
}

function preservePdfLtrRuns(value: string): string {
  if (!/[\u0600-\u06FF]/.test(value)) return value;
  return value.replace(/[()]/g, (character) => character === '(' ? ')' : '(')
    .replace(/[A-Za-z0-9][A-Za-z0-9 .,:;/%+_\-–—]*/g, (run) => {
      const trailingSpace = run.match(/\s+$/)?.[0] || '';
      const content = trailingSpace ? run.slice(0, -trailingSpace.length) : run;
      return [...content].reverse().join('') + trailingSpace;
    });
}

export async function buildProjectDocx(model: ProjectExportModel): Promise<Buffer> {
  const children = [
    rtlParagraph(model.title, { title: true }),
    rtlParagraph('تقرير المشروع البحثي'),
    rtlParagraph(model.notice),
    pageBreak(),
    rtlParagraph('المحتويات', { headingLevel: 1 }),
    ...model.sections.map(tocParagraph),
    pageBreak(),
    ...model.sections.flatMap((section) => [
      rtlParagraph(section.title, { headingLevel: section.level || 1 }),
      ...(section.paragraphs.length ? section.paragraphs : ['لا توجد بيانات محفوظة لهذه الفقرة.']).map((paragraph) => rtlParagraph(paragraph)),
    ]),
    rtlParagraph('أُعد بمساعدة الواحة.'),
  ];
  const document = new WordDocument({
    creator: 'WAHA',
    title: model.title,
    description: 'مخرجات المشروع البحثي المحفوظة في WAHA',
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 24, color: '111827' }, paragraph: { spacing: { line: 360, after: 140 } } },
        title: { run: { font: 'Arial', size: 40, bold: true, color: '111827' }, paragraph: { spacing: { after: 360 } } },
        heading1: { run: { font: 'Arial', size: 30, bold: true, color: '111827' }, paragraph: { spacing: { before: 280, after: 180 } } },
        heading2: { run: { font: 'Arial', size: 26, bold: true, color: '1f2937' }, paragraph: { spacing: { before: 220, after: 140 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('WAHA - '), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
    }],
  });
  return Buffer.from(await Packer.toBuffer(document));
}

export async function buildProjectPdf(model: ProjectExportModel): Promise<Buffer> {
  const document = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: 54, right: 54, bottom: 58, left: 54 }, info: { Title: model.title, Author: 'WAHA' } });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  document.registerFont('NotoNaskhArabic', arabicFontPath).font('NotoNaskhArabic');
  const contentWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const text = (value: string, size: number, color = '#1e293b', gap = 7, options: { align?: 'right' | 'center'; continued?: boolean } = {}) => {
    document.fontSize(size).fillColor(color).text(preservePdfLtrRuns(value), {
      align: options.align || 'right',
      continued: options.continued,
      features: ['rtla'],
      lineGap: gap,
      width: contentWidth,
    });
  };

  const ensureHeadingSpace = (minimum = 90) => {
    if (document.y > document.page.height - document.page.margins.bottom - minimum) document.addPage();
  };

  text('الواحة', 16, '#92400e', 8, { align: 'center' });
  document.moveDown(2.2);
  text(model.title, 25, '#0f172a', 12, { align: 'center' });
  document.moveDown(0.7);
  text('تقرير المشروع البحثي', 15, '#334155', 8, { align: 'center' });
  document.moveDown(2.5);
  text(model.notice, 10, '#64748b', 6, { align: 'center' });

  const tocEntriesPerPage = 24;
  const tocPageCount = Math.max(1, Math.ceil(model.sections.length / tocEntriesPerPage));
  for (let page = 0; page < tocPageCount; page += 1) document.addPage();
  document.addPage();

  const sectionPages: { section: ProjectExportSection; page: number }[] = [];
  for (const section of model.sections) {
    ensureHeadingSpace(section.level === 2 ? 75 : 100);
    const page = document.bufferedPageRange().count;
    sectionPages.push({ section, page });
    document.outline.addItem(section.title);
    text(section.title, section.level === 2 ? 13 : 16, section.level === 2 ? '#334155' : '#0f172a', 7);
    document.moveDown(0.3);
    for (const paragraph of section.paragraphs.length ? section.paragraphs : ['لا توجد بيانات محفوظة لهذه الفقرة.']) {
      text(paragraph, 11);
      document.moveDown(0.35);
    }
    document.moveDown(0.6);
  }

  for (let tocPage = 0; tocPage < tocPageCount; tocPage += 1) {
    document.switchToPage(1 + tocPage);
    document.x = document.page.margins.left;
    document.y = document.page.margins.top;
    text(tocPage === 0 ? 'المحتويات' : 'المحتويات - تابع', 18, '#0f172a', 9);
    document.moveDown(0.6);
    for (const { section, page } of sectionPages.slice(tocPage * tocEntriesPerPage, (tocPage + 1) * tocEntriesPerPage)) {
      const levelPrefix = section.level === 2 ? '    ' : '';
      const available = Math.max(6, 70 - section.title.length);
      text(`${levelPrefix}${section.title} ${'.'.repeat(available)} ${page}`, section.level === 2 ? 10 : 11, section.level === 2 ? '#475569' : '#1e293b', 4);
      document.moveDown(0.15);
    }
  }

  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.fontSize(8).fillColor('#64748b').text(`WAHA - ${index + 1} / ${range.count}`, 54, document.page.height - document.page.margins.bottom - 14, { align: 'center', width: document.page.width - 108, lineBreak: false });
  }
  document.end();
  return completed;
}
