export interface OpenAlexPaper {
  id: string;
  title: string;
  doi: string | null;
  publicationYear: number;
  citedByCount: number;
  authors: string[];
  pdfUrl: string | null;
}

export class OpenAlexService {
  public static async searchWorks(query: string, perPage: number = 10): Promise<OpenAlexPaper[]> {
    const email = process.env.OPENALEX_EMAIL || 'researcher@waha.ai';
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${perPage}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': `WahaAcademicEngine/1.0 (mailto:${email})`
      }
    });

    if (!response.ok) {
      throw new Error(`فشل الاتصال بـ OpenAlex: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.results) {
      return [];
    }

    return data.results.map((work: any) => ({
      id: work.id,
      title: work.title || 'عنوان غير متوفر',
      doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
      publicationYear: work.publication_year || 0,
      citedByCount: work.cited_by_count || 0,
      authors: work.authorships?.map((a: any) => a.author.name) || [],
      pdfUrl: work.open_access?.oa_url || null
    }));
  }
}
