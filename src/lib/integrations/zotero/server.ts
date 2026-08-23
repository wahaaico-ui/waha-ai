import { decryptIntegrationSecret } from '@/lib/integrations/crypto';
import { createServiceClient } from '@/lib/supabase/service';

export type StoredZoteroSecret = { apiKey: string };

export async function getZoteroIntegration(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('external_user_id, access_token_encrypted, permissions, status, connected_at')
    .eq('user_id', userId)
    .eq('provider', 'zotero')
    .eq('status', 'connected')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    secret: decryptIntegrationSecret<StoredZoteroSecret>(data.access_token_encrypted),
  };
}
