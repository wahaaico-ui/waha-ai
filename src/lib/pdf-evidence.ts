import { isUuid } from '@/lib/research-evidence';

export const PDF_FILE_TYPE = 'pdf-original:v1';
export const PDF_BUCKET = 'waha-research-pdfs';
export const PDF_MAX_BYTES = 4 * 1024 * 1024;
export const PDF_MAX_PAGES = 50;
export type PdfPageRange = { number: number; start: number; end: number };
export type PdfFileInfo = { fileName: string; fileHash: string; textHash: string; bytes: number; totalPages: number; pages: PdfPageRange[] };
export type PdfFileRecord = PdfFileInfo & { sourceId: string; projectId: string; ownerId: string };

export function canonicalPdfPages(pages: { num: number; text: string }[], total: number) {
  if (!Number.isInteger(total) || total < 1 || total > PDF_MAX_PAGES || pages.length !== total) throw new Error('incomplete_pages');
  let text = ''; const ranges: PdfPageRange[] = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]; if (page.num !== index + 1 || typeof page.text !== 'string') throw new Error('invalid_page_sequence');
    const part = page.text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    if (index) text += '\n\n'; const start = text.length; text += part;
    ranges.push({ number: page.num, start, end: text.length });
    if (text.length > 1_000_000) throw new Error('text_too_large');
  }
  return { text, pages: ranges };
}
export function readPdfFileRecord(value: unknown): PdfFileRecord | null {
  try {
    const r = typeof value === 'string' ? JSON.parse(value) : value;
    if (!r || !isUuid(r.sourceId) || !isUuid(r.projectId) || !isUuid(r.ownerId)
      || typeof r.fileName !== 'string' || !r.fileName.trim() || r.fileName.length > 255 || /[\u0000-\u001f\u007f]/.test(r.fileName)
      || !/^[a-f0-9]{64}$/.test(r.fileHash) || !/^[a-f0-9]{64}$/.test(r.textHash)
      || !Number.isSafeInteger(r.bytes) || r.bytes < 1 || r.bytes > PDF_MAX_BYTES
      || !Number.isInteger(r.totalPages) || r.totalPages < 1 || r.totalPages > PDF_MAX_PAGES || !Array.isArray(r.pages) || r.pages.length !== r.totalPages) return null;
    let end = -2; const pages: PdfPageRange[] = [];
    for (let index = 0; index < r.pages.length; index++) {
      const page = r.pages[index];
      if (!page || page.number !== index + 1 || !Number.isSafeInteger(page.start) || !Number.isSafeInteger(page.end)
        || page.start !== end + 2 || page.end < page.start || page.end > 1_000_000) return null;
      pages.push({ number: page.number, start: page.start, end: page.end }); end = page.end;
    }
    return { sourceId: r.sourceId, projectId: r.projectId, ownerId: r.ownerId, fileName: r.fileName, fileHash: r.fileHash, textHash: r.textHash, bytes: r.bytes, totalPages: r.totalPages, pages };
  } catch { return null; }
}
export function pdfQuotePages(info: PdfFileInfo, start: number, end: number) {
  const matches = info.pages.filter(page => page.start < end && page.end > start);
  return matches.length ? { first: matches[0].number, last: matches[matches.length - 1].number, fileHash: info.fileHash } : null;
}
/** Map compatible glyphs and whitespace to their original UTF-16 boundaries.
 * Ambiguous repeated matches are never promoted to a precise page highlight. */
export function normalizedPdfText(value: string) {
  let text = ''; const positions: { start: number; end: number }[] = []; let offset = 0;
  for (const character of value) {
    const normalized = character.normalize('NFKC');
    for (const c of normalized) {
      if (/[\s\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(c)) continue;
      text += c; for (let i = 0; i < c.length; i++) positions.push({ start: offset, end: offset + character.length });
    }
    offset += character.length;
  }
  return { text, positions };
}
export function uniquePdfTextMatch(text: string, quote: string) {
  const haystack = normalizedPdfText(text), needle = normalizedPdfText(quote).text;
  if (!needle) return null;
  const index = haystack.text.indexOf(needle);
  if (index < 0 || haystack.text.indexOf(needle, index + 1) >= 0) return null;
  return { start: haystack.positions[index].start, end: haystack.positions[index + needle.length - 1].end };
}
