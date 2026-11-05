import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { getZoteroIntegration } from '@/lib/integrations/zotero/server';
import { listZoteroCollections } from '@/lib/integrations/zotero/client';
import { zoteroJson, zoteroReadFailure } from '@/lib/integrations/zotero/response';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request?: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return zoteroJson({ error: 'سجل الدخول للمتابعة.' }, 401);
    if (!(await hasEntitlement(access.user.id, 'zotero_sync'))) return zoteroJson({ error: 'ربط Zotero غير متاح لخطة حسابك الحالية.' }, 403);
    const integration = await getZoteroIntegration(access.user.id);
    if (!integration) return zoteroJson({ error: 'اربط حساب Zotero أولًا.' }, 409);
    const collections = await listZoteroCollections(integration.external_user_id, integration.secret.apiKey, request?.signal);
    return zoteroJson({ collections: collections.map(collection => ({
      key: collection.key, name: collection.data.name, parentCollection: collection.data.parentCollection || null,
    })) });
  } catch (error) { return zoteroReadFailure(error); }
}
