export type StripePlan = 'researcher' | 'institutional';

type StripePlanEnvironment = Record<string, string | undefined>;

function parsePriceIds(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((priceId) => priceId.trim())
    .filter(Boolean);
}

export function getStripePricePlanMap(environment: StripePlanEnvironment = process.env) {
  const pricePlans = new Map<string, StripePlan>();
  const researcherPrices = [
    environment.STRIPE_RESEARCHER_PRICE_ID,
    ...parsePriceIds(environment.STRIPE_RESEARCHER_PRICE_IDS),
  ].filter((priceId): priceId is string => Boolean(priceId));

  for (const priceId of researcherPrices) {
    pricePlans.set(priceId, 'researcher');
  }

  for (const priceId of parsePriceIds(environment.STRIPE_INSTITUTIONAL_PRICE_IDS)) {
    const existingPlan = pricePlans.get(priceId);
    if (existingPlan && existingPlan !== 'institutional') {
      throw new Error(`Stripe price ${priceId} is assigned to more than one plan`);
    }
    pricePlans.set(priceId, 'institutional');
  }

  return pricePlans;
}

export function getStripePlanForPrice(
  priceId: string | null | undefined,
  environment: StripePlanEnvironment = process.env,
) {
  if (!priceId) return null;
  return getStripePricePlanMap(environment).get(priceId) ?? null;
}
