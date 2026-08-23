import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { getZoteroIntegration } from '@/lib/integrations/zotero/server';
import { listZoteroItems, normalizeZoteroItem } from '@/lib/integrations/zotero/client';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasEntitlement(access.user.id, 'zotero_sync'))) return Response.json({ error: 'Subscription required' }, { status: 403 });

  const body = await request.json() as { projectId?: string; collectionKey?: string };
  if (!body.projectId || !(await ownsProject(body.projectId, access.user.id, access.supabase))) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }
  const integration = await getZoteroIntegration(access.user.id);
  if (!integration) return Response.json({ error: 'Zotero is not connected' }, { status: 409 });

  const items = await listZoteroItems(integration.external_user_id, integration.secret.apiKey, body.collectionKey);
  const references = items
    .filter((item) => item.data.itemType !== 'note' && item.data.itemType !== 'attachment')
    .map((item) => normalizeZoteroItem(item, body.projectId!, access.user.id));
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('project_references')
    .upsert(references, { onConflict: 'project_id,provider,external_item_key' })
    .select('id');
  if (error) return Response.json({ error: 'Could not save Zotero references' }, { status: 500 });

  return Response.json({ imported: data?.length || 0, total: references.length });
}
