/** A deliberately small, server-validated document schema. Never store or render
 * client HTML. Plain text remains the canonical UTF-16 citation coordinate space. */
export type WritingMark = 'bold' | 'italic' | 'underline' | 'strike';
export type WritingRichNode = {
  type: string; text?: string; attrs?: { level?: number; start?: number; colspan?: number; rowspan?: number; colwidth?: null };
  marks?: { type: WritingMark }[]; content?: WritingRichNode[];
};
export type WritingRichDocument = WritingRichNode & { type: 'doc'; content: WritingRichNode[] };
export type WritingTextRun = { text: string; marks?: WritingMark[]; citationIds?: string[] };
export type WritingRenderBlock = {
  kind: 'paragraph' | 'heading'; level?: number; prefix?: string; indent: number;
  quote: boolean; start: number; end: number; runs: WritingTextRun[];
  table?: { id: number; row: number; column: number; header: boolean };
};
export type WritingRenderTable = { kind: 'table'; rows: { cells: { header: boolean; blocks: WritingRenderBlock[] }[] }[] };
export const WRITING_TABLE_MAX_COLUMNS = 8;
export const WRITING_TABLE_MAX_ROWS = 200;
const MARKS: WritingMark[] = ['bold', 'italic', 'underline', 'strike'];
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));

export function readWritingRichDocument(value: unknown): WritingRichDocument | null {
  let nodes = 0, characters = 0;
  function read(input: unknown, parent: string, depth: number): WritingRichNode | null {
    if (!object(input) || ++nodes > 12000 || depth > 12 || typeof input.type !== 'string') return null;
    const type = input.type;
    const allowed = parent === '' ? ['doc'] : ['paragraph', 'heading'].includes(parent) ? ['text', 'hardBreak']
      : ['bulletList', 'orderedList'].includes(parent) ? ['listItem']
      : parent === 'table' ? ['tableRow'] : parent === 'tableRow' ? ['tableCell', 'tableHeader']
      : ['tableCell', 'tableHeader'].includes(parent) ? ['paragraph']
      : ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', ...(parent === 'doc' ? ['table'] : [])];
    if (!allowed.includes(type)) return null;
    if (type === 'text') {
      if (typeof input.text !== 'string' || !input.text || CONTROL.test(input.text) || input.content !== undefined || input.attrs !== undefined) return null;
      characters += input.text.length; if (characters > 120000) return null;
      const marks: { type: WritingMark }[] = [];
      if (input.marks !== undefined) {
        if (!Array.isArray(input.marks) || input.marks.length > MARKS.length) return null;
        for (const mark of input.marks) {
          if (!object(mark) || !MARKS.includes(mark.type as WritingMark) || mark.attrs !== undefined || marks.some(m => m.type === mark.type)) return null;
          marks.push({ type: mark.type as WritingMark });
        }
        marks.sort((a, b) => MARKS.indexOf(a.type) - MARKS.indexOf(b.type));
      }
      return { type, text: input.text, ...(marks.length ? { marks } : {}) };
    }
    if (type === 'hardBreak') {
      if (input.content !== undefined || input.attrs !== undefined || input.text !== undefined) return null;
      if (input.marks !== undefined && (!Array.isArray(input.marks) || input.marks.length > MARKS.length || input.marks.some(m => !object(m) || !MARKS.includes(m.type as WritingMark) || m.attrs !== undefined))) return null;
      const marks = [...new Set(((input.marks || []) as { type: WritingMark }[]).map(m => m.type))].sort((a, b) => MARKS.indexOf(a) - MARKS.indexOf(b)).map(type => ({ type }));
      return { type, ...(marks.length ? { marks } : {}) };
    }
    if (input.text !== undefined || input.marks !== undefined) return null;
    const attrs = input.attrs;
    if (attrs !== undefined && !object(attrs)) return null;
    const cell = type === 'tableCell' || type === 'tableHeader';
    if (object(attrs) && Object.keys(attrs).some(key => !(type === 'heading' ? ['level'] : type === 'orderedList' ? ['start', 'type'] : cell ? ['colspan', 'rowspan', 'colwidth', 'align'] : []).includes(key))) return null;
    // Unmerged rectangular cells are portable across the editor, Word and PDF.
    // Reject unsupported spans/widths rather than silently losing their layout.
    if (cell && object(attrs) && ((attrs.colspan !== undefined && attrs.colspan !== 1) || (attrs.rowspan !== undefined && attrs.rowspan !== 1) || (attrs.colwidth !== undefined && attrs.colwidth !== null) || (attrs.align !== undefined && attrs.align !== null))) return null;
    if (type === 'heading' && (!object(attrs) || ![1, 2, 3].includes(Number(attrs.level)))) return null;
    if (type === 'orderedList' && object(attrs) && ((attrs.start !== undefined && (!Number.isSafeInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 1000000)) || (attrs.type !== undefined && attrs.type !== null && attrs.type !== '1'))) return null;
    if (input.content !== undefined && !Array.isArray(input.content)) return null;
    const content: WritingRichNode[] = [];
    for (const child of (input.content || []) as unknown[]) { const item = read(child, type, depth + 1); if (!item) return null; content.push(item); }
    if (!['paragraph', 'heading'].includes(type) && !content.length) return null;
    if (type === 'listItem' && content[0]?.type !== 'paragraph') return null;
    if (type === 'tableRow' && content.length > WRITING_TABLE_MAX_COLUMNS) return null;
    if (type === 'table' && (content.length > WRITING_TABLE_MAX_ROWS || content.some(row => row.content?.length !== content[0].content?.length))) return null;
    return { type, ...(type === 'heading' ? { attrs: { level: Number((attrs as Record<string, unknown>).level) } } : type === 'orderedList' ? { attrs: { start: Number((attrs as Record<string, unknown> | undefined)?.start ?? 1) } } : cell ? { attrs: { colspan: 1, rowspan: 1, colwidth: null } } : {}), ...(content.length ? { content } : {}) };
  }
  const doc = read(value, '', 0);
  return doc ? doc as WritingRichDocument : null;
}

export function plainWritingDocument(text: string): WritingRichDocument {
  return { type: 'doc', content: text.split('\n\n').map(paragraph => ({ type: 'paragraph', content: paragraph.split('\n').flatMap((line, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : [])]) })) };
}

export function writingRichBlocks(doc: WritingRichDocument): WritingRenderBlock[] {
  const blocks: WritingRenderBlock[] = []; let position = 0, tableId = 0;
  function walk(node: WritingRichNode, indent = 0, quote = false, prefix?: string, table?: WritingRenderBlock['table']) {
    if (node.type === 'paragraph' || node.type === 'heading') {
      const runs = (node.content || []).map(n => ({ text: n.type === 'hardBreak' ? '\n' : n.text || '', ...(n.marks?.length ? { marks: n.marks.map(m => m.type) } : {}) }));
      const length = runs.reduce((sum, run) => sum + run.text.length, 0);
      if (blocks.length) position += 2;
      blocks.push({ kind: node.type, ...(node.attrs?.level ? { level: node.attrs.level } : {}), ...(prefix ? { prefix } : {}), ...(table ? { table } : {}), indent, quote, start: position, end: position + length, runs }); position += length;
    } else if (node.type === 'table') {
      const id = tableId++;
      (node.content || []).forEach((row, rowIndex) => (row.content || []).forEach((cell, column) => (cell.content || []).forEach(paragraph => walk(paragraph, indent, quote, undefined, { id, row: rowIndex, column, header: cell.type === 'tableHeader' }))));
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      (node.content || []).forEach((item, index) => (item.content || []).forEach((child, childIndex) => walk(child, indent + 1, quote, childIndex === 0 ? node.type === 'bulletList' ? '• ' : `${(node.attrs?.start || 1) + index}. ` : undefined)));
    } else (node.content || []).forEach(child => walk(child, indent, quote || node.type === 'blockquote', prefix));
  }
  walk(doc); return blocks;
}
export function writingRichText(doc: WritingRichDocument) { return writingRichBlocks(doc).map(b => b.runs.map(r => r.text).join('')).join('\n\n'); }

/** Group a formatted copy for display/export without changing citation offsets. */
export function groupWritingRenderBlocks(blocks: WritingRenderBlock[]): (WritingRenderBlock | WritingRenderTable)[] {
  const items: (WritingRenderBlock | WritingRenderTable)[] = [];
  let active: WritingRenderTable | undefined, activeId: number | undefined;
  for (const block of blocks) {
    if (!block.table) { active = undefined; activeId = undefined; items.push(block); continue; }
    const { id, row, column, header } = block.table;
    if (!active || activeId !== id) { active = { kind: 'table', rows: [] }; activeId = id; items.push(active); }
    const targetRow = active.rows[row] ||= { cells: [] };
    const cell = targetRow.cells[column] ||= { header, blocks: [] };
    cell.blocks.push(block);
  }
  return items;
}

/** Preserve old content and its exact offsets when an entry/extraction appends. */
export function appendWritingRichText(doc: WritingRichDocument | undefined, current: string, addition: string): WritingRichDocument | undefined {
  if (!doc) return undefined;
  if (!current) return plainWritingDocument(addition);
  return { type: 'doc', content: [...doc.content, ...plainWritingDocument(addition).content] };
}

/** ProseMirror includes container tokens in positions; citations deliberately do
 * not. Map a selection through leaf paragraphs, including blank paragraphs. */
export function writingSelectionOffsets(doc: { descendants: (fn: (node: { isTextblock: boolean; nodeSize: number; textContent: string; content: { size: number }; descendants: (fn: (node: { isText?: boolean; type: { name: string }; text?: string }, pos: number) => void) => void }, pos: number) => boolean | void) => void }, from: number, to: number): { start: number; end: number } | null {
  let plain = 0, count = 0; let start: number | null = null, end: number | null = null;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    if (count++) plain += 2;
    const inner = pos + 1;
    const offset = (point: number) => Math.max(0, Math.min(node.content.size, point - inner));
    if (from >= inner && from <= inner + node.content.size) start = plain + offset(from);
    if (to >= inner && to <= inner + node.content.size) end = plain + offset(to);
    plain += node.content.size;
    return false;
  });
  return start !== null && end !== null && end > start ? { start, end } : null;
}

export function sliceWritingRuns(block: WritingRenderBlock, start: number, end: number): WritingTextRun[] {
  const runs: WritingTextRun[] = []; let cursor = block.start;
  for (const run of block.runs) {
    const from = Math.max(start, cursor), to = Math.min(end, cursor + run.text.length);
    if (to > from) runs.push({ ...run, text: run.text.slice(from - cursor, to - cursor) });
    cursor += run.text.length;
  }
  return runs;
}
