export type CrossrefPaper = {
  doi: string | null;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  authors: string[];
  url: string | null;
  journal: string | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  issn: string[];
  isbn: string[];
  type: string | null;
  referenceCount: number;
  license: string | null;
};

type CrossrefDateParts = { 'date-parts'?: number[][] };

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  abstract?: string;
  author?: Array<{ given?: string; family?: string; name?: string }>;
  issued?: CrossrefDateParts;
  published?: CrossrefDateParts;
  'published-print'?: CrossrefDateParts;
  'published-online'?: CrossrefDateParts;
  'is-referenced-by-count'?: number;
  URL?: string;
  'container-title'?: string[];
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  ISSN?: string[];
  ISBN?: string[];
  type?: string;
  'reference-count'?: number;
  license?: Array<{ URL?: string }>;
};

type CrossrefResponse = {
  message?: { items?: CrossrefWork[] };
};

function publicationYear(work: CrossrefWork) {
  const dates = [work.published, work['published-print'], work['published-online'], work.issued];
  for (const date of dates) {
    const year = date?.['date-parts']?.[0]?.[0];
    if (typeof year === 'number' && Number.isInteger(year)) return year;
  }
  return 0;
}

function plainText(value?: string) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4_000);
}

export class CrossrefService implements AcademicSearchProvider {
  public readonly id = 'crossref' as const;

  public static async searchWorks(query: string, rows = 25): Promise<CrossrefPaper[]> {
    const safeRows = Math.min(100, Math.max(1, Math.trunc(rows)));
    const email = process.env.CROSSREF_EMAIL || APPLICATION_EMAIL;
    const params = new URLSearchParams({
      'query.bibliographic': query,
      rows: String(safeRows),
      select: 'DOI,title,abstract,author,issued,published,published-print,published-online,is-referenced-by-count,reference-count,URL,container-title,publisher,volume,issue,page,ISSN,ISBN,type,license',
    });
    if (email) params.set('mailto', email);

    const payload = await fetchJson<CrossrefResponse>(`https://api.crossref.org/works?${params}`, {
      headers: { 'User-Agent': `WAHA-AI/1.0 (mailto:${email})` },
    });
    return (payload.message?.items || []).flatMap((work) => {
      const title = plainText(work.title?.[0]);
      if (!title) return [];
      const authors = (work.author || []).map((author) =>
        author.name?.trim() || [author.given, author.family].filter(Boolean).join(' ').trim(),
      ).filter(Boolean);
      return [{
        doi: work.DOI?.trim().toLowerCase() || null,
        title,
        abstract: plainText(work.abstract),
        year: publicationYear(work),
        citationCount: Math.max(0, work['is-referenced-by-count'] || 0),
        authors,
        url: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : null),
        journal: plainText(work['container-title']?.[0]) || null,
        publisher: plainText(work.publisher) || null,
        volume: plainText(work.volume) || null,
        issue: plainText(work.issue) || null,
        pages: plainText(work.page) || null,
        issn: (work.ISSN || []).filter(Boolean),
        isbn: (work.ISBN || []).filter(Boolean),
        type: work.type || null,
        referenceCount: Math.max(0, work['reference-count'] || 0),
        license: work.license?.[0]?.URL || null,
      }];
    });
  }

  public async search(options: SearchOptions): Promise<AcademicPaper[]> {
    return (await CrossrefService.searchWorks(options.query, options.limit)).map((paper) => ({
      id: paper.doi || paper.title, title: paper.title, abstract: paper.abstract, year: paper.year,
      citationCount: paper.citationCount, authors: paper.authors, doi: normaliseDoi(paper.doi),
      pdfUrl: null, url: safeUrl(paper.url), source: this.id, sources: [this.id], subjects: [],
      publicationType: paper.type || 'article', openAccess: false, journal: paper.journal,
      containerTitle: paper.journal, publisher: paper.publisher, volume: paper.volume, issue: paper.issue,
      pages: paper.pages, issn: paper.issn, isbn: paper.isbn, license: paper.license,
      referencedWorksCount: paper.referenceCount,
      fieldProvenance: { title: [this.id], doi: [this.id], authors: [this.id], year: [this.id], journal: [this.id], publisher: [this.id] },
    }));
  }
}
import { APPLICATION_EMAIL, fetchJson } from '../integrations/http';
import { normaliseDoi, safeUrl } from '../integrations/normalization';
import type { AcademicPaper, AcademicSearchProvider, SearchOptions } from '../integrations/types';
