import { groupWritingRenderBlocks, type WritingRenderBlock } from './writing-rich-text';

function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~>-])/g, '\\$1');
}

/** Content is escaped; only the table separators and our fixed line breaks are markup. */
export function writingBlocksMarkdown(blocks: WritingRenderBlock[]): string[] {
  return groupWritingRenderBlocks(blocks).map(item => {
    if (item.kind !== 'table') return escape((item.prefix || '') + item.runs.map(run => run.text).join(''));
    const rows = item.rows.map(row => `| ${row.cells.map(cell => cell.blocks.map(block => escape(block.runs.map(run => run.text).join('')).replace(/\r?\n/g, '<br>')).join('<br><br>')).join(' | ')} |`);
    const hasHeader = item.rows[0].cells.every(cell => cell.header);
    const columns = item.rows[0].cells.length;
    const header = hasHeader ? rows.shift()! : `| ${Array(columns).fill('').join(' | ')} |`;
    return [header, `| ${Array(columns).fill('---').join(' | ')} |`, ...rows].join('\n');
  });
}
