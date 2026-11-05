import path from 'node:path';
import { AlignmentType, BorderStyle, Document as WordDocument, Footer, HeadingLevel, LevelFormat, LevelSuffix, Packer, PageNumber, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType, type ILevelsOptions } from 'docx';
import PDFDocument from 'pdfkit';
import type { ProjectExportModel } from '@/lib/project-export';
import { documentLogicalRuns, pdfVisualStyledRuns } from './pdf-text-runs';
import { translateUiText } from './i18n/ui-text';
import { groupWritingRenderBlocks, type WritingRenderBlock, type WritingRenderTable, type WritingTextRun } from './writing-rich-text';
import { completePdfUnicodeMappings, pdfFontRuns, pdfReadingOrderRuns, preservePdfNumericDirection, type PdfFontName } from './pdf-font-runs';
import type { AcademicStyleProfile } from './academic-style-profile';
import { inferDocumentDirection } from './document-direction';

const unicodeFontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf');
const arabicFontPath = path.join(process.cwd(), 'public', 'fonts', 'Amiri-Regular.ttf');
const extendedArabicFontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoNaskhArabic.ttf');
const mathFontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansMath-Regular.ttf');

function bindingOnRight(model: ProjectExportModel) {
  const body = model.sections.flatMap(section => section.blocks
    ? section.blocks.flatMap(block => block.runs.map(run => run.text))
    : section.paragraphs).join('\n');
  return (model.documentDirection || inferDocumentDirection(body || model.title)) === 'rtl';
}

function documentParagraph(text: string, options: { heading?: boolean; title?: boolean } = {}, profile?: AcademicStyleProfile) {
  const rtl = /\p{Script=Arabic}/u.test(text);
  const rules = profile?.language_rules;
  const font = rtl ? rules?.arabic_font_family?.value : rules?.english_font_family?.value;
  const bodySize = rtl ? rules?.arabic_font_size_body?.value : rules?.english_font_size_body?.value;
  const headingSize = rtl ? rules?.arabic_font_size_heading_1?.value : null;
  return new Paragraph({
    alignment: AlignmentType.START,
    bidirectional: rtl,
    keepNext: Boolean(options.title || options.heading),
    widowControl: true,
    ...(!options.title && !options.heading && rules?.paragraph_indentation?.value !== undefined
      ? { indent: { firstLine: Math.round(rules.paragraph_indentation.value * 567) } } : {}),
    heading: options.title ? HeadingLevel.TITLE : options.heading ? HeadingLevel.HEADING_1 : undefined,
    spacing: { after: options.title ? 320 : options.heading ? 220 : 140, line: Math.round((rules?.line_spacing?.value || 1.5) * 240) },
    children: documentLogicalRuns(text).map(run => new TextRun({ text: rtl && !run.rtl ? `\u200e${run.text}\u200e` : run.text, bold: options.title || options.heading, color: options.title || options.heading ? '000000' : undefined, size: (options.title ? headingSize || 17 : options.heading ? headingSize || 14 : bodySize || 12) * 2, font, rightToLeft: run.rtl })),
  });
}

function richDocumentParagraph(block: WritingRenderBlock, listReference?: string, profile?: AcademicStyleProfile) {
  const runs = [...(block.prefix && !listReference ? [{ text: `${block.prefix.trim()}\u00a0` }] : []), ...block.runs];
  const rtl = /\p{Script=Arabic}/u.test(runs.map(r => r.text).join(''));
  const heading = block.kind === 'heading';
  const rules = profile?.language_rules;
  const font = rtl ? rules?.arabic_font_family?.value : rules?.english_font_family?.value;
  const bodySize = rtl ? rules?.arabic_font_size_body?.value : rules?.english_font_size_body?.value;
  return new Paragraph({
    alignment: AlignmentType.START, bidirectional: rtl, widowControl: true, keepNext: heading,
    heading: heading ? block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 : undefined,
    indent: { ...(rtl ? { right: block.indent * 360 } : { left: block.indent * 360 }),
      ...(!heading && rules?.paragraph_indentation?.value !== undefined ? { firstLine: Math.round(rules.paragraph_indentation.value * 567) } : {}) },
    ...(listReference ? { numbering: { reference: listReference, level: 0 } } : {}),
    spacing: { after: heading ? 220 : 140, line: Math.round((rules?.line_spacing?.value || 1.5) * 240) },
    children: runs.flatMap(run => run.text.split('\n').flatMap((line, index) => [
      ...(index ? [new TextRun({ break: 1 })] : []),
      ...documentLogicalRuns(line).map(part => new TextRun({ text: rtl && !part.rtl ? `\u200e${part.text}\u200e` : part.text, rightToLeft: part.rtl,
        bold: heading || run.marks?.includes('bold'), boldComplexScript: heading || run.marks?.includes('bold'), italics: run.marks?.includes('italic'), italicsComplexScript: run.marks?.includes('italic'), underline: run.marks?.includes('underline') ? {} : undefined,
        font: font || 'Arial', strike: run.marks?.includes('strike'), color: block.quote ? '475569' : '000000', size: heading ? (rtl && block.level === 1 ? rules?.arabic_font_size_heading_1?.value || 15 : block.level === 1 ? 15 : block.level === 2 ? 14 : 13) * 2 : (bodySize || 12) * 2,
      })),
    ])),
  });
}

export async function buildProjectDocx(model: ProjectExportModel): Promise<Buffer> {
  const ui = (message: string) => translateUiText(message, model.language || 'ar');
  const profile = model.styleProfile;
  const apaTables = profile?.citation_style.system?.value
    ? profile.citation_style.system.value === 'APA 7'
    : model.citationStyle === 'apa-7';
  const cm = (value: number | undefined, fallback: number) => value === undefined ? fallback : Math.round(value * 567);
  const binding = profile?.page_layout.margin_binding_side?.value;
  const other = profile?.page_layout.margin_other_side?.value;
  const pageMargins = {
    top: cm(profile?.page_layout.margin_top?.value, 1134), bottom: cm(profile?.page_layout.margin_bottom?.value, 1440),
    right: cm(bindingOnRight(model) ? binding : other, 1134), left: cm(bindingOnRight(model) ? other : binding, 1134), footer: 720,
  };
  const numbering: { reference: string; levels: ILevelsOptions[] }[] = [];
  const formattedParagraphs = (blocks: WritingRenderBlock[]) => {
    const lists = new Map<number, { reference: string; next: number; bullet: boolean }>();
    return blocks.map(block => {
      if (!block.prefix) { if (block.indent === 0) lists.clear(); return richDocumentParagraph(block, undefined, profile); }
      for (const depth of lists.keys()) if (depth > block.indent) lists.delete(depth);
      const bullet = block.prefix.trim() === '•'; const value = bullet ? 1 : Number.parseInt(block.prefix, 10);
      let list = lists.get(block.indent);
      if (!list || list.bullet !== bullet || (!bullet && list.next !== value)) {
        const reference = `waha-writing-list-${numbering.length}`;
        const rtl = /\p{Script=Arabic}/u.test(block.runs.map(run => run.text).join(''));
        numbering.push({ reference, levels: [{ level: 0, format: bullet ? LevelFormat.BULLET : LevelFormat.DECIMAL, text: bullet ? '•' : '%1.', start: value, suffix: LevelSuffix.SPACE,
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, style: { run: { font: 'Arial' }, paragraph: { indent: { left: block.indent * 360, hanging: 180 } } } }] });
        list = { reference, next: value, bullet }; lists.set(block.indent, list);
      }
      list.next = value + 1; return richDocumentParagraph(block, list.reference, profile);
    });
  };
  const formattedContent = (blocks: WritingRenderBlock[]): (Paragraph | Table)[] => {
    const result: (Paragraph | Table)[] = []; let paragraphs: WritingRenderBlock[] = [];
    const flush = () => { result.push(...formattedParagraphs(paragraphs)); paragraphs = []; };
    for (const block of groupWritingRenderBlocks(blocks)) {
      if (block.kind !== 'table') { paragraphs.push(block); continue; }
      flush();
      const columns = block.rows[0].cells.length;
      const columnWidth = Math.floor(9638 / columns);
      const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
      const noBorder = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' };
      result.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
        columnWidths: Array.from({ length: columns }, () => columnWidth), visuallyRightToLeft: model.language === 'ar',
        borders: apaTables
          ? { top: border, bottom: border, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder }
          : { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
        rows: block.rows.map(row => new TableRow({
          ...(row.cells.every(cell => cell.header) ? { tableHeader: true } : {}),
          children: row.cells.map(cell => new TableCell({
            width: { size: columnWidth, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 120, right: 120 },
            ...(apaTables ? { borders: { top: noBorder, bottom: cell.header ? border : noBorder, left: noBorder, right: noBorder } } : cell.header ? { shading: { fill: 'EFF6FF' } } : {}),
            children: cell.blocks.map(paragraph => richDocumentParagraph(cell.header ? { ...paragraph, runs: paragraph.runs.map(run => ({ ...run, marks: [...new Set([...(run.marks || []), 'bold' as const])] })) } : paragraph, undefined, profile)),
          })),
        })),
      }));
    }
    flush(); return result;
  };
  const children = [
    documentParagraph(model.title, { title: true }, profile),
    documentParagraph(model.notice, {}, profile),
    ...model.sections.flatMap((section) => [
      documentParagraph(section.title, { heading: true }, profile),
      ...(section.blocks ? formattedContent(section.blocks) : (section.paragraphs.length ? section.paragraphs : [translateUiText('لا توجد بيانات محفوظة لهذه الفقرة.', model.language || 'ar')]).flatMap((paragraph) => paragraph.split(/\r?\n/).map((line) => documentParagraph(line, {}, profile)))),
    ]),
    documentParagraph(ui('أُعد بمساعدة الواحة.'), {}, profile),
  ];
  const document = new WordDocument({
    creator: 'WAHA',
    title: model.title,
    description: ui('مخرجات المشروع البحثي المحفوظة في WAHA'),
    numbering: { config: numbering },
    styles: { paragraphStyles: ['Heading1', 'Heading2', 'Heading3'].map(id => ({ id, name: id, basedOn: 'Normal', next: 'Normal', run: { color: '000000', bold: true } })) },
    sections: [{
      properties: { page: { margin: pageMargins } },
      children,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('WAHA - '), new TextRun({ children: [PageNumber.CURRENT] })] })] }) },
    }],
  });
  return Buffer.from(await Packer.toBuffer(document));
}

export async function buildProjectPdf(model: ProjectExportModel): Promise<Buffer> {
  const profile = model.styleProfile;
  const point = (centimeters: number | undefined, fallback: number) => centimeters === undefined ? fallback : centimeters * 72 / 2.54;
  const rtl = bindingOnRight(model);
  const left = point(profile?.page_layout[rtl ? 'margin_other_side' : 'margin_binding_side']?.value, 54);
  const right = point(profile?.page_layout[rtl ? 'margin_binding_side' : 'margin_other_side']?.value, 54);
  const document = new PDFDocument({ size: 'A4', bufferPages: true, margins: { top: point(profile?.page_layout.margin_top?.value, 54), right, bottom: point(profile?.page_layout.margin_bottom?.value, 58), left }, info: { Title: model.title, Author: 'WAHA' } });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  document.registerFont('Amiri', arabicFontPath);
  document.registerFont('NotoNaskhArabicExtended', extendedArabicFontPath);
  document.registerFont('NotoSansMath', mathFontPath);
  preservePdfNumericDirection(document);
  document.registerFont('NotoSans', unicodeFontPath).font('NotoSans');
  const text = (value: string, size: number, color = '#1e293b', gap = 7, followingHeight = 0) => {
    document.fontSize(size).fillColor(color);
    const width = document.page.width - left - right;
    for (const paragraph of value.split('\n')) {
      const paragraphFont = /\p{Script=Arabic}/u.test(paragraph) ? 'Amiri'
        : /^[\u0009\u000d\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018-\u201d\u2022\u2026]*$/u.test(paragraph) ? 'Helvetica' : 'NotoSans';
      const fontForRun = (run: string): PdfFontName => /\p{Script=Arabic}/u.test(run) ? 'Amiri' : /^[\u0009\u000d\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018-\u201d\u2022\u2026]*$/u.test(run) ? 'Helvetica' : 'NotoSans';
      const visual = (line: string) => pdfVisualStyledRuns([{ text: line }], true).flatMap(run=>pdfFontRuns(run.text,fontForRun(run.text),run.sourceStart));
      const runWidth = (run: {text:string;font:PdfFontName}) => document.font(run.font).widthOfString(run.text, { features: ['rtla'] });
      const measure = (line: string) => visual(line).reduce((sum, run) => sum + runWidth(run), 0);
      document.font(paragraphFont);
      const spaceWidth = document.widthOfString(' ');
      const lines: string[] = []; let line = ''; let lineWidth = 0;
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const wordWidth = measure(word);
        const candidateWidth = lineWidth + (line ? spaceWidth : 0) + wordWidth;
        if (candidateWidth <= width - 2) { line = line ? `${line} ${word}` : word; lineWidth = candidateWidth; continue; }
        if (line) { lines.push(line); line = ''; lineWidth = 0; }
        // Ordinary words are shaped once. Only oversized URLs/tokens need
        // character wrapping, rather than every growing line per character.
        if (wordWidth <= width - 2) { line = word; lineWidth = wordWidth; continue; }
        for (const character of word) {
          if (line && measure(line + character) > width - 2) { lines.push(line); line = ''; }
          line += character;
        }
        lineWidth = measure(line);
      }
      lines.push(line);
      // Keep section headings beside the first lines of their content.
      document.font(paragraphFont);
      const blockHeight = lines.length * (document.currentLineHeight(true) + gap) + followingHeight;
      const contentBottom = document.page.height - document.page.margins.bottom - 18;
      if (followingHeight && blockHeight < contentBottom - document.page.margins.top && document.y + blockHeight > contentBottom) document.addPage();
      for (const logical of lines) {
        document.font(paragraphFont);
        const height = document.currentLineHeight(true) + gap;
        if (document.y + height > document.page.height - document.page.margins.bottom - 18) document.addPage();
        const y = document.y;
        const runs = visual(logical);
        const x = /\p{Script=Arabic}/u.test(logical) ? document.page.width - right - runs.reduce((sum, run) => sum + runWidth(run), 0) : left;
        // Preserve logical Unicode for copy/paste and accessible extraction;
        // Arabic glyph shaping alone is not a reliable text round trip.
        document.markContent('Span', { actual: logical });
        for (const run of pdfReadingOrderRuns(runs, x, runWidth)) {
          document.markContent('Span', { actual: run.text });
          document.font(run.font).text(run.text, run.x, y, { lineBreak: false, features: ['rtla'] });
          document.endMarkedContent();
        }
        document.endMarkedContent();
        document.x = left; document.y = y + height;
      }
    }
  };
  const richText = (block: WritingRenderBlock) => {
    const heading = block.kind === 'heading'; const rtlBlock = /\p{Script=Arabic}/u.test(block.runs.map(run => run.text).join(''));
    const size = heading
      ? (block.level === 1 ? profile?.language_rules.arabic_font_size_heading_1?.value || 17 : block.level === 2 ? 15 : 13)
      : (rtlBlock ? profile?.language_rules.arabic_font_size_body?.value || 11 : profile?.language_rules.english_font_size_body?.value || 11);
    const input: WritingTextRun[] = block.runs.map(run => ({ ...run, marks: heading ? [...new Set([...(run.marks || []), 'bold' as const])] : run.marks }));
    const listColumn = block.prefix ? 22 : 0;
    const available = document.page.width - left - right - Math.min(block.indent, 6) * 16 - listColumn;
    const font = (run: WritingTextRun) => /\p{Script=Arabic}/u.test(run.text) ? 'Amiri' : /^[\u0009\u000d\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018-\u201d\u2022\u2026]*$/u.test(run.text) ? run.marks?.includes('bold') ? run.marks.includes('italic') ? 'Helvetica-BoldOblique' : 'Helvetica-Bold' : run.marks?.includes('italic') ? 'Helvetica-Oblique' : 'Helvetica' : 'NotoSans';
    const visualRuns = (runs: WritingTextRun[]) => pdfVisualStyledRuns(runs, true).flatMap(run=>pdfFontRuns(run.text,font(run),run.sourceStart).map(part=>({...run,...part})));
    const measure = (runs: WritingTextRun[]) => visualRuns(runs).reduce((sum, run) => sum + document.font(run.font).fontSize(size).widthOfString(run.text, { features: ['rtla'] }), 0);
    const push = (runs: WritingTextRun[], run: WritingTextRun) => { const previous = runs[runs.length - 1]; if (previous && JSON.stringify(previous.marks) === JSON.stringify(run.marks)) previous.text += run.text; else runs.push({ text: run.text, ...(run.marks ? { marks: run.marks } : {}) }); };
    const lines: WritingTextRun[][] = []; let line: WritingTextRun[] = [];
      for (const run of input) for (const token of run.text.split(/(\n|[^\S\n]+|[^\s]+)/u).filter(Boolean)) {
      if (token === '\n') { lines.push(line); line = []; continue; }
      const part = { ...run, text: token };
      if (measure([...line, part]) <= available - 2) { push(line, part); continue; }
      if (line.length) { lines.push(line); line = []; }
      if (/^\s+$/u.test(token)) continue;
      if (measure([part]) <= available - 2) { push(line, part); continue; }
      for (const character of token) {
        const item = { ...run, text: character };
        if (line.length && measure([...line, item]) > available - 2) { lines.push(line); line = []; }
        push(line, item);
      }
    }
    lines.push(line);
    const height = size * (profile?.language_rules.line_spacing?.value || 1.9) + 4;
    if (heading && document.y + height * Math.min(lines.length + 2, 6) > document.page.height - document.page.margins.bottom - 18) document.addPage();
    for (const [lineIndex, logical] of lines.entries()) {
      if (document.y + height > document.page.height - document.page.margins.bottom - 18) document.addPage();
      const original = logical.map(run => run.text).join(''); const rtl = /\p{Script=Arabic}/u.test(original);
      const visual = visualRuns(logical); const y = document.y;
      const x = rtl ? document.page.width - right - Math.min(block.indent, 6) * 16 - listColumn - measure(logical) : left + Math.min(block.indent, 6) * 16 + listColumn;
      document.markContent('Span', { actual: `${lineIndex === 0 ? block.prefix || '' : ''}${original}` });
      if (lineIndex === 0 && block.prefix) {
        document.font('Helvetica').fontSize(size).fillColor('#1e293b');
        const prefix = block.prefix.trim(); const prefixLeft = rtl ? document.page.width - right - Math.min(block.indent, 6) * 16 - document.widthOfString(prefix) : left + Math.min(block.indent, 6) * 16;
        document.text(prefix, prefixLeft, y, { lineBreak: false });
      }
      for (const run of pdfReadingOrderRuns(visual, x, run => document.font(run.font).fontSize(size).widthOfString(run.text, { features: ['rtla'] }))) {
        const name = run.font, nativeLatin = name.startsWith('Helvetica');
        document.font(name).fontSize(size).fillColor(block.quote ? '#475569' : '#1e293b').strokeColor(block.quote ? '#475569' : '#1e293b').lineWidth(0.2);
        document.markContent('Span', { actual: run.text });
        document.text(run.text, run.x, y, { lineBreak: false, features: ['rtla'], underline: run.marks?.includes('underline'), strike: run.marks?.includes('strike'),
          stroke: !nativeLatin && run.marks?.includes('bold'), fill: true, oblique: !nativeLatin && run.marks?.includes('italic') ? 12 : false });
        document.endMarkedContent();
      }
      document.endMarkedContent(); document.x = left; document.y = y + height;
    }
    document.moveDown(0.25);
  };
  const richTable = (table: WritingRenderTable) => {
    const size = 11, lineHeight = size * 1.9 + 4, padding = 7;
    const width = document.page.width - left - right, cellWidth = width / table.rows[0].cells.length;
    const available = cellWidth - padding * 2;
    const font = (run: WritingTextRun) => /\p{Script=Arabic}/u.test(run.text) ? 'Amiri'
      : /^[\u0009\u000d\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018-\u201d\u2022\u2026]*$/u.test(run.text)
        ? run.marks?.includes('bold') ? run.marks.includes('italic') ? 'Helvetica-BoldOblique' : 'Helvetica-Bold' : run.marks?.includes('italic') ? 'Helvetica-Oblique' : 'Helvetica' : 'NotoSans';
    const visualRuns = (runs: WritingTextRun[]) => pdfVisualStyledRuns(runs, true).flatMap(run=>pdfFontRuns(run.text,font(run),run.sourceStart).map(part=>({...run,...part})));
    const measure = (runs: WritingTextRun[]) => visualRuns(runs).reduce((sum, run) => sum + document.font(run.font).fontSize(size).widthOfString(run.text, { features: ['rtla'] }), 0);
    const append = (runs: WritingTextRun[], run: WritingTextRun) => {
      const previous = runs.at(-1);
      if (previous && JSON.stringify(previous.marks) === JSON.stringify(run.marks)) previous.text += run.text;
      else runs.push({ text: run.text, ...(run.marks ? { marks: run.marks } : {}) });
    };
    const wrap = (input: WritingTextRun[]) => {
      const lines: WritingTextRun[][] = []; let line: WritingTextRun[] = [];
      for (const run of input) for (const token of (run.citationIds?.length && measure([run]) <= available - 2
        ? [run.text] : run.text.split(/(\n|[^\S\n]+|[^\s]+)/u).filter(Boolean))) {
        if (token === '\n') { lines.push(line); line = []; continue; }
        const part = { ...run, text: token };
        if (measure([...line, part]) <= available - 2) { append(line, part); continue; }
        if (line.length) { lines.push(line); line = []; }
        if (/^\s+$/u.test(token)) continue;
        if (measure([part]) <= available - 2) { append(line, part); continue; }
        for (const character of token) {
          const piece = { ...run, text: character };
          if (line.length && measure([...line, piece]) > available - 2) { lines.push(line); line = []; }
          append(line, piece);
        }
      }
      lines.push(line); return lines;
    };
    const rows = table.rows.map(row => ({ cells: row.cells.map(cell => ({
      header: cell.header,
      lines: cell.blocks.flatMap((block, index) => [
        ...(index ? [[] as WritingTextRun[]] : []),
        ...wrap(block.runs.map(run => cell.header ? { ...run, marks: [...new Set([...(run.marks || []), 'bold' as const])] } : run)),
      ]),
    })) }));
    type Row = typeof rows[number];
    const countLines = (row: Row) => Math.max(1, ...row.cells.map(cell => cell.lines.length));
    const rowHeight = (row: Row) => countLines(row) * lineHeight + padding * 2;
    const bottom = () => document.page.height - document.page.margins.bottom - 18;
    const pageHeight = bottom() - document.page.margins.top;
    let headerCount = 0;
    while (headerCount < rows.length && rows[headerCount].cells.every(cell => cell.header)) headerCount++;
    const headers = rows.slice(0, headerCount);
    const headerHeight = headers.reduce((sum, row) => sum + rowHeight(row), 0);
    // Oversized headings still render in full. Repeating them must leave room
    // for a body line, otherwise a continued row could never make progress.
    const repeatHeaders = headerCount > 0 && headerHeight + lineHeight + padding * 2 <= pageHeight;
    const draw = (row: Row, offset: number, lineCount: number) => {
      const top = document.y, height = lineCount * lineHeight + padding * 2;
      row.cells.forEach((cell, column) => {
        const visualColumn = model.language === 'ar' ? row.cells.length - column - 1 : column;
        const cellLeft = left + visualColumn * cellWidth;
        document.save().lineWidth(0.5).strokeColor('#cbd5e1');
        if (cell.header) document.rect(cellLeft, top, cellWidth, height).fillAndStroke('#eff6ff', '#cbd5e1');
        else document.rect(cellLeft, top, cellWidth, height).stroke();
        document.restore();
        cell.lines.slice(offset, offset + lineCount).forEach((logical, index) => {
          const original = logical.map(run => run.text).join('');
          const rtl = /\p{Script=Arabic}/u.test(original);
          const y = top + padding + index * lineHeight;
          const x = rtl ? cellLeft + cellWidth - padding - measure(logical) : cellLeft + padding;
          document.markContent('Span', { actual: original });
          for (const run of pdfReadingOrderRuns(visualRuns(logical), x, run => document.font(run.font).fontSize(size).widthOfString(run.text, { features: ['rtla'] }))) {
            const name = run.font, nativeLatin = name.startsWith('Helvetica');
            document.font(name).fontSize(size).fillColor('#1e293b').strokeColor('#1e293b').lineWidth(0.2);
            document.markContent('Span', { actual: run.text });
            document.text(run.text, run.x, y, { lineBreak: false, features: ['rtla'], underline: run.marks?.includes('underline'), strike: run.marks?.includes('strike'),
              stroke: !nativeLatin && run.marks?.includes('bold'), fill: true, oblique: !nativeLatin && run.marks?.includes('italic') ? 12 : false });
            document.endMarkedContent();
          }
          document.endMarkedContent();
        });
      });
      document.x = left; document.y = top + height;
    };
    rows.forEach((row, rowIndex) => {
      const nextPage = () => {
        document.addPage();
        if (repeatHeaders && rowIndex >= headerCount) for (const header of headers) draw(header, 0, countLines(header));
      };
      const freshHeight = pageHeight - (repeatHeaders && rowIndex >= headerCount ? headerHeight : 0);
      if (rowHeight(row) <= freshHeight && document.y + rowHeight(row) > bottom()) nextPage();
      let offset = 0;
      while (offset < countLines(row)) {
        const capacity = Math.floor((bottom() - document.y - padding * 2) / lineHeight);
        if (capacity < 1) { nextPage(); continue; }
        const count = Math.min(capacity, countLines(row) - offset);
        draw(row, offset, count); offset += count;
        if (offset < countLines(row)) nextPage();
      }
    });
    document.moveDown(0.35);
  };
  text(model.title, 22, '#0f172a', 10);
  document.moveDown(0.3);
  text(model.notice, 10, '#475569', 5);
  const approvedArabicFont = profile?.language_rules.arabic_font_family?.value;
  const approvedEnglishFont = profile?.language_rules.english_font_family?.value;
  if ((approvedArabicFont && approvedArabicFont !== 'Amiri') || (approvedEnglishFont && approvedEnglishFont !== 'Noto Sans')) {
    text(model.language === 'en'
      ? 'Guide review: this PDF uses Amiri, Noto and Helvetica fonts. An approved font differs; inspect the PDF against your guide before submission.'
      : 'مراجعة الدليل: يستخدم هذا PDF خطوط Amiri وNoto وHelvetica. أحد الخطوط المعتمدة مختلف؛ راجع الملف مع دليل الجهة قبل التسليم.', 10, '#92400e', 5);
  }
  document.moveDown(0.8);
  for (const section of model.sections) {
    text(section.title, 15, '#0f172a', 7, 54);
    document.moveDown(0.3);
    if (section.blocks) for (const block of groupWritingRenderBlocks(section.blocks)) {
      if (block.kind === 'table') richTable(block); else richText(block);
    }
    else for (const paragraph of section.paragraphs.length ? section.paragraphs : [translateUiText('لا توجد بيانات محفوظة لهذه الفقرة.', model.language || 'ar')]) {
      text(paragraph, /\p{Script=Arabic}/u.test(paragraph) ? profile?.language_rules.arabic_font_size_body?.value || 11 : profile?.language_rules.english_font_size_body?.value || 11);
      document.moveDown(0.35);
    }
    document.moveDown(0.6);
  }
  const range = document.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document.font('Helvetica').fontSize(8).fillColor('#64748b').text(`WAHA - ${index + 1} / ${range.count}`, left, document.page.height - document.page.margins.bottom - 14, { align: 'center', width: document.page.width - left - right, lineBreak: false });
  }
  completePdfUnicodeMappings(document);
  document.end();
  return completed;
}
