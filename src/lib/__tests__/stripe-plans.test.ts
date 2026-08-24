import { getStripePlanForPrice, getStripePricePlanMap } from '../billing/stripe-plans';

describe('Stripe price-to-plan mapping', () => {
  test('fails closed when no approved prices are configured', () => {
    const plans = getStripePricePlanMap({});

    expect(plans.size).toBe(0);
    expect(getStripePlanForPrice('price_attacker_controlled', {})).toBeNull();
  });

  test('maps only explicitly configured prices', () => {
    const environment = {
      STRIPE_RESEARCHER_PRICE_ID: 'price_researcher_primary',
      STRIPE_RESEARCHER_PRICE_IDS: 'price_researcher_yearly, price_researcher_team',
      STRIPE_INSTITUTIONAL_PRICE_IDS: 'price_institutional',
    };

    expect(getStripePlanForPrice('price_researcher_primary', environment)).toBe('researcher');
    expect(getStripePlanForPrice('price_researcher_yearly', environment)).toBe('researcher');
    expect(getStripePlanForPrice('price_institutional', environment)).toBe('institutional');
    expect(getStripePlanForPrice('price_unknown', environment)).toBeNull();
  });

  test('rejects a price assigned to multiple plans', () => {
    expect(() => getStripePricePlanMap({
      STRIPE_RESEARCHER_PRICE_ID: 'price_conflict',
      STRIPE_INSTITUTIONAL_PRICE_IDS: 'price_conflict',
    })).toThrow('assigned to more than one plan');
  });
});
