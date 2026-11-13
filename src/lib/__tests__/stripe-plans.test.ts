import { getStripePlanForPrice, getStripePricePlanMap, isStripeCheckoutEnabled } from '../billing/stripe-plans';

describe('Stripe price-to-plan mapping', () => {
  test('fails closed when no approved prices are configured', () => {
    const plans = getStripePricePlanMap({});

    expect(plans.size).toBe(0);
    expect(getStripePlanForPrice('price_attacker_controlled', {})).toBeNull();
  });

  test('maps only explicitly configured prices', () => {
    const environment = {
      STRIPE_PRO_PRICE_ID: 'price_pro_monthly',
      STRIPE_PRO_PRICE_IDS: 'price_pro_yearly',
      STRIPE_EXPERT_PRICE_ID: 'price_expert_monthly',
      STRIPE_INSTITUTIONAL_PRICE_IDS: 'price_institutional',
    };

    expect(getStripePlanForPrice('price_pro_monthly', environment)).toBe('pro');
    expect(getStripePlanForPrice('price_pro_yearly', environment)).toBe('pro');
    expect(getStripePlanForPrice('price_expert_monthly', environment)).toBe('expert');
    expect(getStripePlanForPrice('price_institutional', environment)).toBe('institutional');
    expect(getStripePlanForPrice('price_unknown', environment)).toBeNull();
  });

  test('rejects a price assigned to multiple plans', () => {
    expect(() => getStripePricePlanMap({
      STRIPE_PRO_PRICE_ID: 'price_conflict',
      STRIPE_EXPERT_PRICE_ID: 'price_conflict',
    })).toThrow('assigned to more than one plan');
  });

  test('keeps checkout disabled until explicitly enabled with a secret and approved price', () => {
    expect(isStripeCheckoutEnabled({ STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRO_PRICE_ID: 'price_pro' })).toBe(false);
    expect(isStripeCheckoutEnabled({ BILLING_ENABLED: 'true', STRIPE_PRO_PRICE_ID: 'price_pro' })).toBe(false);
    expect(isStripeCheckoutEnabled({ BILLING_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRO_PRICE_ID: 'price_pro' })).toBe(true);
  });

  test('maps the legacy researcher price to Pro', () => {
    expect(getStripePlanForPrice('price_legacy', { STRIPE_RESEARCHER_PRICE_ID: 'price_legacy' })).toBe('pro');
  });
});

describe('choosing a plan by name (item 3.5)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStripePriceForPlan, availableStripePlans } = require('../billing/stripe-plans') as typeof import('../billing/stripe-plans');
  const env = { BILLING_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRO_PRICE_ID: 'price_pro', STRIPE_EXPERT_PRICE_IDS: 'price_expert_a,price_expert_b' };

  test('the first configured price of each plan; none when the plan has no price', () => {
    expect(getStripePriceForPlan('pro', env)).toBe('price_pro');
    expect(getStripePriceForPlan('expert', env)).toBe('price_expert_a');
    expect(getStripePriceForPlan('institutional', env)).toBeNull();
  });

  test('plans offered for subscription: none until billing is switched on with keys and prices', () => {
    expect(availableStripePlans(env)).toEqual(['pro', 'expert']);
    expect(availableStripePlans({ ...env, BILLING_ENABLED: 'false' })).toEqual([]);
    expect(availableStripePlans({})).toEqual([]);
  });

  test('the institutional plan is never bought online; it goes to contact', () => {
    expect(availableStripePlans({ ...env, STRIPE_INSTITUTIONAL_PRICE_ID: 'price_inst' })).not.toContain('institutional');
  });
});
