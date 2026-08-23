import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';

export async function DELETE() {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('user_integrations')
    .update({ status: 'revoked', access_token_encrypted: null, revoked_at: new Date().toISOString() })
    .eq('user_id', access.user.id)
    .eq('provider', 'zotero');
  if (error) return Response.json({ error: 'Could not disconnect Zotero' }, { status: 500 });
  return Response.json({ success: true });
}
