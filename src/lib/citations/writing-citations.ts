import { Engine } from 'citeproc';
import csl from './csl/data.json';
import type { CitationStyle } from './types';
import type { WritingCitation, WritingDraft, WritingSource, SavedWritingCitation } from '@/lib/evidence-writing';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import { heritageBibliography, heritageNotes, type HeritageSource } from './heritage';

export { WRITING_STYLE_LABELS } from './types';
type Snapshot = Omit<WritingSource, 'text' | 'hash'>;
export type CitationIssue = { sourceKey: string; title: string; reasons: ('metadata' | 'authors' | 'year' | 'names' | 'publication' | 'conflict')[] };
export type WritingCitationPlan = {
  style: CitationStyle;
  segments: { text: string; citationIds: string[]; inText: string }[];
  bibliography: { sourceKeys: string[]; text: string }[];
  issues: CitationIssue[];
  /** Numbered footnotes, only in the heritage style; the text carries their numbers. */
  notes?: string[];
};
function anchored(text: string, c: WritingCitation) { return text.slice(c.claimStart, c.claimEnd) === c.claimText; }
function sourceKey(source: Snapshot) {
  const doi = normaliseDoi(source.bibliography?.doi);
  return doi ? `doi:${doi}` : `${source.kind}:${source.id}`;
}
// Older OpenAlex saves stored an article number as "100671-100671"; it is one number, not a range.
function pageField(pages: string | null | undefined) {
  const range = pages?.match(/^\s*([^\s–-]+)\s*[–-]\s*([^\s–-]+)\s*$/);
  return range && range[1] === range[2] ? range[1] : pages || undefined;
}
function item(id: string, source: Snapshot): Record<string, unknown> {
  const b = source.bibliography;
  const doi = normaliseDoi(b?.doi);
  return { id, type: b?.type || 'article-journal', title: source.title,
    ...(b?.authors.length ? { author: b.authors } : {}),
    ...(source.year !== null ? { issued: { 'date-parts': [[source.year]] } } : {}),
    ...(b ? { 'container-title': b.journal || undefined, publisher: b.publisher || undefined, volume: b.volume || undefined, issue: b.issue || undefined, page: pageField(b.pages), DOI: doi || undefined } : {}),
    ...(source.url || doi ? { URL: source.url || `https://doi.org/${doi}` } : {}),
  };
}

function heritageSource(key: string, source: Snapshot): HeritageSource {
  const b = source.bibliography;
  return { key, title: source.title, year: source.year, authors: b?.authors || [], editors: b?.editors || [],
    edition: b?.edition || null, place: b?.place || null, publisher: b?.publisher || null,
    link: normaliseDoi(b?.doi) ? `https://doi.org/${normaliseDoi(b?.doi)}` : source.url };
}

function registerSource(sources: Map<string, Snapshot>, issues: Map<string, CitationIssue>, source: Snapshot) {
  const key = sourceKey(source), b = source.bibliography;
  const reasons: CitationIssue['reasons'] = [];
  if (!b) reasons.push('metadata');
  if (!b?.authors.length) reasons.push('authors');
  if (source.year === null) reasons.push('year');
  if (b?.unstructuredNames) reasons.push('names');
  if (b?.type === 'article-journal' && !b.journal) reasons.push('publication');
  const previous = sources.get(key);
  const comparable = (value: Snapshot) => ({ ...item(key, value), DOI: undefined, URL: undefined });
  if (previous && JSON.stringify(comparable(previous)) !== JSON.stringify(comparable(source))) reasons.push('conflict');
  if (!previous) sources.set(key, source);
  if (reasons.length) {
    const old = issues.get(key);
    issues.set(key, { sourceKey: key, title: source.title, reasons: [...new Set([...(old?.reasons || []), ...reasons])] });
  }
  return key;
}

function bibliographyEntries(processor: Engine, sources: Map<string, Snapshot>, style: CitationStyle): WritingCitationPlan['bibliography'] {
  const bibliography = processor.makeBibliography();
  return bibliography ? bibliography[1].map((text, index) => {
    const sourceKeys = bibliography[0].entry_ids[index];
    let rendered = text.trim();
    // Some styles omit the access macro when publication details are absent.
    // Retain the supplied persistent link rather than silently losing it.
    for (const key of sourceKeys) {
      const source = sources.get(key)!;
      const doi = normaliseDoi(source.bibliography?.doi);
      const link = doi ? `https://doi.org/${doi}` : source.url;
      if (link && !(doi ? rendered.toLowerCase().includes(doi) : rendered.includes(link))) {
        rendered += `${style === 'vancouver' ? ' Available from: ' : ' '}${link}`;
      }
    }
    return { sourceKeys, text: rendered };
  }) : [];
}

/** Library-only exports use the same CSL styles and supplied author name parts
 * as the evidence editor. Register the collection without inventing draft text. */
export function buildSourceBibliography(input: Snapshot[], style: CitationStyle) {
  const sources = new Map<string, Snapshot>(), issues = new Map<string, CitationIssue>();
  for (const source of input) registerSource(sources, issues, source);
  if (!sources.size) return { bibliography: [] as WritingCitationPlan['bibliography'], issues: [] as CitationIssue[] };
  if (style === 'heritage') {
    const bibliography = heritageBibliography([...sources].map(([key, source]) => heritageSource(key, source))).map(entry => ({ sourceKeys: [entry.key], text: entry.text }));
    return { bibliography, issues: [...issues.values()] };
  }
  const processor = new Engine({ retrieveLocale: () => csl.locale, retrieveItem: id => item(id, sources.get(id)!) }, csl.styles[style], 'en-US');
  processor.setOutputFormat('text');
  // These are library entries, not one giant in-text citation. The public
  // bibliography-only registration keeps CSL sorting and disambiguation while
  // avoiding the unnecessary construction of a citation containing every item.
  processor.updateUncitedItems([...sources.keys()]);
  return { bibliography: bibliographyEntries(processor, sources, style), issues: [...issues.values()] };
}

export function formatSourceCitation(source: Snapshot, style: CitationStyle, locator?: string | null): string {
  const key = sourceKey(source);
  if (style === 'heritage') return heritageNotes([{ sources: [{ source: heritageSource(key, source), page: locator?.trim().match(/^(?:pp?\.?\s*)?(\S+)$/i)?.[1] ?? null }] }])[0];
  const processor = new Engine({ retrieveLocale: () => csl.locale, retrieveItem: () => item(key, source) }, csl.styles[style], 'en-US');
  processor.setOutputFormat('text');
  const page = locator?.trim().match(/^(?:pp?\.?\s*)?(\d+(?:\s*[-–]\s*\d+)?)$/i);
  const [, updates] = processor.processCitationCluster({ citationID: 'single-source', citationItems: [{ id: key, ...(page ? { locator: page[1], label: 'page' } : {}) }], properties: { noteIndex: 0 } }, [], []);
  const result = updates[0]?.[1]?.trim() || '';
  return locator?.trim() && !page ? `${result} ${locator.trim()}` : result;
}

/** One processor registry drives both inline clusters and their bibliography.
 * Apply updates to earlier clusters too: adding another same-author/year work
 * can change an already rendered APA suffix. Never infer PDF page locators. */
export function buildWritingCitationPlan(draft: WritingDraft, knownSources: Record<string, Snapshot> = {}, style: CitationStyle = draft.citationStyle || 'apa-7'): WritingCitationPlan {
  const plan: WritingCitationPlan = { style, segments: [], bibliography: [], issues: [] };
  const sources = new Map<string, Snapshot>(), ids = new Map<string, string>();
  const issueMap = new Map<string, CitationIssue>();
  const citations = draft.citations.filter(c => anchored(draft.text, c)).sort((a, b) => a.claimStart - b.claimStart);
  for (const c of citations) {
    const source = knownSources[c.id] || (c as SavedWritingCitation).source;
    if (!source) {
      const key = `${c.sourceKind}:${c.sourceId}`;
      issueMap.set(key, { sourceKey: key, title: 'Source', reasons: ['metadata'] });
      continue;
    }
    const key = registerSource(sources, issueMap, source);
    ids.set(c.id, key);
  }
  let cursor = 0;
  for (let i = 0; i < citations.length;) {
    const c = citations[i];
    if (c.claimStart > cursor) plan.segments.push({ text: draft.text.slice(cursor, c.claimStart), citationIds: [], inText: '' });
    let end = i + 1;
    while (end < citations.length && citations[end].claimStart === c.claimStart && citations[end].claimEnd === c.claimEnd) end++;
    plan.segments.push({ text: c.claimText, citationIds: citations.slice(i, end).map(c => c.id), inText: '' });
    cursor = c.claimEnd; i = end;
  }
  if (cursor < draft.text.length) plan.segments.push({ text: draft.text.slice(cursor), citationIds: [], inText: '' });
  plan.issues = [...issueMap.values()];
  if (!sources.size) return plan;
  if (style === 'heritage') {
    // One note per cited passage, numbered in reading order; the locator is the one the researcher typed.
    const byId = new Map(citations.map(c => [c.id, c]));
    const clusters = plan.segments.flatMap((segment, index) => {
      const cited = segment.citationIds.flatMap(id => (ids.has(id) ? [byId.get(id)!] : []));
      return cited.length ? [{ index, sources: cited.map(c => ({ source: heritageSource(ids.get(c.id)!, sources.get(ids.get(c.id)!)!), volume: c.volume ?? null, page: c.page ?? null })) }] : [];
    });
    plan.notes = heritageNotes(clusters);
    clusters.forEach((cluster, number) => { plan.segments[cluster.index].inText = `(${number + 1})`; });
    plan.bibliography = heritageBibliography([...sources].map(([key, source]) => heritageSource(key, source))).map(entry => ({ sourceKeys: [entry.key], text: entry.text }));
    return plan;
  }
  const processor = new Engine({ retrieveLocale: () => csl.locale, retrieveItem: id => item(id, sources.get(id)!) }, csl.styles[style], 'en-US');
  processor.setOutputFormat('text');
  const pre: [string, number][] = [], clusters: number[] = [];
  plan.segments.forEach((segment, segmentIndex) => {
    const sourceIds = [...new Set(segment.citationIds.flatMap(id => ids.has(id) ? [ids.get(id)!] : []))];
    if (!sourceIds.length) return;
    const citationID = `cluster-${clusters.length}`; clusters.push(segmentIndex);
    const [, updates] = processor.processCitationCluster({ citationID, citationItems: sourceIds.map(id => ({ id })), properties: { noteIndex: 0 } }, pre, []);
    for (const [index, text] of updates) plan.segments[clusters[index]].inText = text.trim();
    pre.push([citationID, 0]);
  });
  plan.bibliography = bibliographyEntries(processor, sources, style);
  return plan;
}

/** Display punctuation after a parenthetical citation, without changing the
 * saved text or any evidence selection offsets. Other endings stay verbatim. */
export function writingCitationDisplay(segment: WritingCitationPlan['segments'][number]) {
  const ending = segment.inText && segment.text.match(/([.!?؟。！]+\s*)$/u);
  const suffix = ending ? ending[1] : '';
  return { text: suffix ? segment.text.slice(0, -suffix.length) : segment.text, inText: segment.inText, suffix };
}

export function citationIssueText(issue: CitationIssue, language: 'ar' | 'en') {
  const labels = language === 'ar' ? { metadata: 'أعد حفظ الربط لإضافة بيانات المرجع؛ الملف وحده لا يحدد بيانات النشر', authors: 'بيانات المؤلفين غير متاحة', year: 'سنة النشر غير متاحة', names: 'راجع فصل أسماء المؤلفين؛ عُرضت كما حُفظت دون تخمين اسم العائلة', publication: 'اسم المجلة غير متاح', conflict: 'تختلف بيانات مرجعين لهما DOI نفسه؛ استُخدمت بيانات أول ظهور' } : { metadata: 'Save the link again to include reference metadata; file text alone does not identify publication details', authors: 'Author details unavailable', year: 'Publication year unavailable', names: 'Check author name parts; full names were preserved without guessing family names', publication: 'Journal name unavailable', conflict: 'Records with the same DOI have different metadata; the first occurrence was used' };
  return `${issue.title}: ${issue.reasons.map(reason => labels[reason]).join(language === 'ar' ? '؛ ' : '; ')}`;
}
