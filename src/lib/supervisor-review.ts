import { translateUiText, type UiLanguage } from '@/lib/i18n/ui-text';
import { inferDocumentDirection } from '@/lib/document-direction';
export type ReviewNote = { id: string; comment: string; location: string; response: string; status: 'open' | 'addressed' | 'deferred' };
export type SupervisorReview = { originalText: string; revisedText: string; notes: ReviewNote[] };
export const SUPERVISOR_DOCUMENT_TYPE = 'journey:supervisor_review';

/** Text is stored as text and rendered by React/escaped exporters, never as HTML. */
export function parseSupervisorReview(value: unknown): SupervisorReview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const clean = (text: unknown, max: number) => typeof text === 'string' && text.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) ? text.trim() : null;
  const originalText = clean(body.originalText, 12_000); const revisedText = clean(body.revisedText, 12_000);
  if (!originalText || originalText.length < 20 || !revisedText || revisedText.length < 20 || !Array.isArray(body.notes) || body.notes.length > 100) return null;
  const notes: ReviewNote[] = [];
  const ids = new Set<string>();
  for (const item of body.notes) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const note = item as Record<string, unknown>;
    const comment = clean(note.comment, 2000); const location = clean(note.location, 500); const response = clean(note.response, 2000);
    if (typeof note.id !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(note.id) || ids.has(note.id) || !comment || location === null || response === null || !['open', 'addressed', 'deferred'].includes(String(note.status))) return null;
    if (note.status !== 'open' && !response) return null;
    ids.add(note.id); notes.push({ id: note.id, comment, location, response, status: note.status as ReviewNote['status'] });
  }
  if (notes.some((note) => note.status === 'addressed') && originalText === revisedText) return null;
  return { originalText, revisedText, notes };
}

export function readSupervisorReview(content: unknown): SupervisorReview | null {
  try { return parseSupervisorReview(typeof content === 'string' ? JSON.parse(content) : content); } catch { return null; }
}

export function supervisorExportModel(review: SupervisorReview, language: UiLanguage = 'ar') {
  const ui = (message: string) => translateUiText(message, language);
  const labels = { open: 'مفتوحة', addressed: 'عدّلها الباحث', deferred: 'مؤجلة مع مبرر' };
  return { language, documentDirection: inferDocumentDirection(review.revisedText), title: ui('مراجعة ملاحظات المشرف'), notice: ui('تعديلات وقرارات سجلها الباحث؛ لا تعني موافقة المشرف أو اعتماد البحث.'), sections: [
    { title: ui('النص المعدّل'), paragraphs: [review.revisedText] },
    { title: ui('النص قبل المراجعة'), paragraphs: [review.originalText] },
    ...review.notes.map((note, index) => ({ title: translateUiText('الملاحظة {0} — {1}', language, [index + 1, ui(labels[note.status])]), paragraphs: [`${ui('الملاحظة:')} ${note.comment}`, `${ui('موضعها:')} ${note.location || ui('لم يحدد')}`, `${ui('رد الباحث:')} ${note.response || ui('لم يسجل بعد')}`] })),
  ] };
}
