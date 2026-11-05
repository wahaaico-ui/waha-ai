import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { isUuid } from '@/lib/research-evidence';
import { legacyGuideFileName, normalizeUniversityPolicy, UNIVERSITY_GUIDE_MAX_BYTES, UNIVERSITY_POLICY_MAX_CHARS } from '@/lib/university-policy';
import { extractUniversityGuide } from '@/lib/university-guide-server';
import { readSavedGuide, saveGuideEnvelope } from '@/lib/guide-workflow';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
class BodyLimitError extends Error {}

/** Enforce actual streamed bytes, including when Content-Length is absent or forged. */
async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit || !request.body) throw new BodyLimitError();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > limit) { await reader.cancel(); throw new BodyLimitError(); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedUser(); if (!access) return json({ error: 'سجّل الدخول لمتابعة مشروعك.' }, 401);
    const projectId = new URL(request.url).searchParams.get('projectId');
    if (!isUuid(projectId)) return json({ error: 'تعذر العثور على المشروع.' }, 404);
    const { data, error } = await access.supabase.from('projects').select('id, university_policy').eq('id', projectId).eq('user_id', access.user.id).maybeSingle();
    if (error) return json({ error: 'تعذر استرجاع تعليمات الجامعة. أعد المحاولة.' }, 503);
    if (!data) return json({ error: 'تعذر العثور على المشروع.' }, 404);
    const guide = readSavedGuide(data.university_policy);
    return json({ projectId, universityPolicy: guide.text || null,
      ...(data.university_policy?.startsWith('WAHA_GUIDE_V1:') ? { storedPolicy: data.university_policy, rules: guide.rules } : {}),
      legacyFileName: legacyGuideFileName(data.university_policy) });
  } catch { return json({ error: 'تعذر استرجاع تعليمات الجامعة. أعد المحاولة.' }, 503); }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAuthenticatedUser(); if (!access) return json({ error: 'سجّل الدخول لمتابعة مشروعك.' }, 401);
    let body: unknown;
    try { body = JSON.parse((await readBody(request, UNIVERSITY_POLICY_MAX_CHARS * 4 + 16_384)).toString('utf8')); }
    catch (error) { return json({ error: 'تعذر قراءة التعليمات. راجع النص وأعد المحاولة.' }, error instanceof BodyLimitError ? 413 : 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'راجع نص تعليمات الجامعة قبل الحفظ.' }, 422);
    const { projectId, universityPolicy, expectedPolicy, rules } = body as Record<string, unknown>;
    if (!isUuid(projectId)) return json({ error: 'تعذر العثور على المشروع.' }, 404);
    const policy = normalizeUniversityPolicy(universityPolicy);
    if (!policy || !(expectedPolicy === null || typeof expectedPolicy === 'string' && expectedPolicy.length <= 105_000)) {
      return json({ error: 'أضف نص التعليمات الفعلي وراجعه قبل الحفظ.' }, 422);
    }
    const stored = rules === undefined ? policy : Array.isArray(rules) ? saveGuideEnvelope(policy, rules) : null;
    if (!stored) return json({ error: 'راجع القواعد ومصدرها قبل الحفظ.' }, 422);
    // Owner and previous value are checked in the write itself, not only in a prior read.
    let update = access.supabase.from('projects').update({ university_policy: stored }).eq('id', projectId).eq('user_id', access.user.id);
    update = expectedPolicy === null ? update.is('university_policy', null) : update.eq('university_policy', expectedPolicy);
    const { data, error } = await update.select('id, university_policy').maybeSingle();
    if (error) return json({ error: 'تعذر تأكيد الحفظ. النص باقٍ أمامك؛ أعد المحاولة.' }, 503);
    if (!data) {
      const current = await access.supabase.from('projects').select('id, university_policy').eq('id', projectId).eq('user_id', access.user.id).maybeSingle();
      if (current.error) return json({ error: 'تعذر تأكيد الحفظ. النص باقٍ أمامك؛ أعد المحاولة.' }, 503);
      if (!current.data) return json({ error: 'تعذر العثور على المشروع.' }, 404);
      if (current.data.university_policy === stored) return json({ saved: true, projectId, universityPolicy: policy, ...(rules === undefined ? {} : { storedPolicy: stored }) });
      return json({ error: 'تغيّرت تعليمات المشروع في نافذة أخرى. انسخ تعديلاتك ثم استرجع النسخة الأحدث.' }, 409);
    }
    if (data.id !== projectId || data.university_policy !== stored) return json({ error: 'تعذر تأكيد الحفظ. النص باقٍ أمامك؛ أعد المحاولة.' }, 503);
    return json({ saved: true, projectId, universityPolicy: policy, ...(rules === undefined ? {} : { storedPolicy: stored }) });
  } catch { return json({ error: 'تعذر تأكيد الحفظ. النص باقٍ أمامك؛ أعد المحاولة.' }, 503); }
}

/** Extraction is a preview only. Persisting instructions requires a separate reviewed save. */
export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser(); if (!access) return json({ error: 'سجّل الدخول لمتابعة مشروعك.' }, 401);
    let form: FormData;
    try {
      const bytes = await readBody(request, UNIVERSITY_GUIDE_MAX_BYTES + 65_536);
      form = await new Request('http://guide.local', { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') || '' }, body: bytes }).formData();
    } catch (error) { return json({ error: 'اختر دليل PDF نصيًا حتى 4 ميجابايت.' }, error instanceof BodyLimitError ? 413 : 422); }
    const projectId = form.get('projectId');
    if (!isUuid(projectId)) return json({ error: 'تعذر العثور على المشروع.' }, 404);
    const owned = await access.supabase.from('projects').select('id').eq('id', projectId).eq('user_id', access.user.id).maybeSingle();
    if (owned.error) return json({ error: 'تعذر استرجاع المشروع. أعد المحاولة.' }, 503);
    if (!owned.data) return json({ error: 'تعذر العثور على المشروع.' }, 404);
    const file = form.get('file');
    if (!(file instanceof File) || file.type !== 'application/pdf' || !file.size || file.size > UNIVERSITY_GUIDE_MAX_BYTES) return json({ error: 'اختر دليل PDF نصيًا حتى 4 ميجابايت.' }, 422);
    const result = await extractUniversityGuide(new Uint8Array(await file.arrayBuffer()));
    return json({ ...result, projectId, saved: false });
  } catch (error) {
    if (error instanceof Error && error.message === 'guide_no_text') return json({ error: 'لم نجد نصًا قابلًا للقراءة في الملف؛ يبدو أنه صور ممسوحة ضوئيًا. الواحة لا تقرأ الصور (OCR) حاليًا، فالصق نص التعليمات هنا أو ارفع نسخة PDF نصية.', code: 'no_text_layer' }, 422);
    return json({ error: 'تعذر قراءة الدليل كاملًا. اختر ملفًا نصيًا حتى 50 صفحة أو الصق التعليمات المطلوبة.' }, 422);
  }
}
