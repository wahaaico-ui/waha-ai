import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { createServiceClient } from '@/lib/supabase/service';
import { isZoteroOAuthConfigured } from '@/lib/integrations/configuration';

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const entitled = await hasEntitlement(access.user.id, 'zotero_sync');
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('user_integrations')
      .select('external_user_id, status, connected_at, permissions')
      .eq('user_id', access.user.id)
      .eq('provider', 'zotero')
      .maybeSingle();
    if (error) throw error;
    return Response.json({ entitled, configured: isZoteroOAuthConfigured(), integration: data || null }, { headers });
  } catch {
    return Response.json({ error: 'تعذر تحميل حالة التكامل. أعد المحاولة.' }, { status: 503, headers });
  }
}
