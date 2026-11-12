/**
 * Heritage citation (التوثيق التراثي, DOC-35-02): numbered footnotes that keep
 * the volume and page of the printed book, and an alphabetical list of
 * sources. There is no official CSL style for it, so it is written out here.
 * Details a record does not hold are left out, never invented.
 */
import type { BibliographicName } from '@/lib/citations/writing-bibliography';

export type HeritageSource = {
  key: string; title: string; year: number | null;
  authors: BibliographicName[]; editors: BibliographicName[];
  edition: string | null; place: string | null; publisher: string | null;
  /** DOI link or the saved address, kept as stored. */
  link?: string | null;
};
export type HeritageCitation = { source: HeritageSource; volume?: string | null; page?: string | null };
export type HeritageCluster = { sources: HeritageCitation[] };

const join = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join('، ');
/** Name as read in a note: given name before family name. */
const spoken = (name: BibliographicName) => ('literal' in name ? name.literal : [name.given, name.family].filter(Boolean).join(' '));
/** Name as sorted in the list: family name first. */
const listed = (name: BibliographicName) => ('literal' in name ? name.literal : join([name.family, name.given]));
const names = (list: BibliographicName[], form: (name: BibliographicName) => string) => list.map(form).join(' و');

function locator(citation: HeritageCitation) {
  return join([citation.volume?.trim() && `ج${citation.volume.trim()}`, citation.page?.trim() && `ص${citation.page.trim()}`]);
}

function imprint(source: HeritageSource) {
  const place = [source.place, source.publisher].filter(Boolean).join(': ');
  return join([place, source.year !== null && String(source.year)]);
}

function fullNote(source: HeritageSource) {
  const published = imprint(source);
  return join([
    names(source.authors, spoken), source.title,
    source.editors.length > 0 && `تحقيق: ${names(source.editors, spoken)}`,
    source.edition && `ط${source.edition}`,
    published && `(${published})`,
    source.link,
  ]);
}

/** One note per cluster, in reading order: full the first time, short later, «المصدر نفسه» right after. */
export function heritageNotes(clusters: HeritageCluster[]): string[] {
  const seen = new Set<string>();
  let previous: string | null = null;
  return clusters.map(cluster => {
    const parts = cluster.sources.map(citation => {
      const { source } = citation;
      const head = cluster.sources.length === 1 && previous === source.key ? 'المصدر نفسه'
        : seen.has(source.key) ? join([names(source.authors, spoken), source.title]) : fullNote(source);
      seen.add(source.key);
      return join([head, locator(citation)]);
    });
    previous = cluster.sources.length === 1 ? cluster.sources[0].source.key : null;
    return `${parts.join('؛ ')}.`;
  });
}

/** The article «ال» does not count when ordering names. */
const sortKey = (source: HeritageSource) => (source.authors.length ? listed(source.authors[0]) : source.title).replace(/^ال/u, '');

export function heritageBibliography(sources: HeritageSource[]): Array<{ key: string; text: string }> {
  return [...sources]
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'ar') || a.title.localeCompare(b.title, 'ar'))
    .map(source => ({
      key: source.key,
      text: `${join([
        source.authors.length > 0 && [listed(source.authors[0]), ...source.authors.slice(1).map(spoken)].join(' و'),
        source.title,
        source.editors.length > 0 && `تحقيق: ${names(source.editors, spoken)}`,
        source.edition && `ط${source.edition}`,
        imprint(source),
        source.link,
      ])}.`,
    }));
}
