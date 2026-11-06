/** Passion and feasibility matrix rated by the researcher (DOC-23-03). */

export type PathRating = { pathId: string; passion: number; feasibility: number };
export type Quadrant = 'pursue' | 'make-feasible' | 'reconsider-interest' | 'set-aside';

const HIGH = 4;
const MAX_PATHS = 20;

export function placeOnMatrix({ passion, feasibility }: Pick<PathRating, 'passion' | 'feasibility'>): Quadrant {
  if (passion >= HIGH && feasibility >= HIGH) return 'pursue';
  if (passion >= HIGH) return 'make-feasible';
  if (feasibility >= HIGH) return 'reconsider-interest';
  return 'set-aside';
}

const isRating = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;

/** Whole ratings 1–5, one per path; anything else rejects the whole set. */
export function parseRatings(value: unknown): PathRating[] | null {
  if (!Array.isArray(value) || value.length > MAX_PATHS) return null;
  const seen = new Set<string>();
  const ratings: PathRating[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const { pathId, passion, feasibility } = item as Record<string, unknown>;
    if (typeof pathId !== 'string' || !pathId.trim() || pathId.length > 200 || seen.has(pathId)) return null;
    if (!isRating(passion) || !isRating(feasibility)) return null;
    seen.add(pathId);
    ratings.push({ pathId, passion, feasibility });
  }
  return ratings;
}
