import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { sourceInput } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!sourceInput || !sourceInput.trim()) {
      return NextResponse.json({ success: false, error: 'تفاصيل المصدر مفقودة' }, { status: 400 });
    }

    const prompt = `أنت خبير توثيق ومراجع أبحاث أكاديمية. بناءً على بيانات أو وصف المصدر التالي:
    "${sourceInput}"

    قم بتنسيق هذا المصدر بدقة وفقاً لأشهر أنظمة التوثيق الأكاديمي العالمية:
    1. نظام APA (الإصدار السابع - 7th Edition)
    2. نظام IEEE (للهندسة والعلوم التقنية)
    3. نظام Harvard (هارفارد)
    4. نظام MLA (الإصدار التاسع)

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "apa": "...",
      "ieee": "...",
      "harvard": "...",
      "mla": "...",
      "notes": "أي ملاحظة حول نواقص البيانات إن وجدت (أو اكتب لا توجد)"
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
      return NextResponse.json({ success: true, citations: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل التنسيق عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
