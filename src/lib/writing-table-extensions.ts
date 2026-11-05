import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';

// Keep cell content portable to native exports; no nested tables or HTML attrs.
export const writingTableExtensions = [
  Table.configure({ resizable: false, renderWrapper: true, allowTableNodeSelection: true, cellMinWidth: 144 }),
  TableRow,
  TableCell.extend({ content: 'paragraph+' }),
  TableHeader.extend({ content: 'paragraph+' }),
];
