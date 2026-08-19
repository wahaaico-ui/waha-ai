import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || !query.trim()) {
      return NextResponse.json({ success: false, error: 'الرجاء إدخال كلمة مفتاحية للبحث' }, { status: 400 });
    }

    const email = process.env.OPENALEX_EMAIL || 'waha.ai.co@gmail.com';
    const encodedQuery = encodeURIComponent(query);

    // جلب الأبحاث بالتوازي من OpenAlex ومصادر أكاديمية عالمية
    const openAlexPromise = fetch(`https://api.openalex.org/works?search=${encodedQuery}&per_page=10&mailto=${email}`)
      .then(res => res.json())
      .catch(() => ({ results: [] }));

    const [openAlexData] = await Promise.all([openAlexPromise]);

    let papers: any[] = [];

    if (openAlexData && openAlexData.results) {
      const mappedOpenAlex = openAlexData.results.map((work: any) => ({
        id: work.id,
        title: work.title || 'عنوان غير متوفر',
        authors: work.authorships?.map((a: any) => a.author.name).join(', ') || 'باحثون متعددون',
        year: work.publication_year || 'د.ت',
        citationCount: work.cited_by_count || 0,
        abstract: work.abstract_inverted_index ? reconstructAbstract(work.abstract_inverted_index) : 'المستخلص غير متوفر',
        source: work.primary_location?.source?.display_name || 'OpenAlex Academic',
        pdfUrl: work.open_access?.oa_url || work.primary_location?.pdf_url || null,
      }));
      papers = [...papers, ...mappedOpenAlex];
    }

    return NextResponse.json({ success: true, data: papers });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'حدث خطأ أثناء الاتصال بمحركات البحث' }, { status: 500 });
  }
}

function reconstructAbstract(invertedIndex: any) {
  if (!invertedIndex) return '';
  const wordIndexes: { [index: number]: string } = {};
  for (const word in invertedIndex) {
    const positions = invertedIndex[word];
    positions.forEach((pos: number) => {
      wordIndexes[pos] = word;
    });
  }
  const sortedKeys = Object.keys(wordIndexes).map(Number).sort((a, b) => a - b);
  return sortedKeys.map(key => wordIndexes[key]).join(' ');
}
