import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const entitled = await hasEntitlement(access.user.id, 'zotero_sync');
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('external_user_id, status, connected_at, permissions')
    .eq('user_id', access.user.id)
    .eq('provider', 'zotero')
    .maybeSingle();
  return Response.json({ entitled, integration: data || null });
}
