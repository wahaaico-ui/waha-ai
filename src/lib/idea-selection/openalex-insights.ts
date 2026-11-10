import { APPLICATION_EMAIL, fetchJson } from '@/lib/academic/integrations/http';
import { withAcademicCache } from '@/lib/academic/integrations/cache';
import { classifyTiming, completeYears, windowGrowth, type Timing, type YearCount } from '@/lib/idea-selection/timing';
import { rankDirections, type Direction, type TopicCount } from '@/lib/idea-selection/trends';

type GroupBy = { group_by?: Array<{ key?: string | number; key_display_name?: string; count?: number }> };

/**
 * `title`: counted in titles, which every record has in every year.
 * `fulltext`: OpenAlex search over titles, abstracts and full text, used only
 * when titles hold too few works; recent records carry more text, so it leans
 * towards recent years even after the share correction.
 */
export type CountBasis = 'title' | 'fulltext';
export type IdeaInsights = {
  query: string; basis: CountBasis; timing: Timing; directions: Direction[];
  recentYears: [number, number]; priorYears: [number, number]; source: 'openalex';
};

const CACHE_MS = 6 * 60 * 60 * 1000;
const BASE_CACHE_MS = 24 * 60 * 60 * 1000;
const MIN_TITLE_WORKS = 20;

function url(groupBy: string, filters: string[], search?: string) {
  const params = new URLSearchParams({ group_by: groupBy, mailto: APPLICATION_EMAIL });
  if (search) params.set('search', search);
  if (filters.length) params.set('filter', filters.join(','));
  if (process.env.OPENALEX_API_KEY) params.set('api_key', process.env.OPENALEX_API_KEY);
  return `https://api.openalex.org/works?${params}`;
}

const yearCounts = (data: GroupBy): YearCount[] => (data.group_by || []).flatMap(group => {
  const year = Number(group.key);
  return Number.isInteger(year) && Number.isSafeInteger(group.count) ? [{ year, count: group.count! }] : [];
});

const topicCounts = (data: GroupBy): TopicCount[] => (data.group_by || []).flatMap(group => {
  const id = String(group.key ?? '').trim(), name = String(group.key_display_name ?? '').trim();
  return id && name && Number.isSafeInteger(group.count) ? [{ id, name, count: group.count! }] : [];
});

/** OpenAlex' own yearly totals: the baseline every topic is compared with. */
const allWorksByYear = () => withAcademicCache('idea-insights:all-works', BASE_CACHE_MS, async () => yearCounts(await fetchJson<GroupBy>(url('publication_year', []))));

/** Real yearly counts and faster-than-research topics for a query; cached per query. */
export async function loadIdeaInsights(query: string, now = new Date()): Promise<IdeaInsights> {
  const currentYear = now.getUTCFullYear();
  const recentYears: [number, number] = [currentYear - 2, currentYear - 1];
  const priorYears: [number, number] = [currentYear - 4, currentYear - 3];
  const key = `idea-insights:v2:${currentYear}:${query.toLowerCase()}`;
  return withAcademicCache(key, CACHE_MS, async () => {
    const titleFilter = `title.search:${query.replace(/[,|:]/g, ' ')}`;
    const [base, byTitle] = await Promise.all([allWorksByYear(), fetchJson<GroupBy>(url('publication_year', [titleFilter])).then(yearCounts)]);
    const titleYears = completeYears(byTitle, currentYear);
    const basis: CountBasis = titleYears.reduce((sum, y) => sum + y.count, 0) >= MIN_TITLE_WORKS ? 'title' : 'fulltext';
    const years = basis === 'title' ? titleYears : completeYears(yearCounts(await fetchJson<GroupBy>(url('publication_year', [], query))), currentYear);
    const baseYears = completeYears(base, currentYear);

    const filters = basis === 'title' ? [titleFilter] : [];
    const search = basis === 'title' ? undefined : query;
    const [recent, prior] = await Promise.all([
      fetchJson<GroupBy>(url('primary_topic.id', [...filters, `publication_year:${recentYears[0]}-${recentYears[1]}`], search)).then(topicCounts),
      fetchJson<GroupBy>(url('primary_topic.id', [...filters, `publication_year:${priorYears[0]}-${priorYears[1]}`], search)).then(topicCounts),
    ]);
    // The last two complete years against the two before them, for all of OpenAlex.
    const baseRatio = windowGrowth(baseYears.slice(1));

    return {
      query, basis, timing: classifyTiming(years, baseYears),
      directions: rankDirections(recent, prior, baseRatio),
      recentYears, priorYears, source: 'openalex' as const,
    };
  });
}
