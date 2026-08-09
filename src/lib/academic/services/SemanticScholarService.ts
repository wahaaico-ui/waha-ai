export interface SemanticPaper {
  paperId: string;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  url: string;
}

export class SemanticScholarService {
  public static async searchPapers(query: string, limit: number = 10): Promise<SemanticPaper[]> {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,year,citationCount,url`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`فشل الاتصال بـ Semantic Scholar: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.data) {
      return [];
    }

    return data.data.map((p: any) => ({
      paperId: p.paperId,
      title: p.title || 'عنوان غير متوفر',
      abstract: p.abstract || 'المستخلص غير متوفر',
      year: p.year || 0,
      citationCount: p.citationCount || 0,
      url: p.url || ''
    }));
  }
}
