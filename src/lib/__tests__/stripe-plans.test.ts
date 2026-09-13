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
