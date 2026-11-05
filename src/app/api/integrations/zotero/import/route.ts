import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { getZoteroIntegration } from '@/lib/integrations/zotero/server';
import { isZoteroKey, listZoteroItems, normalizeZoteroItem } from '@/lib/integrations/zotero/client';
import { createServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/research-evidence';
import { zoteroJson, zoteroReadFailure } from '@/lib/integrations/zotero/response';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  let saveAttempted = false;
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return zoteroJson({ error: 'سجل الدخول للمتابعة.', complete: false }, 401);
    if (!(await hasEntitlement(access.user.id, 'zotero_sync'))) return zoteroJson({ error: 'ربط Zotero غير متاح لخطة حسابك الحالية.', complete: false }, 403);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return zoteroJson({ error: 'اختر المشروع ومصدر المراجع من جديد.', complete: false }, 400);
    const { projectId, collectionKey } = body as Record<string, unknown>;
    if (typeof projectId !== 'string' || !isUuid(projectId) || (collectionKey !== undefined && !isZoteroKey(collectionKey))) {
      return zoteroJson({ error: 'اختر المشروع ومصدر المراجع من جديد.', complete: false }, 400);
    }
    const owns = () => ownsProject(projectId, access.user.id, access.supabase);
    if (!(await owns())) return zoteroJson({ error: 'المشروع غير موجود أو لا تملك صلاحية الوصول إليه.', complete: false }, 404);
    const integration = await getZoteroIntegration(access.user.id);
    if (!integration) return zoteroJson({ error: 'اربط حساب Zotero أولًا.', complete: false }, 409);
    const items = await listZoteroItems(integration.external_user_id, integration.secret.apiKey, collectionKey, request.signal);
    const references = items.filter(item => !['note', 'attachment'].includes(item.data.itemType))
      .map(item => normalizeZoteroItem(item, projectId, access.user.id));
    if (request.signal.aborted) throw new Error('aborted');
    if (!(await owns())) return zoteroJson({ error: 'المشروع غير موجود أو لا تملك صلاحية الوصول إليه.', complete: false }, 404);
    if (!references.length) return zoteroJson({ complete: true, imported: 0, total: 0 });
    // A single database statement preserves atomicity. count=exact confirms all
    // affected rows without relying on the API's returned-row ceiling.
    saveAttempted = true;
    const { count, error } = await createServiceClient().from('project_references')
      .upsert(references, { onConflict: 'project_id,provider,external_item_key', count: 'exact' })
      .abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]));
    if (error || count !== references.length || !(await owns())) throw new Error('save_not_confirmed');
    return zoteroJson({ complete: true, imported: count, total: references.length });
  } catch (error) {
    if (saveAttempted) return zoteroJson({ error: 'تعذر تأكيد اكتمال الاستيراد. حدّث مكتبة المشروع قبل إعادة المحاولة؛ قد تكون المراجع حُفظت.', complete: false }, 503);
    return zoteroReadFailure(error);
  }
}
