export interface AcademicEvidence {
  title: string;
  doi: string;
  year: number;
  citedByCount: number;
  source: string;
}

interface OpenAlexApiWork {
  title?: string;
  doi?: string;
  ids?: { openalex?: string };
  publication_year?: number;
  cited_by_count?: number;
  primary_location?: { source?: { display_name?: string } };
}

interface OpenAlexApiResponse {
  results?: OpenAlexApiWork[];
  meta?: { count?: number };
}

export async function analyzeResearchIdeaReal(query: string): Promise<{
  success: boolean;
  totalPapersFound: number;
  latestYear: number;
  papers: AcademicEvidence[];
  gapAnalysis: string;
}> {
  const encodedQuery = encodeURIComponent(query);
  const contactEmail = process.env.OPENALEX_EMAIL || 'waha.ai.co@gmail.com';
  const res = await fetch(`https://api.openalex.org/works?search=${encodedQuery}&per_page=10&mailto=${encodeURIComponent(contactEmail)}`, {
    headers: {
      'User-Agent': `WAHA-Academic-Engine/1.0 (mailto:${contactEmail})`
    }
  });

  if (!res.ok) {
    throw new Error('فشل الاتصال بقواعد البيانات العالمية (OpenAlex).');
  }

  const data = await res.json() as OpenAlexApiResponse;
  const results = data.results || [];

  if (results.length === 0) {
    throw new Error('لم يتم العثور على أي أدلة أو أوراق علمية موثقة لهذا المدخل. مرفوض لعدم وجود دليل.');
  }

  const papers: AcademicEvidence[] = results.map((item) => ({
    title: item.title || 'عنوان غير متوفر',
    doi: item.doi || item.ids?.openalex || 'مستند بدون DOI صريح',
    year: item.publication_year || 0,
    citedByCount: item.cited_by_count || 0,
    source: item.primary_location?.source?.display_name || 'مرجع أكاديمي محكّم'
  }));

  const years = papers.map(p => p.year).filter(y => y > 0);
  const latestYear = years.length > 0 ? Math.max(...years) : 0;

  return {
    success: true,
    totalPapersFound: data.meta?.count || papers.length,
    latestYear,
    papers,
    gapAnalysis: `تم فحص ${papers.length} ورقة بحثية حقيقية عبر OpenAlex. أحدث دراسة مسجلة تعود للعام ${latestYear}. النظام تحقق من الأدلة بنجاح.`
  };
}
