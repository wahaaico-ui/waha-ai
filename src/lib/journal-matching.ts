/**
 * Journals that publish on a topic, and research angles drawn from one
 * journal's own topics, from OpenAlex (DOC-29-02, DOC-29-03). Only what
 * OpenAlex states is shown: acceptance rates are not published there, so
 * they are always null and the page says "not available".
 */
import { APPLICATION_EMAIL, fetchJson } from '@/lib/academic/integrations/http';
import { withAcademicCache } from '@/lib/academic/integrations/cache';

type Group = { key?: string | number; key_display_name?: string; count?: number };
type GroupBy = { group_by?: Group[] };
type Source = {
  id?: string; display_name?: string; host_organization_name?: string | null; issn_l?: string | null;
  is_oa?: boolean | null; is_in_doaj?: boolean | null; apc_usd?: number | null; homepage_url?: string | null;
  summary_stats?: { h_index?: number | null } | null;
};
type Work = { title?: string | null; display_name?: string | null; publication_year?: number | null; doi?: string | null };

export type JournalMatch = {
  id: string; name: string; publisher: string | null; issn: string | null;
  /** Works on the topic in this journal, in the counted years. */
  topicWorks: number;
  openAccess: boolean | null; inDoaj: boolean | null; apcUsd: number | null; hIndex: number | null; homepage: string | null;
  /** OpenAlex publishes no acceptance rates; never estimated. */
  acceptanceRate: null;
};
export type JournalAngle = { topicId: string; topic: string; journalWorks: number; example: { title: string; year: number | null; doi: string | null } | null };
export type JournalMatches = { query: string; years: [number, number]; journals: JournalMatch[]; checkedAt: string; source: 'openalex' };
export type JournalAngles = { journalId: string; years: [number, number]; angles: JournalAngle[]; checkedAt: string; source: 'openalex' };

const MAX_JOURNALS = 8;
const MAX_ANGLES = 3;
/** A topic with fewer works in the journal is not a reliable angle. */
const MIN_ANGLE_WORKS = 3;
const CACHE_MS = 6 * 60 * 60 * 1000;

const shortId = (value: unknown) => String(value ?? '').replace('https://openalex.org/', '').trim();
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const count = (value: unknown) => (Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 0);

export function toJournalMatches(groups: Group[], sources: Source[]): JournalMatch[] {
  const details = new Map(sources.map(source => [shortId(source.id), source]));
  return groups
    .map(group => ({ id: shortId(group.key), name: text(group.key_display_name), works: count(group.count) }))
    .filter(group => /^S\d+$/.test(group.id) && group.name && group.works > 0)
    .sort((a, b) => b.works - a.works)
    .slice(0, MAX_JOURNALS)
    .map(group => {
      const source = details.get(group.id);
      return {
        id: group.id, name: group.name!, publisher: text(source?.host_organization_name), issn: text(source?.issn_l),
        topicWorks: group.works,
        openAccess: typeof source?.is_oa === 'boolean' ? source.is_oa : null,
        inDoaj: typeof source?.is_in_doaj === 'boolean' ? source.is_in_doaj : null,
        apcUsd: count(source?.apc_usd) || null,
        hIndex: count(source?.summary_stats?.h_index) || null,
        homepage: text(source?.homepage_url),
        acceptanceRate: null,
      };
    });
}

export function toJournalAngles(topics: Group[], examples: Record<string, JournalAngle['example']>): JournalAngle[] {
  return topics
    .map(topic => ({ topicId: shortId(topic.key), topic: text(topic.key_display_name), journalWorks: count(topic.count) }))
    .filter(topic => /^T\d+$/.test(topic.topicId) && topic.topic && topic.journalWorks >= MIN_ANGLE_WORKS)
    .sort((a, b) => b.journalWorks - a.journalWorks)
    .slice(0, MAX_ANGLES)
    .map(topic => ({ topicId: topic.topicId, topic: topic.topic!, journalWorks: topic.journalWorks, example: examples[topic.topicId] ?? null }));
}

/** Every OpenAlex call carries the platform key: shared server addresses are throttled without it. */
/** `path` is a list (`works`, `sources`) or one record (`works/W1`, `authors/orcid:0000-…`). */
export function openAlexUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, mailto: APPLICATION_EMAIL });
  if (process.env.OPENALEX_API_KEY) query.set('api_key', process.env.OPENALEX_API_KEY);
  return `https://api.openalex.org/${path}?${query}`;
}
const worksUrl = (params: Record<string, string>) => openAlexUrl('works', params);
const cleanQuery = (query: string) => query.replace(/[,|:]/g, ' ').replace(/\s+/g, ' ').trim();

/** Journals with the most works on the topic in the last five complete years. */
export async function loadJournalMatches(query: string, now = new Date()): Promise<JournalMatches> {
  const last = now.getUTCFullYear() - 1, years: [number, number] = [last - 4, last];
  return withAcademicCache(`journal-matches:v1:${last}:${query.toLowerCase()}`, CACHE_MS, async () => {
    const filters = [`publication_year:${years[0]}-${years[1]}`, 'primary_location.source.type:journal'];
    let groups = (await fetchJson<GroupBy>(worksUrl({ filter: [...filters, `title.search:${cleanQuery(query)}`].join(','), group_by: 'primary_location.source.id' }))).group_by || [];
    // Few titles name the topic: fall back to OpenAlex search over titles, abstracts and text.
    if (groups.reduce((sum, group) => sum + count(group.count), 0) < 20) {
      groups = (await fetchJson<GroupBy>(worksUrl({ filter: filters.join(','), search: cleanQuery(query), group_by: 'primary_location.source.id' }))).group_by || [];
    }
    const top = toJournalMatches(groups, []).map(match => match.id);
    // Details are optional: without them the journals keep their names and counts, and the rest reads unknown.
    const sources = top.length ? await fetchJson<{ results?: Source[] }>(openAlexUrl('sources', {
      filter: `openalex:${top.join('|')}`, 'per-page': String(top.length),
      select: 'id,display_name,host_organization_name,issn_l,is_oa,is_in_doaj,apc_usd,homepage_url,summary_stats',
    })).then(data => data.results || []).catch(() => [] as Source[]) : [];
    return { query, years, journals: toJournalMatches(groups, sources), checkedAt: now.toISOString(), source: 'openalex' as const };
  });
}

/** The journal's own leading topics in the last three complete years, each with its latest work. */
export async function loadJournalAngles(journalId: string, now = new Date()): Promise<JournalAngles> {
  const last = now.getUTCFullYear() - 1, years: [number, number] = [last - 2, last];
  return withAcademicCache(`journal-angles:v1:${last}:${journalId}`, CACHE_MS, async () => {
    const filter = `primary_location.source.id:${journalId},publication_year:${years[0]}-${years[1]}`;
    const topics = (await fetchJson<GroupBy>(worksUrl({ filter, group_by: 'primary_topic.id' }))).group_by || [];
    const chosen = toJournalAngles(topics, {}).map(angle => angle.topicId);
    const examples: Record<string, JournalAngle['example']> = {};
    await Promise.all(chosen.map(async topicId => {
      // An example is optional; a failed lookup leaves the angle without one.
      const work = await fetchJson<{ results?: Work[] }>(worksUrl({ filter: `${filter},primary_topic.id:${topicId}`, sort: 'publication_date:desc', 'per-page': '1', select: 'title,display_name,publication_year,doi' }))
        .then(data => data.results?.[0]).catch(() => undefined);
      const title = text(work?.title) || text(work?.display_name);
      examples[topicId] = title ? { title, year: Number.isInteger(work?.publication_year) ? work!.publication_year! : null, doi: text(work?.doi) } : null;
    }));
    return { journalId, years, angles: toJournalAngles(topics, examples), checkedAt: now.toISOString(), source: 'openalex' as const };
  });
}
