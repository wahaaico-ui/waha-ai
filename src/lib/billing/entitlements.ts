import { createServiceClient } from '@/lib/supabase/service';

export type Entitlement = 'zotero_sync' | 'academic_language_tools';

// Explicit server-only free launch: no subscription rows or billing changes.
const FREE_LAUNCH_ENTITLEMENTS: readonly Entitlement[] = ['academic_language_tools', 'zotero_sync'];

const ACTIVE_STATUSES = ['active', 'trialing'];

const PAID_PLANS = ['pro', 'expert', 'institutional', 'researcher'];

/**
 * Whether the account has an active paid plan: its exported files then carry
 * no «أُعد بمساعدة الواحة» mark (DOC-41-06). Any failure reads as the free plan.
 */
export async function hasPaidPlan(userId: string) {
  if (!userId.trim()) return false;
  try {
    const { data, error } = await createServiceClient()
      .from('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', userId)
      .in('status', ACTIVE_STATUSES)
      .maybeSingle();
    if (error || !data) return false;
    if (data.current_period_end && new Date(data.current_period_end).getTime() < Date.now()) return false;
    return PAID_PLANS.includes(data.plan);
  } catch {
    // Without the billing record the file is exported as free; the export itself never fails for it.
    return false;
  }
}

export async function hasEntitlement(userId: string, entitlement: Entitlement) {
  if (!userId.trim()) return false;
  if ((process.env.WAHA_CORE_FREE_LAUNCH ?? 'true') === 'true' && FREE_LAUNCH_ENTITLEMENTS.includes(entitlement)) return true;
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
