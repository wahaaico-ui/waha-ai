/**
 * Slot for a licensed full-text similarity service (for example iThenticate or
 * Copyleaks). No client is implemented until the owner holds a contract and a
 * key that can be tested; until then the report says the service was not used.
 */
export type LicensedSimilarityStatus = 'not_configured';

export function licensedSimilarityStatus(): LicensedSimilarityStatus {
  return 'not_configured';
}
