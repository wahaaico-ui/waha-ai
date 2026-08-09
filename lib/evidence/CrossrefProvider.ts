interface CrossrefAuthor {
  given?: string;
  family?: string;
}

interface CrossrefItem {
  title?: string[];
  DOI?: string;
  created?: {
    [key: string]: unknown;
    'date-parts'?: Array<Array<number | undefined>>;
  };
  author?: CrossrefAuthor[];
  type?: string;
}

interface CrossrefResult {
  title: string;
  doi: string;
  publicationYear: number | null;
  authors: string;
  type: string;
}

export class CrossrefProvider {
  public async queryMetadata(query: string): Promise<CrossrefResult[]> {
    try {
      const url = `https://crossref.org${encodeURIComponent(query)}&rows=10`;
      const response = await fetch(url, { headers: { "User-Agent": "WAHA-AI-Engine/1.0" } });
      if (!response.ok) return [];
      const data = await response.json();
      const items = (data.message?.items || []) as CrossrefItem[];
      return items.map((item) => {
        const createdParts = item.created?.['date-parts']?.[0];
        return {
          title: item.title?.[0] || 'Untitled Crossref Work',
          doi: item.DOI ? `https://doi.org/${item.DOI}` : 'No DOI Available',
          publicationYear: createdParts ? createdParts[0] ?? null : null,
          authors: item.author?.map((a) => `${a.given || ''} ${a.family || ''}`).join(', ') || 'Unknown',
          type: item.type || 'journal-article'
        } satisfies CrossrefResult;
      });
    } catch {
      return [];
    }
  }
}
