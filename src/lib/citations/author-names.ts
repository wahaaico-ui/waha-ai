import { APPLICATION_EMAIL, ExternalApiError, fetchJson } from '@/lib/academic/integrations/http';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import type { BibliographicName } from './writing-bibliography';

/** Family and given names as a DOI registry supplied them. Discovery indexes
 * such as OpenAlex give display names only, and the family name of an Arabic,
 * compound or institutional name must not be guessed from word order. */
export type StructuredAuthorNames = { names: BibliographicName[]; source: 'crossref' | 'datacite' };

const LOOKUP = { timeoutMs: 2_500, retries: 0 };
const folded = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;

/** Registry names are used only when they describe the same authors, in the
 * same order, as the names already shown to the researcher. */
export function matchStructuredNames(displayed: string[], supplied: BibliographicName[]): BibliographicName[] | null {
  if (!displayed.length || displayed.length !== supplied.length) return null;
  for (const [index, name] of supplied.entries()) {
    const shown = ` ${folded(displayed[index])} `;
    const part = 'family' in name ? name.family : name.literal;
    if (!folded(part) || !shown.includes(` ${folded(part)} `)) return null;
  }
  return supplied.some(name => 'family' in name) ? supplied : null;
}

function personal(family: unknown, given: unknown, literal: unknown): BibliographicName | null {
  const f = text(family), g = text(given), l = text(literal);
  return f ? { family: f, ...(g ? { given: g } : {}) } : l ? { literal: l } : null;
}

async function crossref(doi: string) {
  const data = await fetchJson<{ message?: { author?: Array<{ family?: unknown; given?: unknown; name?: unknown }> } }>(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(process.env.CROSSREF_EMAIL || APPLICATION_EMAIL)}`, undefined, LOOKUP);
  return (data.message?.author || []).map(a => personal(a.family, a.given, a.name));
}

async function datacite(doi: string) {
  const data = await fetchJson<{ data?: { attributes?: { creators?: Array<{ familyName?: unknown; givenName?: unknown; name?: unknown; nameType?: unknown }> } } }>(
    `https://api.datacite.org/dois/${encodeURIComponent(doi)}`, undefined, LOOKUP);
  return (data.data?.attributes?.creators || []).map(c => c.nameType === 'Organizational' ? personal(null, null, c.name) : personal(c.familyName, c.givenName, c.name));
}

/** Looks up the DOI registry once; any failure keeps the displayed names. */
export async function resolveStructuredAuthorNames(doi: string | null | undefined, displayed: string[]): Promise<StructuredAuthorNames | null> {
  const id = normaliseDoi(doi);
  if (!id || !displayed.length) return null;
  for (const [source, read] of [['crossref', crossref], ['datacite', datacite]] as const) {
    try {
      const supplied = await read(id);
      if (supplied.some(name => !name)) return null;
      const names = matchStructuredNames(displayed, supplied as BibliographicName[]);
      return names ? { names, source } : null;
    } catch (error) {
      // Only a DOI the registry does not hold moves on to the next registry.
      if (!(error instanceof ExternalApiError && error.status === 404)) return null;
    }
  }
  return null;
}
