/**
 * The researcher's own career from OpenAlex, found by ORCID iD, never by name
 * or title: a timeline of works (DOC-30-03), what cites each of the most cited
 * works (DOC-30-01), and topics the citing works move into that the researcher
 * has not published in (DOC-30-02). Citation contexts are not published by
 * OpenAlex, so they are always null.
 */
import { fetchJson } from '@/lib/academic/integrations/http';
import { withAcademicCache } from '@/lib/academic/integrations/cache';
import { openAlexUrl } from '@/lib/journal-matching';
import { translateUiText, type UiLanguage } from '@/lib/i18n/ui-text';
import type { ProjectExportModel } from '@/lib/project-export';
export { normalizeOrcid } from '@/lib/orcid';

type Group = { key?: string | number; key_display_name?: string; count?: number };
type Work = {
  id?: string; doi?: string | null; title?: string | null; publication_year?: number | null; cited_by_count?: number | null;
  primary_location?: { source?: { display_name?: string | null } | null } | null;
  primary_topic?: { id?: string; display_name?: string } | null;
  counts_by_year?: Array<{ year?: number; cited_by_count?: number }>;
};

export type TimelineItem = { id: string; title: string; year: number | null; doi: string | null; venue: string | null; citations: number; topic: string | null };
export type CitationProfile = {
  workId: string; title: string; citations: number;
  byYear: Array<{ year: number; count: number }>;
  journals: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number }>;
  /** OpenAlex does not publish the sentences that cite a work. */
  contexts: null;
};
export type NextDirection = { topicId: string; topic: string; citingWorks: number; fromWorks: Array<{ id: string; title: string }> };
export type Career = {
  orcid: string; author: { name: string; works: number; citations: number; hIndex: number | null } | null;
  timeline: TimelineItem[]; citations: CitationProfile[]; directions: NextDirection[]; checkedAt: string; source: 'openalex';
};

const TRACKED_WORKS = 5;
const MAX_DIRECTIONS = 5;
const MAX_ROWS = 5;
const CACHE_MS = 6 * 60 * 60 * 1000;

const shortId = (value: unknown) => String(value ?? '').replace('https://openalex.org/', '').trim();
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const count = (value: unknown) => (Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 0);

export function toTimeline(works: Work[]): TimelineItem[] {
  return works.flatMap(work => {
    const id = shortId(work.id), title = text(work.title);
    if (!/^W\d+$/.test(id) || !title) return [];
    return [{
      id, title, year: Number.isInteger(work.publication_year) ? work.publication_year! : null, doi: text(work.doi),
      venue: text(work.primary_location?.source?.display_name), citations: count(work.cited_by_count), topic: text(work.primary_topic?.display_name),
    }];
  }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.citations - a.citations);
}

const rows = (groups: Group[]) => groups.flatMap(group => {
  const name = text(group.key_display_name), value = count(group.count);
  return name && value ? [{ name, count: value }] : [];
}).sort((a, b) => b.count - a.count).slice(0, MAX_ROWS);

export function toCitationProfile(work: Work, countries: Group[], journals: Group[]): CitationProfile {
  return {
    workId: shortId(work.id), title: text(work.title) || '', citations: count(work.cited_by_count),
    byYear: (work.counts_by_year || []).flatMap(item => (Number.isInteger(item.year) ? [{ year: item.year!, count: count(item.cited_by_count) }] : []))
      .sort((a, b) => a.year - b.year).slice(-5),
    journals: rows(journals), countries: rows(countries), contexts: null,
  };
}

/** Topics of the works citing each tracked work, minus the topics the researcher already publishes in. */
export function toNextDirections(works: Work[], citingTopics: Record<string, Group[]>): NextDirection[] {
  const own = new Set(works.map(work => shortId(work.primary_topic?.id)).filter(Boolean));
  const titles = new Map(works.map(work => [shortId(work.id), text(work.title) || '']));
  const directions = new Map<string, NextDirection>();
  for (const [workId, groups] of Object.entries(citingTopics)) {
    for (const group of groups) {
      const topicId = shortId(group.key), topic = text(group.key_display_name), value = count(group.count);
      if (!/^T\d+$/.test(topicId) || !topic || !value || own.has(topicId)) continue;
      const current = directions.get(topicId) ?? { topicId, topic, citingWorks: 0, fromWorks: [] };
      current.citingWorks += value;
      current.fromWorks.push({ id: workId, title: titles.get(workId) || '' });
      directions.set(topicId, current);
    }
  }
  return [...directions.values()].sort((a, b) => b.citingWorks - a.citingWorks).slice(0, MAX_DIRECTIONS);
}

const groupCiting = (workId: string, by: string) => fetchJson<{ group_by?: Group[] }>(openAlexUrl('works', { filter: `cites:${workId}`, group_by: by }))
  .then(data => data.group_by || []).catch(() => [] as Group[]);

export async function loadCareer(orcid: string, now = new Date()): Promise<Career> {
  return withAcademicCache(`career:v1:${orcid}`, CACHE_MS, async () => {
    const [author, list] = await Promise.all([
      fetchJson<{ display_name?: string; works_count?: number; cited_by_count?: number; summary_stats?: { h_index?: number } }>(
        openAlexUrl(`authors/orcid:${orcid}`, { select: 'display_name,works_count,cited_by_count,summary_stats' })).catch(() => null),
      fetchJson<{ results?: Work[] }>(openAlexUrl('works', {
        filter: `author.orcid:${orcid}`, 'per-page': '100', sort: 'publication_year:desc',
        select: 'id,doi,title,publication_year,cited_by_count,primary_location,primary_topic',
      })),
    ]);
    const works = list.results || [];
    const tracked = [...works].filter(work => count(work.cited_by_count) > 0).sort((a, b) => count(b.cited_by_count) - count(a.cited_by_count)).slice(0, TRACKED_WORKS);
    const citingTopics: Record<string, Group[]> = {};
    const citations = await Promise.all(tracked.map(async work => {
      const id = shortId(work.id);
      const [detail, countries, journals, topics] = await Promise.all([
        fetchJson<Work>(openAlexUrl(`works/${id}`, { select: 'id,title,cited_by_count,counts_by_year' })).catch(() => work),
        groupCiting(id, 'authorships.countries'), groupCiting(id, 'primary_location.source.id'), groupCiting(id, 'primary_topic.id'),
      ]);
      citingTopics[id] = topics;
      return toCitationProfile(detail, countries, journals);
    }));
    return {
      orcid,
      author: author ? { name: text(author.display_name) || orcid, works: count(author.works_count), citations: count(author.cited_by_count), hIndex: count(author.summary_stats?.h_index) || null } : null,
      timeline: toTimeline(works), citations, directions: toNextDirections(works, citingTopics), checkedAt: now.toISOString(), source: 'openalex' as const,
    };
  });
}

/** The career as a file: works, what cites them and suggested directions, each with its basis (DOC-30-03). */
export function careerExportModel(career: Career, language: UiLanguage = 'ar'): ProjectExportModel {
  const ui = (message: string, values?: readonly unknown[]) => translateUiText(message, language, values);
  const date = career.checkedAt.slice(0, 10);
  return {
    language, documentDirection: language === 'en' ? 'ltr' : 'rtl',
    title: ui('المسيرة البحثية'),
    notice: ui('من بيانات OpenAlex المرتبطة بمعرّف ORCID {0} بتاريخ {1}. الأعمال تُعرف بمعرفاتها لا بعناوينها.', [career.orcid, date]),
    sections: [
      { title: ui('الباحث'), paragraphs: career.author
        ? [career.author.name, ui('الأعمال: {0}، الاستشهادات: {1}، مؤشر h: {2}.', [career.author.works, career.author.citations, career.author.hIndex ?? ui('غير معروف')])]
        : [ui('لم يُعثر على ملف باحث بهذا المعرّف في OpenAlex.')] },
      { title: ui('الأعمال المنشورة'), paragraphs: career.timeline.length
        ? career.timeline.map(item => [item.year ?? '—', item.title, item.venue, item.doi, ui('الاستشهادات: {0}', [item.citations])].filter(Boolean).join(' — '))
        : [ui('لا توجد أعمال مرتبطة بهذا المعرّف في OpenAlex.')] },
      { title: ui('تتبع الاستشهادات'), paragraphs: career.citations.length ? career.citations.flatMap(item => [
        ui('{0}: {1} استشهادًا.', [item.title, item.citations]),
        ui('حسب السنة: {0}', [item.byYear.map(year => `${year.year}: ${year.count}`).join('، ') || '—']),
        ui('أكثر المجلات استشهادًا: {0}', [item.journals.map(row => `${row.name} (${row.count})`).join('، ') || '—']),
        ui('أكثر الدول استشهادًا: {0}', [item.countries.map(row => `${row.name} (${row.count})`).join('، ') || '—']),
        ui('سياقات الاستشهاد: غير متاحة؛ لا تنشرها OpenAlex.'),
      ]) : [ui('لا توجد استشهادات مسجلة لأعمالك بعد.')] },
      { title: ui('اتجاهات تالية مقترحة'), paragraphs: career.directions.length
        ? career.directions.map(item => ui('{0}: {1} دراسة استشهدت بعملك في هذا الموضوع، ولم تنشر فيه بعد. انطلاقًا من: {2}.', [item.topic, item.citingWorks, item.fromWorks.map(work => work.title).join('؛ ')]))
        : [ui('لا تكفي الاستشهادات الحالية لاقتراح اتجاه.')] },
    ],
  };
}
