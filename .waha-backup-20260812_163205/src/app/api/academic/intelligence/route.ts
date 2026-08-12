import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { papers, topic } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json({ success: false, error: 'لا توجد أبحاث كافية للتحليل الذكي' }, { status: 400 });
    }

    const papersSummary = papers.map((p: any, i: number) => `
      البحث ${i + 1}:
      العنوان: ${p.title}
      السنة: ${p.year || 'غير متوفر'}
      المؤلفون: ${p.authors}
      الاستشهادات: ${p.citedByCount || 0}
    `).join('\n---\n');

    const prompt = `أنت خبير علمي في تحليل ومؤشرات الذكاء الأكاديمي (Research Intelligence Expert). 
    قم بتحليل عينة الأبحاث التالية المتعلقة بموضوع "${topic || 'الموضوع البحثي'}" واستخرج تقريراً تحليلياً استراتيجياً يتضمن:
    1. الاتجاه العام للموضوع (صعود Rising، انخفاض Declining، أو استقرار Stable).
    2. هل الموضوع مكرر بكثافة أم يمتلك حداثة ابتكارية (isRepetitive: true/false).
    3. ملخص تحليلي لواقع الأبحاث المستجلبة.
    4. أبرز المناهج أو المحاور المتكررة.
    5. الفجوات الكبرى المكتظة أو غير المكتشفة.
    6. المجتمعات أو الفئات غير المدروسة كفاية (Unstudied Populations).
    7. توصيات استراتيجية للباحث.

    الأبحاث المستجلبة:
    ${papersSummary}

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارجية) بالشكل التالي:
    {
      "trend": "Rising / Declining / Stable",
      "isRepetitive": boolean,
      "analysisSummary": "ملخص تحليلي دقيق لواقع الأبحاث باللغة العربية",
      "topMethodologies": ["قائمة المناهج أو المحاور البارزة"],
      "researchGaps": ["الفجوات الكبرى المستخلصة"],
      "unstudiedPopulations": ["المجتمعات أو الفئات غير المدروسة"],
      "strategicRecommendations": "التوصيات الاستراتيجية للباحث"
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      return NextResponse.json({ success: true, intelligence: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد تحليل ذكاء الأبحاث عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
