import { OpenAlexService, OpenAlexPaper } from './OpenAlexService';
import { SemanticScholarService, SemanticPaper } from './SemanticScholarService';
import { UnpaywallService } from './UnpaywallService';

export interface UnifiedPaper {
  id: string;
  title: string;
  abstract: string;
  year: number;
  citationCount: number;
  authors: string[];
  pdfUrl: string | null;
  source: 'OpenAlex' | 'SemanticScholar';
}

export class UnifiedResearchEngine {
  public static async search(query: string, limit: number = 10): Promise<UnifiedPaper[]> {
    try {
      const [openAlexResults, semanticResults] = await Promise.all([
        OpenAlexService.searchWorks(query, limit).catch(() => [] as OpenAlexPaper[]),
        SemanticScholarService.searchPapers(query, limit).catch(() => [] as SemanticPaper[])
      ]);

      // معالجة نتائج OpenAlex والتحقق من الـ PDF عبر Unpaywall إذا لم يكن متوفراً مباشرة
      const formattedOpenAlex: UnifiedPaper[] = await Promise.all(
        openAlexResults.map(async p => {
          let pdf = p.pdfUrl;
          if (!pdf && p.doi) {
            pdf = await UnpaywallService.getPdfUrl(p.doi);
          }
          return {
            id: p.id,
            title: p.title,
            abstract: 'مستخلص متوفر عبر قاعدة بيانات OpenAlex',
            year: p.publicationYear,
            citationCount: p.citedByCount,
            authors: p.authors,
            pdfUrl: pdf,
            source: 'OpenAlex'
          };
        })
      );

      const formattedSemantic: UnifiedPaper[] = semanticResults.map(p => ({
        id: p.paperId,
        title: p.title,
        abstract: p.abstract,
        year: p.year,
        citationCount: p.citationCount,
        authors: [],
        pdfUrl: null,
        source: 'SemanticScholar'
      }));

      return [...formattedOpenAlex, ...formattedSemantic];
    } catch (error) {
      console.error('خطأ في محرك البحث الموحد:', error);
      return [];
    }
  }
}
