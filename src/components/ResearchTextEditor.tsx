'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Extension, type Editor } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Undo2, Redo2, Table2 } from 'lucide-react';
import { plainWritingDocument, readWritingRichDocument, writingRichText, writingSelectionOffsets, WRITING_TABLE_MAX_COLUMNS, WRITING_TABLE_MAX_ROWS, type WritingRichDocument } from '@/lib/writing-rich-text';
import { writingTableExtensions } from '@/lib/writing-table-extensions';
import styles from './ResearchTextEditor.module.css';

const MAX_TEXT = 120000;
function toolbarState(editor: Editor | null) {
  if (!editor) return null;
  const selection = editor.state.selection.$from;
  let rows = 0, columns = 0;
  for (let depth = selection.depth; depth > 0; depth--) {
    const node = selection.node(depth);
    if (node.type.name === 'table') { rows = node.childCount; columns = node.firstChild?.childCount || 0; break; }
  }
  return {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'), strike: editor.isActive('strike'),
    bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), quote: editor.isActive('blockquote'),
    heading: [1, 2, 3].find(level => editor.isActive('heading', { level })) || 0,
    undo: editor.can().undo(), redo: editor.can().redo(), table: editor.isActive('table'), rows, columns,
  };
}
const DocumentLimit = Extension.create({
  name: 'wahaDocumentLimit',
  addOptions() { return { onReject: () => {} }; },
  addProseMirrorPlugins() { const onReject = this.options.onReject; return [new Plugin({ filterTransaction(transaction) {
    if (!transaction.docChanged) return true;
    const rich = readWritingRichDocument(transaction.doc.toJSON());
    const valid = Boolean(rich && writingRichText(rich).length <= MAX_TEXT);
    if (!valid) onReject();
    return valid;
  } })]; },
});
const COPY = {
  ar: { format: 'تنسيق المسودة', paragraph: 'نص عادي', h1: 'عنوان رئيسي', h2: 'عنوان فرعي', h3: 'عنوان تفصيلي', bold: 'عريض', italic: 'مائل', underline: 'تسطير', strike: 'شطب', bullet: 'قائمة نقطية', ordered: 'قائمة مرقمة', quote: 'اقتباس', undo: 'تراجع', redo: 'إعادة', loading: 'جارٍ فتح المحرر…', length: 'حرف', limit: 'تعذر إضافة هذا التعديل. جرّب نصًا أقصر أو جدولًا أصغر بخلايا غير مدمجة؛ محتواك السابق باقٍ.', table: 'إدراج جدول', tableTools: 'تعديل الجدول', rowBefore: 'صف قبل', rowAfter: 'صف بعد', columnBefore: 'عمود قبل', columnAfter: 'عمود بعد', deleteRow: 'حذف الصف', deleteColumn: 'حذف العمود', header: 'صف العناوين', deleteTable: 'حذف الجدول', continue: 'متابعة الكتابة بعد الجدول', tableHelp: 'حدّد خلية لتعديل صفها أو عمودها. استخدم Tab للتنقل بين الخلايا. يسع الجدول ٨ أعمدة و٢٠٠ صف.' },
  en: { format: 'Draft formatting', paragraph: 'Normal text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough', bullet: 'Bullet list', ordered: 'Numbered list', quote: 'Block quote', undo: 'Undo', redo: 'Redo', loading: 'Opening the editor…', length: 'characters', limit: 'This change could not be added. Try shorter text or a smaller table with unmerged cells; your previous content remains.', table: 'Insert table', tableTools: 'Table editing', rowBefore: 'Row before', rowAfter: 'Row after', columnBefore: 'Column before', columnAfter: 'Column after', deleteRow: 'Delete row', deleteColumn: 'Delete column', header: 'Header row', deleteTable: 'Delete table', continue: 'Continue after table', tableHelp: 'Select a cell to edit its row or column. Use Tab to move between cells. Each table supports 8 columns and 200 rows.' },
} as const;

export default function ResearchTextEditor({ id, label, text, richText, language, disabled, onChange, onSelection }: {
  id: string; label: string; text: string; richText?: WritingRichDocument; language: 'ar' | 'en'; disabled: boolean;
  onChange: (text: string, richText: WritingRichDocument) => void;
  onSelection: (value: { start: number; end: number; text: string } | null) => void;
}) {
  const t = COPY[language];
  const callbacks = useRef({ onChange, onSelection });
  useEffect(() => { callbacks.current = { onChange, onSelection }; }, [onChange, onSelection]);
  const [atLimit, setAtLimit] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, horizontalRule: false, link: false, trailingNode: false }), ...writingTableExtensions, DocumentLimit.configure({ onReject: () => setAtLimit(true) })],
    content: richText || plainWritingDocument(text), immediatelyRender: false,
    editorProps: { attributes: { id, role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', dir: 'auto', lang: language, class: styles.content } },
    onUpdate({ editor }) {
      const rich = readWritingRichDocument(editor.getJSON()); if (!rich) return;
      const next = writingRichText(rich); setAtLimit(next.length >= MAX_TEXT);
      callbacks.current.onChange(next, rich);
    },
    onSelectionUpdate({ editor }) {
      if (!editor.isFocused) return;
      const range = writingSelectionOffsets(editor.state.doc, editor.state.selection.from, editor.state.selection.to);
      const rich = readWritingRichDocument(editor.getJSON());
      callbacks.current.onSelection(range && rich ? { ...range, text: writingRichText(rich).slice(range.start, range.end) } : null);
    },
  });
  // The first deferred editor instance may precede the hook's first transaction
  // snapshot. Read its real toolbar state without emitting a content update.
  const state = useEditorState({ editor, selector: ({ editor }) => toolbarState(editor) }) || toolbarState(editor);
  // Locking the editor during a request changes permissions, not its content.
  // Tiptap emits an update by default, which would recreate an unsaved draft
  // immediately after a successful save or overwrite a restored version.
  useEffect(() => { editor?.setEditable(!disabled, false); }, [disabled, editor]);
  useEffect(() => {
    if (!editor) return;
    const next = richText || plainWritingDocument(text);
    const current = readWritingRichDocument(editor.getJSON());
    if (JSON.stringify(current) !== JSON.stringify(next)) editor.chain().command(({ tr }) => {
      // Loading a saved version is a new editing baseline. Do not merge the
      // first keystroke with replacement of the whole restored document.
      closeHistory(tr).setMeta('addToHistory', false); return true;
    }).setContent(next, { emitUpdate: false }).run();
  }, [editor, richText, text]);
  useEffect(() => { editor?.setOptions({ editorProps: { attributes: { id, role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', dir: 'auto', lang: language, class: styles.content } } }); }, [editor, id, label, language]);

  if (!editor || !state) return <p role="status" className="mt-3 text-sm leading-7">{t.loading}</p>;
  const actions = [
    { key: 'bold', label: t.bold, Icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: t.italic, Icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'underline', label: t.underline, Icon: Underline, active: state.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { key: 'strike', label: t.strike, Icon: Strikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { key: 'bullet', label: t.bullet, Icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'ordered', label: t.ordered, Icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: 'quote', label: t.quote, Icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ];
  return <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
    <div role="group" aria-label={t.format} className="flex flex-wrap items-center gap-1 border-b border-line bg-slate-50 p-2">
      <select aria-label={t.format} disabled={disabled} value={state.heading} onChange={e => { const level = Number(e.target.value); if (level) editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run(); else editor.chain().focus().setParagraph().run(); }} className="min-h-10 max-w-full rounded-lg border border-line bg-white px-2 text-sm">
        {[t.paragraph, t.h1, t.h2, t.h3].map((value, index) => <option key={index} value={index}>{value}</option>)}
      </select>
      {actions.map(({ key, label, Icon, active, run }) => <button type="button" key={key} title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={run} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-700 hover:bg-white aria-pressed:bg-primary-tint aria-pressed:text-primary-dark disabled:opacity-40"><Icon size={18} aria-hidden="true" /></button>)}
      <button type="button" aria-label={t.table} disabled={disabled || state.table} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-white disabled:opacity-40"><Table2 size={18} aria-hidden="true" />{t.table}</button>
      <button type="button" aria-label={t.undo} title={t.undo} disabled={disabled || !state.undo} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().undo().run()} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white disabled:opacity-40"><Undo2 size={18} aria-hidden="true" /></button>
      <button type="button" aria-label={t.redo} title={t.redo} disabled={disabled || !state.redo} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().redo().run()} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white disabled:opacity-40"><Redo2 size={18} aria-hidden="true" /></button>
    </div>
    {state.table && <div role="group" aria-label={t.tableTools} className="border-b border-line bg-primary-tint/40 p-2">
      <div className="flex flex-wrap gap-1">{[
        { label: t.rowBefore, blocked: state.rows >= WRITING_TABLE_MAX_ROWS, run: () => editor.chain().focus().addRowBefore().run() },
        { label: t.rowAfter, blocked: state.rows >= WRITING_TABLE_MAX_ROWS, run: () => editor.chain().focus().addRowAfter().run() },
        { label: t.columnBefore, blocked: state.columns >= WRITING_TABLE_MAX_COLUMNS, run: () => editor.chain().focus().addColumnBefore().run() },
        { label: t.columnAfter, blocked: state.columns >= WRITING_TABLE_MAX_COLUMNS, run: () => editor.chain().focus().addColumnAfter().run() },
        { label: t.header, blocked: false, run: () => editor.chain().focus().toggleHeaderRow().run() },
        { label: t.deleteRow, blocked: false, run: () => editor.chain().focus().deleteRow().run() },
        { label: t.deleteColumn, blocked: false, run: () => editor.chain().focus().deleteColumn().run() },
        { label: t.continue, blocked: false, run: () => editor.chain().focus().command(({ tr, dispatch }) => {
          const selection = tr.selection.$from;
          for (let depth = selection.depth; depth > 0; depth--) if (selection.node(depth).type.name === 'table') {
            if (dispatch) { const after = selection.after(depth); tr.insert(after, tr.doc.type.schema.nodes.paragraph.create()); tr.setSelection(TextSelection.create(tr.doc, after + 1)); }
            return true;
          }
          return false;
        }).run() },
        { label: t.deleteTable, blocked: false, run: () => editor.chain().focus().deleteTable().run() },
      ].map(action => <button key={action.label} type="button" disabled={disabled || action.blocked} onMouseDown={e => e.preventDefault()} onClick={action.run} className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm text-slate-700 hover:border-primary disabled:opacity-40">{action.label}</button>)}</div>
      <p className="mt-2 px-1 text-xs leading-6 text-slate-600">{t.tableHelp}</p>
    </div>}
    <EditorContent editor={editor} />
    <p className="border-t border-line px-4 py-2 text-xs leading-6 text-slate-500">{text.length.toLocaleString(language)} / {MAX_TEXT.toLocaleString(language)} {t.length}</p>
    {atLimit && <p role="status" className="px-4 pb-3 text-sm leading-7">{t.limit}</p>}
  </div>;
}
