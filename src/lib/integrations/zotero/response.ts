import { ZoteroReadError } from './client';

export const zoteroHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
export const zoteroJson = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...zoteroHeaders, ...extra } });

export function zoteroReadFailure(error: unknown) {
  if (error instanceof ZoteroReadError) {
    const message = error.code === 'library_changed' ? 'تغيرت مكتبة Zotero أثناء القراءة. أعد المحاولة بعد انتهاء تعديلها.'
      : error.code === 'rate_limited' ? 'طلب Zotero الانتظار قليلًا قبل المتابعة. أعد المحاولة لاحقًا.'
        : 'تعذر قراءة مكتبة Zotero كاملة. أعد المحاولة؛ لم تبدأ عملية الحفظ.';
    return zoteroJson({ error: message, code: error.code, complete: false }, error.status,
      error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
  }
  return zoteroJson({ error: 'تعذر إكمال الاتصال بـZotero. أعد المحاولة.', complete: false }, 503);
}
