import { APPLICATION_EMAIL, fetchJson } from '@/lib/academic/integrations/http';
import { withAcademicCache } from '@/lib/academic/integrations/cache';
import { classifyTiming, completeYears, type Timing } from '@/lib/idea-selection/timing';
import { rankDirections, type Direction, type TopicCount } from '@/lib/idea-selection/trends';

type GroupBy = { group_by?: Array<{ key?: string | number; key_display_name?: string; count?: number }> };

export type IdeaInsights = { query: string; timing: Timing; directions: Direction[]; recentYears: [number, number]; priorYears: [number, number]; source: 'openalex' };

const CACHE_MS = 6 * 60 * 60 * 1000;

function url(query: string, groupBy: string, years?: [number, number]) {
  const params = new URLSearchParams({ search: query, group_by: groupBy, mailto: APPLICATION_EMAIL });
  if (years) params.set('filter', `publication_year:${years[0]}-${years[1]}`);
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  return `https://api.openalex.org/works?${params}`;
}

async function topics(query: string, years: [number, number]): Promise<TopicCount[]> {
  const data = await fetchJson<GroupBy>(url(query, 'primary_topic.id', years));
  return (data.group_by || []).flatMap(group => {
    const id = String(group.key ?? '').trim();
    const name = String(group.key_display_name ?? '').trim();
    return id && name && Number.isSafeInteger(group.count) ? [{ id, name, count: group.count! }] : [];
  });
}

/** Real yearly counts and topic growth for a query; cached per query and day. */
export async function loadIdeaInsights(query: string, now = new Date()): Promise<IdeaInsights> {
  const currentYear = now.getUTCFullYear();
  const recentYears: [number, number] = [currentYear - 2, currentYear - 1];
  const priorYears: [number, number] = [currentYear - 4, currentYear - 3];
  const key = `idea-insights:${currentYear}:${query.toLowerCase()}`;
  return withAcademicCache(key, CACHE_MS, async () => {
    const [yearly, recent, prior] = await Promise.all([
      fetchJson<GroupBy>(url(query, 'publication_year')),
      topics(query, recentYears),
      topics(query, priorYears),
    ]);
    const counts = (yearly.group_by || []).flatMap(group => {
      const year = Number(group.key);
      return Number.isInteger(year) && Number.isSafeInteger(group.count) ? [{ year, count: group.count! }] : [];
    });
    return {
      query,
      timing: classifyTiming(completeYears(counts, currentYear)),
      directions: rankDirections(recent, prior),
      recentYears, priorYears, source: 'openalex' as const,
    };
  });
}
