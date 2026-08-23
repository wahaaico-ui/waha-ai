import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { getZoteroIntegration } from '@/lib/integrations/zotero/server';
import { listZoteroCollections } from '@/lib/integrations/zotero/client';

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasEntitlement(access.user.id, 'zotero_sync'))) return Response.json({ error: 'Subscription required' }, { status: 403 });
  const integration = await getZoteroIntegration(access.user.id);
  if (!integration) return Response.json({ error: 'Zotero is not connected' }, { status: 409 });

  const collections = await listZoteroCollections(integration.external_user_id, integration.secret.apiKey);
  return Response.json({ collections: collections.map((collection) => ({
    key: collection.key,
    name: collection.data.name,
    parentCollection: collection.data.parentCollection || null,
  })) });
}
