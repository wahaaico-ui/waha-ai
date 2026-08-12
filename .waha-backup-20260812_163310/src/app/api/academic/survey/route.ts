import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, variables } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!title) {
      return NextResponse.json({ success: false, error: 'عنوان البحث أو المشروع مطلوب' }, { status: 400 });
    }

    const prompt = `أنت خبير قياس وتطوير أدوات بحث علمي واستبيانات إحصائية. بناءً على العنوان أو المتغيرات البحثية التالية:
    - العنوان: "${title}"
    - المتغيرات: "${variables || 'متغيرات عامة'}"

    قم بتصميم استبيان أكاديمي احترافي يعتمد على مقياس ليكرت الخماسي (Likert Scale)، ويتضمن:
    1. المحاور أو المتغيرات الفرعية للاستبيان.
    2. عبارات أو بنود مقترحة لكل محور (5-6 عبارات علمية دقيقة لكل محور).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "surveySections": [
        {
          "sectionTitle": "...",
          "items": ["...", "..."]
        }
      ]
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
      return NextResponse.json({ success: true, survey: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد الاستبيان عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
