import path from 'node:path';
import { AlignmentType, Document as WordDocument, Footer, HeadingLevel, Packer, PageNumber, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import type { ProjectExportModel } from '@/lib/project-export';

const arabicFontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoNaskhArabic.ttf');

function rtlParagraph(text: string, options: { heading?: boolean; title?: boolean } = {}) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    heading: options.title ? HeadingLevel.TITLE : options.heading ? HeadingLevel.HEADING_1 : undefined,
    spacing: { after: options.title ? 320 : options.heading ? 220 : 140, line: 360 },
    children: [new TextRun({ text, bold: options.title || options.heading, size: options.title ? 34 : options.heading ? 28 : 24, rightToLeft: true })],
  });
}

export async function buildProjectDocx(model: ProjectExportModel): Promise<Buffer> {
  const children = [
    rtlParagraph(model.title, { title: true }),
    rtlParagraph(model.notice),
    ...model.sections.flatMap((section) => [
      rtlParagraph(section.title, { heading: true }),
      ...(section.paragraphs.length ? section.paragraphs : ['لا توجد بيانات محفوظة لهذه الفقرة.']).map((paragraph) => rtlParagraph(paragraph)),
    ]),
    rtlParagraph('أُعد بمساعدة الواحة.'),
  ];
  const document = new WordDocument({
    creator: 'WAHA',
    title: model.title,
    description: 'مخرجات المشروع البحثي المحفوظة في WAHA',
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
  const text = (value: string, size: number, color = '#1e293b', gap = 7) => {
    document.fontSize(size).fillColor(color).text(value, { align: 'right', features: ['rtla'], lineGap: gap });
  };
  text(model.title, 22, '#0f172a', 10);
  document.moveDown(0.3);
  text(model.notice, 10, '#475569', 5);
  document.moveDown(0.8);
  for (const section of model.sections) {
    text(section.title, 15, '#0f172a', 7);
    document.moveDown(0.3);
    for (const paragraph of section.paragraphs.length ? section.paragraphs : ['لا توجد بيانات محفوظة لهذه الفقرة.']) {
      text(paragraph, 11);
      document.moveDown(0.35);
    }
    document.moveDown(0.6);
  }
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.fontSize(8).fillColor('#64748b').text(`WAHA - ${index + 1} / ${range.count}`, 54, document.page.height - document.page.margins.bottom - 14, { align: 'center', width: document.page.width - 108, lineBreak: false });
  }
  document.end();
  return completed;
}
