/** Bibliographic data only. A source passage or a generated summary cannot
 * supply missing publication facts. Unstructured names remain literal. */
export type BibliographicName = { literal: string } | { family: string; given?: string };
export type WritingBibliography = {
  authors: BibliographicName[]; unstructuredNames: boolean;
  journal: string | null; publisher: string | null; volume: string | null;
  issue: string | null; pages: string | null; doi: string | null; type: string;
  /** Optional; read for heritage citation. Earlier saves have none. */
  editors?: BibliographicName[]; edition?: string | null; place?: string | null;
};
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const field = (v: unknown, max = 1000) => typeof v === 'string' && v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : null;
const TYPES: Record<string, string> = { journalArticle: 'article-journal', article: 'article-journal', 'article-journal': 'article-journal', 'journal-article': 'article-journal', book: 'book', bookSection: 'chapter', chapter: 'chapter', 'book-chapter': 'chapter', thesis: 'thesis', report: 'report', webpage: 'webpage', conferencePaper: 'paper-conference', 'paper-conference': 'paper-conference', 'proceedings-article': 'paper-conference' };

export function bibliographyFromReference(row: { authors: unknown; publication_title: string | null; doi: string | null; citation_data: unknown }): WritingBibliography {
  const m = object(row.citation_data) ? row.citation_data : {};
  const creators = Array.isArray(m.creators) ? m.creators.filter(c => object(c) && c.creatorType === 'author') : null;
  const editors: BibliographicName[] = (Array.isArray(m.creators) ? m.creators : []).flatMap((c): BibliographicName[] => {
    if (!object(c) || c.creatorType !== 'editor') return [];
    const family = field(c.lastName || c.family, 300), given = field(c.firstName || c.given, 300), literal = field(c.name || c.literal, 300);
    return family ? [{ family, ...(given ? { given } : {}) }] : literal ? [{ literal }] : [];
  });
  let unstructuredNames = false;
  const authors: BibliographicName[] = (creators || (Array.isArray(row.authors) ? row.authors : [])).flatMap((raw): BibliographicName[] => {
    if (object(raw)) {
      const family = field(raw.family || raw.lastName, 300), given = field(raw.given || raw.firstName, 300);
      if (family) return [{ family, ...(given ? { given } : {}) }];
      if (field(raw.literal, 300)) return [{ literal: field(raw.literal, 300)! }];
      if (creators && field(raw.name, 300)) return [{ literal: field(raw.name, 300)! }];
    }
    const name = field(typeof raw === 'string' ? raw : object(raw) ? raw.name : null, 300);
    if (!name) return [];
    // A comma explicitly separates the supplied family and given names. Do
    // not guess the last word of an Arabic, compound or institutional name.
    const parts = name.split(',').map(s => s.trim());
    if (parts.length === 2 && parts.every(Boolean)) return [{ family: parts[0], given: parts[1] }];
    unstructuredNames = true; return [{ literal: name }];
  });
  return { authors, unstructuredNames, journal: field(row.publication_title), publisher: field(m.publisher), volume: field(m.volume, 100), issue: field(m.issue, 100), pages: field(m.pages || m.page, 200), doi: field(row.doi, 300), type: TYPES[String(m.itemType || m.type)] || 'article-journal',
    ...(editors.length ? { editors } : {}), ...(field(m.edition, 100) ? { edition: field(m.edition, 100) } : {}), ...(field(m.place, 300) ? { place: field(m.place, 300) } : {}) };
}

/** Stored snapshots are read with the same bounds as authoritative metadata. */
export function readWritingBibliography(value: unknown): WritingBibliography | null {
  if (!object(value) || !Array.isArray(value.authors) || typeof value.unstructuredNames !== 'boolean'
    || typeof value.type !== 'string' || !Object.values(TYPES).includes(value.type)) return null;
  const authors: BibliographicName[] = [];
  for (const name of value.authors) {
    if (!object(name)) return null;
    if (field(name.literal, 300)) authors.push({ literal: field(name.literal, 300)! });
    else if (field(name.family, 300) && (name.given === undefined || field(name.given, 300))) authors.push({ family: field(name.family, 300)!, ...(name.given ? { given: field(name.given, 300)! } : {}) });
    else return null;
  }
  for (const key of ['journal', 'publisher', 'volume', 'issue', 'pages', 'doi'] as const) if (value[key] !== null && !field(value[key], key === 'doi' ? 300 : key === 'volume' || key === 'issue' ? 100 : key === 'pages' ? 200 : 1000)) return null;
  const editors: BibliographicName[] = [];
  if (value.editors !== undefined) {
    if (!Array.isArray(value.editors)) return null;
    for (const name of value.editors) {
      if (object(name) && field(name.literal, 300)) editors.push({ literal: field(name.literal, 300)! });
      else if (object(name) && field(name.family, 300) && (name.given === undefined || field(name.given, 300))) editors.push({ family: field(name.family, 300)!, ...(name.given ? { given: field(name.given, 300)! } : {}) });
      else return null;
    }
  }
  for (const [key, max] of [['edition', 100], ['place', 300]] as const) if (value[key] !== undefined && value[key] !== null && !field(value[key], max)) return null;
  return { authors, unstructuredNames: value.unstructuredNames, journal: value.journal as string | null, publisher: value.publisher as string | null, volume: value.volume as string | null, issue: value.issue as string | null, pages: value.pages as string | null, doi: value.doi as string | null, type: value.type,
    ...(value.editors !== undefined ? { editors } : {}), ...(value.edition ? { edition: value.edition as string } : {}), ...(value.place ? { place: value.place as string } : {}) };
}
