import { createServiceClient } from '@/lib/supabase/service';

export type Entitlement = 'zotero_sync' | 'academic_language_tools';

const ACTIVE_STATUSES = ['active', 'trialing'];

export async function hasEntitlement(userId: string, entitlement: Entitlement) {
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_ENTITLEMENTS === 'true') {
    return true;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle();

  if (error || !data) return false;
  if (data.current_period_end && new Date(data.current_period_end).getTime() < Date.now()) return false;

  const planEntitlements: Record<string, Entitlement[]> = {
    pro: ['zotero_sync', 'academic_language_tools'],
    expert: ['zotero_sync', 'academic_language_tools'],
    // Compatibility while existing legacy rows are migrated to `pro`.
    researcher: ['zotero_sync', 'academic_language_tools'],
    institutional: ['zotero_sync', 'academic_language_tools'],
  };

  return planEntitlements[data.plan]?.includes(entitlement) ?? false;
}
