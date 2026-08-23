import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { query, discipline } = await req.json();
    const semanticScholarKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!query || !query.trim()) {
      return NextResponse.json({ success: false, error: 'استعلام البحث مفقود' }, { status: 400 });
    }

    // 1. جلب الأبحاث الحقيقية من Semantic Scholar API
    let papers: any[] = [];
    try {
      const ssRes = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,authors,year,citationCount,abstract`, {
        headers: semanticScholarKey ? { 'x-api-key': semanticScholarKey } : {}
      });
      const ssData = await ssRes.json();
      if (ssData && ssData.data) {
        papers = ssData.data.map((p: any) => ({
          title: p.title || 'عنوان غير متوفر',
          authors: p.authors ? p.authors.map((a: any) => a.name).join(', ') : 'مؤلف غير معروف',
          year: p.year || 'غير محدد',
          citations: p.citationCount || 0,
          abstract: p.abstract || 'المستخلص غير متوفر'
        }));
      }
    } catch (err) {
      console.error('Semantic Scholar fetch error:', err);
    }

    // إذا لم تتوفر نتائج كافية، نعتمد على OpenAlex كبديل أو مساند
    if (papers.length === 0) {
      try {
        const oaRes = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=5`);
        const oaData = await oaRes.json();
        if (oaData && oaData.results) {
          papers = oaData.results.map((w: any) => ({
            title: w.title || 'عنوان غير متوفر',
            authors: w.authorships ? w.authorships.map((a: any) => a.author.display_name).join(', ') : 'مؤلف غير معروف',
            year: w.publication_year || 'غير محدد',
            citations: w.cited_by_count || 0,
            abstract: w.abstract_inverted_index ? 'مستخلص متاح' : 'المستخلص غير متوفر'
          }));
        }
      } catch (err) {
        console.error('OpenAlex fetch error:', err);
      }
    }

    // 2. تحليل وتقييم جودة الأدلة عبر LLM (Groq / Gemini)
    const analysisPrompt = `أنت خبير توثيق وتقييم أدلة علمية. بناءً على الاستعلام التالي: "${query}"
    والأبحاث المسترجعة التالية:
    ${JSON.stringify(papers)}

    قم بـ:
    1. تقييم جودة وملاءمة هذه الأدلة للبحث.
    2. حساب درجة الثقة العامة (Confidence Score من 0 إلى 100).
    3. اكتشاف أي تناقضات أو فجوات بين هذه الأدلة.

    أرجع النتيجة ككائن JSON صالح حصراً بالشكل التالي:
    {
      "confidenceScore": 85,
      "evidenceQualitySummary": "تقييم تحليلي لجودة الأدلة واستنتاجاتها",
      "identifiedGaps": ["فجوة 1", "فجوة 2"],
      "synthesizedPapers": [
        {
          "title": "...",
          "authors": "...",
          "year": "...",
          "relevanceScore": "عالي / متوسط",
          "keyTakeaway": "..."
        }
      ]
    }`;

    const apiKey = groqKey || geminiKey;
    let analysisResult;

    if (groqKey) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: analysisPrompt }],
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      analysisResult = JSON.parse(data.choices[0].message.content);
    } else {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: analysisPrompt }] }],
          generationConfig: { response_mime_type: "json_object" }
        })
      });
      const data = await res.json();
      analysisResult = JSON.parse(data.candidates[0].content.parts[0].text);
    }

    return NextResponse.json({ success: true, evidenceLayer: analysisResult });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في طبقة الأدلة' }, { status: 500 });
  }
}
