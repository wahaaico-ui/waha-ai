export type StripePlan = 'pro' | 'expert' | 'institutional';

type StripePlanEnvironment = Record<string, string | undefined>;

function parsePriceIds(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((priceId) => priceId.trim())
    .filter(Boolean);
}

export function getStripePricePlanMap(environment: StripePlanEnvironment = process.env) {
  const pricePlans = new Map<string, StripePlan>();
  const addPrices = (plan: StripePlan, values: Array<string | undefined>) => {
    for (const priceId of values.filter((value): value is string => Boolean(value))) {
      const existingPlan = pricePlans.get(priceId);
      if (existingPlan && existingPlan !== plan) {
        throw new Error(`Stripe price ${priceId} is assigned to more than one plan`);
      }
      pricePlans.set(priceId, plan);
    }
  };

  // STRIPE_RESEARCHER_* remains accepted as a backwards-compatible alias for Pro.
  addPrices('pro', [
    environment.STRIPE_PRO_PRICE_ID,
    ...parsePriceIds(environment.STRIPE_PRO_PRICE_IDS),
    environment.STRIPE_RESEARCHER_PRICE_ID,
    ...parsePriceIds(environment.STRIPE_RESEARCHER_PRICE_IDS),
  ]);
  addPrices('expert', [environment.STRIPE_EXPERT_PRICE_ID, ...parsePriceIds(environment.STRIPE_EXPERT_PRICE_IDS)]);
  addPrices('institutional', [environment.STRIPE_INSTITUTIONAL_PRICE_ID, ...parsePriceIds(environment.STRIPE_INSTITUTIONAL_PRICE_IDS)]);

  return pricePlans;
}

export function isStripeCheckoutEnabled(environment: StripePlanEnvironment = process.env) {
  return environment.BILLING_ENABLED === 'true'
    && Boolean(environment.STRIPE_SECRET_KEY)
    && getStripePricePlanMap(environment).size > 0;
}

export function getStripePlanForPrice(
  priceId: string | null | undefined,
  environment: StripePlanEnvironment = process.env,
) {
  if (!priceId) return null;
  return getStripePricePlanMap(environment).get(priceId) ?? null;
}

/** The first configured price of a plan, so the page can ask for a plan by name. */
export function getStripePriceForPlan(plan: StripePlan, environment: StripePlanEnvironment = process.env) {
  for (const [priceId, pricePlan] of getStripePricePlanMap(environment)) if (pricePlan === plan) return priceId;
  return null;
}

/** Plans a researcher can subscribe to online now. The institutional plan always goes through contact. */
export function availableStripePlans(environment: StripePlanEnvironment = process.env): StripePlan[] {
  if (!isStripeCheckoutEnabled(environment)) return [];
  return (['pro', 'expert'] as const).filter(plan => getStripePriceForPlan(plan, environment) !== null);
}
