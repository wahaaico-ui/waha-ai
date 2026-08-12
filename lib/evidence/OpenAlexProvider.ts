// @ts-nocheck
/**
 * OpenAlex Provider
 * 
 * Integration with OpenAlex API for scholarly work discovery
 * Used for finding related research, citations, and research trends
 * 
 * Docs: https://docs.openalex.org/
 */

export interface Work {
  title: string;
  doi: string;
  publicationYear: number | null;
  authors: string;
  type: string;
  citationCount?: number;
  openalex_id?: string;
}

export interface FallbackSearchResult {
  papers: Work[];
  selectedQuery: string;
  attemptCount: number;
  allGeneratedQueries: string[];
}

// قاموس ثنائي اللغة: كلمات عربية أكاديمية شائعة → مقابلها الإنجليزي
const AR_EN_DICTIONARY: Record<string, string> = {
  'الذكاء الاصطناعي': 'Artificial Intelligence',
  'التعليم': 'Education',
  'التحصيل الأكاديمي': 'Academic Achievement',
  'طالب': 'Student',
  'طلبة': 'Students',
  'جامعة': 'Higher Education',
  'جامعات': 'Universities',
  'بحث علمي': 'Research',
  'صحة': 'Healthcare',
  'طبي': 'Medical',
  'اقتصاد': 'Economics',
  'إدارة': 'Management',
  'تعلم الآلة': 'Machine Learning',
  'تعليم إلكتروني': 'Online Learning',
  'بيانات': 'Data',
  'شبكات عصبية': 'Neural Networks',
  'أثر': 'Impact',
  'استخدام': 'Use',
  'فلسطين': 'Palestine',
  'فلسطينية': 'Palestine',
  'تحليل': 'Analysis',
  'تقييم': 'Evaluation',
};

export class OpenAlexProvider {
  private static readonly BASE_URL = 'https://api.openalex.org/works';
  private static readonly USER_AGENT = 'WAHA-AI-Platform/1.0';

  /**
   * Search for research works by query string
   * Returns structured work data from OpenAlex
   */
  public static async searchWorks(query: string, limit: number = 10): Promise<Work[]> {
    try {
      const url = `${this.BASE_URL}?search=${encodeURIComponent(query)}&per_page=${limit}`;
      const response = await fetch(url, {
        headers: { 
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`OpenAlex API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return (data.results || []).map((work: Record<string, unknown>) => ({
        title: work.title || 'Untitled Paper',
        doi: work.doi || 'No DOI Available',
        publicationYear: (work.publication_year as number | null) || null,
        authors: (((work.authorships as Array<Record<string, unknown>> | undefined) || [])
          .map((a) => (a.author as Record<string, unknown> | undefined)?.display_name)
          .filter((value): value is string => Boolean(value))
          .join(', ')) || 'Unknown',
        type: (work.type as string) || 'journal-article',
        citationCount: (work.cited_by_count as number) || 0,
        openalex_id: (work.id as string | undefined) || undefined
      }));
    } catch (error) {
      console.error('OpenAlex search error:', error);
      return [];
    }
  }

  /**
   * يحول نص عربي لعدة استعلامات بحث إنجليزية، من الأدق للأعم
   */
  private static generateFallbackQueries(arabicText: string): string[] {
    const foundTerms: string[] = [];

    for (const [arabicKey, englishValue] of Object.entries(AR_EN_DICTIONARY)) {
      if (arabicText.includes(arabicKey)) {
        foundTerms.push(englishValue);
      }
    }

    if (foundTerms.length === 0) {
      return ['Education', 'Research'];
    }

    const queries: string[] = [];

    // الاستعلام الأدق: كل الكلمات المكتشفة مع بعض
    queries.push(foundTerms.join(' '));

    // استعلامات أعم تدريجيًا: نشيل كلمة من الآخر كل مرة
    for (let i = foundTerms.length - 1; i > 0; i--) {
      queries.push(foundTerms.slice(0, i).join(' '));
    }

    // أعم استعلام ممكن: أول كلمتين بس أو كلمة وحدة
    if (foundTerms.length > 1) {
      queries.push(foundTerms[0]);
    }

    // إزالة التكرار
    return Array.from(new Set(queries));
  }

  /**
   * بحث بمحاولات متعددة (Fallback): يجرب كل استعلام لحد ما يلاقي نتائج
   */
  public static async searchWithFallback(rawText: string, limit: number = 10): Promise<FallbackSearchResult> {
    const isArabic = /[\u0600-\u06FF]/.test(rawText);
    const queries = isArabic ? this.generateFallbackQueries(rawText) : [rawText];

    let attemptCount = 0;

    for (const query of queries) {
      attemptCount++;
      const papers = await this.searchWorks(query, limit);

      if (papers.length > 0) {
        return {
          papers,
          selectedQuery: query,
          attemptCount,
          allGeneratedQueries: queries,
        };
      }
    }

    return {
      papers: [],
      selectedQuery: queries[queries.length - 1] || rawText,
      attemptCount,
      allGeneratedQueries: queries,
    };
  }
}
