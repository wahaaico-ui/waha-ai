export type CrossrefPaper = {
  doi: string | null;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  authors: string[];
  url: string | null;
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

export class CrossrefService {
  public static async searchWorks(query: string, rows = 25): Promise<CrossrefPaper[]> {
    const safeRows = Math.min(100, Math.max(1, Math.trunc(rows)));
    const email = process.env.CROSSREF_EMAIL || process.env.OPENALEX_EMAIL;
    const params = new URLSearchParams({
      'query.bibliographic': query,
      rows: String(safeRows),
      select: 'DOI,title,abstract,author,issued,published,published-print,published-online,is-referenced-by-count,URL',
    });
    if (email) params.set('mailto', email);

    const response = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `WAHA-AI/1.0${email ? ` (mailto:${email})` : ''}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Crossref request failed with status ${response.status}`);

    const payload = await response.json() as CrossrefResponse;
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
      }];
    });
  }
}
