import { retiredAiRoute } from '@/lib/retired-ai-route';

/** Retired: see `src/lib/retired-ai-route.ts`. */
export async function POST() {
  return retiredAiRoute('/api/academic/literature-synth');
}
