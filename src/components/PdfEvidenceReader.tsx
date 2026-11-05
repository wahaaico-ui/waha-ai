'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PDFDocumentProxy, TextLayer as TextLayerType } from 'pdfjs-dist';
import { pdfQuotePages, uniquePdfTextMatch, type PdfFileInfo } from '@/lib/pdf-evidence';
import styles from './PdfEvidenceReader.module.css';

const ASSETS = '/pdfjs/5.4.296/';
// Load the versioned browser ESM directly; bundling PDF.js inside Next can
// rewrite its module exports. Both API and worker stay on our own origin.
const loadPdfJs = () => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${ASSETS}pdf.min.mjs`) as Promise<typeof import('pdfjs-dist')>;
const COPY = {
  ar: { title: 'الملف الأصلي', loading: 'جارٍ فتح الصفحة…', unavailable: 'تعذر عرض الملف الآن. أعد المحاولة أو نزّل نسختك الأصلية.', retry: 'إعادة المحاولة', previous: 'الصفحة السابقة', next: 'الصفحة التالية', page: 'صفحة الملف', of: 'من', download: 'تنزيل الملف الأصلي', found: 'المقطع محدد داخل الصفحة.', noMatch: 'الصفحة معروفة؛ تعذر تحديد المقطع بدقة في عرضها. راجع النص الأصلي أدناه.', select: 'حدد مقطعًا داخل الصفحة لاستخدامه دليلًا.', ambiguous: 'تعذر مطابقة التحديد بموضع واحد. اختر مقطعًا أوضح أو استخدم النص المستخرج.', filePages: 'هذه أرقام صفحات الملف؛ قد تختلف عن الترقيم المطبوع داخل الدراسة.' },
  en: { title: 'Original file', loading: 'Opening the page…', unavailable: 'The file could not be displayed. Retry or download your original.', retry: 'Retry', previous: 'Previous page', next: 'Next page', page: 'File page', of: 'of', download: 'Download original file', found: 'The passage is highlighted on the page.', noMatch: 'The page is known, but an exact highlight is unavailable. Review the original text below.', select: 'Select a passage on the page to use as evidence.', ambiguous: 'The selection could not be matched uniquely. Choose a clearer passage or use the extracted text.', filePages: 'These are file page numbers; printed page labels may differ.' },
} as const;
type Quote = { start: number; end: number; text: string };
type Box = { left: number; top: number; width: number; height: number };
type ReaderProps = {
  projectId: string; sourceId: string; sourceText: string; info: PdfFileInfo; quote: Quote | null; language: 'ar' | 'en'; onSelect: (quote: Quote) => void;
};
type PageRender = {
  pdf: PDFDocumentProxy; page: number; width: number; quote: Quote | null; sourceText: string; info: PdfFileInfo;
  boxes: Box[]; notice: 'found' | 'noMatch' | ''; error: boolean;
};

function textRange(container: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT); const range = document.createRange();
  let offset = 0, hasStart = false, node: Node | null;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length || 0;
    if (!hasStart && start >= offset && start < offset + length) { range.setStart(node, start - offset); hasStart = true; }
    if (hasStart && end > offset && end <= offset + length) { range.setEnd(node, end - offset); return range; }
    offset += length;
  }
  return null;
}

export default function PdfEvidenceReader(props: ReaderProps) {
  const [attempt, setAttempt] = useState(0);
  // A new file or retry owns a fresh loading/render lifecycle. An old worker
  // cannot publish page state into the replacement reader.
  return <ReaderSession key={`${props.projectId}:${props.sourceId}:${props.info.fileHash}:${attempt}`} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function ReaderSession({ projectId, sourceId, sourceText, info, quote, language, onSelect, onRetry }: ReaderProps & { onRetry: () => void }) {
  const t = COPY[language];
  const url = `/api/projects/${encodeURIComponent(projectId)}/pdfs/${encodeURIComponent(sourceId)}`;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null), [loadError, setLoadError] = useState(false);
  const [navigation, setNavigation] = useState<{ quote: Quote | null; page: number } | null>(null);
  const requestedPage = quote ? pdfQuotePages(info, quote.start, quote.end)?.first || 1 : 1;
  const page = navigation?.quote === quote ? navigation.page : requestedPage;
  const [width, setWidth] = useState(280), [paint, setPaint] = useState<PageRender | null>(null);
  const [ambiguous, setAmbiguous] = useState<{ quote: Quote | null; page: number } | null>(null);
  const currentPaint = paint?.pdf === pdf && paint?.page === page && paint?.width === width && paint?.quote === quote && paint?.sourceText === sourceText && paint?.info === info ? paint : null;
  const error = loadError || currentPaint?.error === true;
  const busy = !error && (!pdf || !currentPaint);
  const boxes = currentPaint?.boxes || [];
  const notice = ambiguous?.quote === quote && ambiguous?.page === page ? 'ambiguous' : currentPaint?.notice || '';
  const navigate = (next: number) => { setNavigation({ quote, page: next }); setAmbiguous(null); };
  const frame = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), layer = useRef<HTMLDivElement>(null);
  const callbacks = useRef(onSelect); useEffect(() => { callbacks.current = onSelect; }, [onSelect]);
  useEffect(() => { const element = frame.current; if (!element) return; const observer = new ResizeObserver(entries => setWidth(Math.max(200, Math.floor(entries[0].contentRect.width)))); observer.observe(element); return () => observer.disconnect(); }, []);
  useEffect(() => {
    let active = true; const controller = new AbortController(); let destroy: (() => Promise<void>) | undefined;
    (async () => {
      const [pdfJs, response] = await Promise.all([loadPdfJs(), fetch(url, { cache: 'no-store', signal: controller.signal })]);
      if (!response.ok) throw new Error('file_unavailable');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== info.bytes) throw new Error('file_size_changed');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== info.fileHash) throw new Error('file_hash_changed');
      if (!active) return;
      pdfJs.GlobalWorkerOptions.workerSrc = `${ASSETS}pdf.worker.min.mjs`;
      const task = pdfJs.getDocument({ data: bytes, isEvalSupported: false, enableXfa: false, useSystemFonts: true, cMapUrl: `${ASSETS}cmaps/`, cMapPacked: true, standardFontDataUrl: `${ASSETS}standard_fonts/`, wasmUrl: `${ASSETS}wasm/` });
      destroy = () => task.destroy(); const document = await task.promise;
      if (document.numPages !== info.totalPages) throw new Error('page_count_changed');
      if (active) setPdf(document); else await task.destroy();
    })().catch(() => { if (active) setLoadError(true); });
    return () => { active = false; controller.abort(); void destroy?.().catch(() => {}); };
  }, [url, info.bytes, info.fileHash, info.totalPages]);
  useEffect(() => {
    if (!pdf || !canvas.current || !layer.current) return;
    let active = true; let cancel: (() => void) | undefined; let textLayer: TextLayerType | undefined;
    layer.current.replaceChildren();
    (async () => {
      const documentPage = await pdf.getPage(page), pdfJs = await loadPdfJs();
      const base = documentPage.getViewport({ scale: 1 }); const viewport = documentPage.getViewport({ scale: Math.min(2, width / base.width) });
      if (!Number.isFinite(viewport.height) || viewport.height > 10000 || viewport.width < 1 || viewport.height < 1) throw new Error('unsupported_page_dimensions');
      const target = canvas.current, text = layer.current; if (!active || !target || !text) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6_000_000 / (viewport.width * viewport.height)));
      target.width = Math.ceil(viewport.width * ratio); target.height = Math.ceil(viewport.height * ratio);
      target.style.width = `${viewport.width}px`; target.style.height = `${viewport.height}px`;
      text.style.setProperty('--total-scale-factor', String(viewport.scale)); text.style.width = `${viewport.width}px`; text.style.height = `${viewport.height}px`;
      const task = documentPage.render({ canvas: target, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] }); cancel = () => task.cancel();
      await task.promise; if (!active) return;
      textLayer = new pdfJs.TextLayer({ textContentSource: await documentPage.getTextContent(), container: text, viewport });
      await textLayer.render(); if (!active) return;
      // Publish only the completed external render and its corresponding
      // evidence overlay; a changed page/quote derives a pending state above.
      const boxes: Box[] = []; let notice: PageRender['notice'] = '';
      if (quote) {
        const range = info.pages[page - 1], start = Math.max(quote.start, range.start), end = Math.min(quote.end, range.end);
        if (end > start) {
          const match = uniquePdfTextMatch(text.textContent || '', sourceText.slice(start, end));
          const dom = match && textRange(text, match.start, match.end);
          if (dom) {
            const origin = text.getBoundingClientRect();
            boxes.push(...[...dom.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => ({ left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height })));
            notice = 'found';
          } else notice = 'noMatch';
        }
      }
      setPaint({ pdf, page, width, quote, sourceText, info, boxes, notice, error: false });
    })().catch(() => { if (active) setPaint({ pdf, page, width, quote, sourceText, info, boxes: [], notice: '', error: true }); });
    return () => { active = false; cancel?.(); textLayer?.cancel(); };
  }, [pdf, page, width, quote, sourceText, info]);
  const select = () => {
    const selection = window.getSelection(); if (busy || error || !selection || selection.isCollapsed || !layer.current?.contains(selection.anchorNode) || !layer.current.contains(selection.focusNode)) return;
    const text = selection.toString(); if (!text.trim()) return;
    const range = info.pages[page - 1], match = uniquePdfTextMatch(sourceText.slice(range.start, range.end), text);
    if (!match || match.end - match.start > 4000) { setAmbiguous({ quote, page }); return; }
    const start = range.start + match.start, end = range.start + match.end;
    setAmbiguous(null); callbacks.current({ start, end, text: sourceText.slice(start, end) });
  };
  return <section className="mt-4 min-w-0 rounded-xl border border-line bg-slate-50 p-3" aria-label={t.title}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-base font-bold">{t.title}</h4><a href={url} download={info.fileName} className="text-sm font-bold text-primary-dark underline">{t.download}</a></div>
    <p className="mt-2 break-words text-sm leading-7">{info.fileName}</p>
    <div className="my-3 flex flex-wrap items-center justify-center gap-2">
      <button type="button" aria-label={t.previous} disabled={page <= 1 || busy} onClick={() => navigate(page - 1)} className="min-h-10 rounded-lg border bg-white px-3 text-sm disabled:opacity-40">{t.previous}</button>
      <label className="flex items-center gap-2 text-sm">{t.page}<select value={page} disabled={!pdf || busy} onChange={e => navigate(Number(e.target.value))} className="min-h-10 rounded-lg border bg-white px-2">{info.pages.map(p => <option key={p.number} value={p.number}>{p.number}</option>)}</select>{t.of} {info.totalPages}</label>
      <button type="button" aria-label={t.next} disabled={page >= info.totalPages || busy} onClick={() => navigate(page + 1)} className="min-h-10 rounded-lg border bg-white px-3 text-sm disabled:opacity-40">{t.next}</button>
    </div>
    {busy && <p role="status" className="my-3 text-sm leading-7">{t.loading}</p>}
    {error && <div role="alert" className="my-3 text-sm leading-7"><p>{t.unavailable}</p><button type="button" onClick={onRetry} className="mt-2 rounded-lg border bg-white px-3 py-2 font-bold">{t.retry}</button></div>}
    <div ref={frame} className="min-w-0 overflow-auto" dir="ltr"><div className={styles.page}>
      <canvas ref={canvas} aria-label={`${t.page} ${page}`} />
      <div ref={layer} className={styles.textLayer} onMouseUp={select} onTouchEnd={select} onKeyUp={select} />
      {boxes.map((box, index) => <div key={index} aria-hidden="true" className={styles.highlight} style={box as CSSProperties} />)}
    </div></div>
    <p role="status" className="mt-3 text-sm leading-7 text-slate-700">{notice ? t[notice] : t.select}</p><p className="mt-2 text-xs leading-6 text-slate-500">{t.filePages}</p>
  </section>;
}
