import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { textToRewrite } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!textToRewrite || !textToRewrite.trim()) {
      return NextResponse.json({ success: false, error: 'النص المراد إعادة صياغته مفقود' }, { status: 400 });
    }

    const prompt = `أنت خبير تدقيق لغوي ومراجع أكاديمي دولي. بناءً على النص التالي المراد إعادة صياغته:
    "${textToRewrite}"

    قم بإعادة صياغة النص بثلاثة أساليب أكاديمية مختلفة ومتميزة:
    1. أسلوب الرصانة الأكاديمية الصارمة (Strict Academic Tone): لغة علمية رصينة ومحكمة مناسبة للمجلات المتميزة.
    2. أسلوب الاختصار والوضوح (Concise & Clear Tone): صياغة مباشرة وموجزة تمنع الحشو وتبرز الفكرة بوضوح.
    3. أسلوب النبرة النقدية والتحليلية (Critical & Analytical Tone): أسلوب يربط بين الأفكار ويظهر التحليل والتعميق العلمي.

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "strictAcademic": "...",
      "conciseClear": "...",
      "criticalAnalytical": "..."
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
      return NextResponse.json({ success: true, paraphrasedResult: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل التوليد عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
