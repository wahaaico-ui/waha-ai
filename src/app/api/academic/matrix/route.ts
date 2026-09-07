import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { researchTopic } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!researchTopic || !researchTopic.trim()) {
      return NextResponse.json({ success: false, error: 'موضوع البحث أو مجاله مفقود' }, { status: 400 });
    }

    const prompt = `أنت باحث أكاديمي وخبير في مراجعة الأدبيات والدراسات السابقة (Literature Review Synthesis). بناءً على موضوع البحث التالي:
    "${researchTopic}"

    قم بتوليد "مصفوفة تحليل الأدبيات السابقة" (Literature Review Synthesis Matrix) تتضمن 4 إلى 5 دراسات أو أبحاث رصينة ومحكمة ذات صلة وثيقة بالموضوع، على أن يحتوي كل صف في المصفوفة على الحقول التالية:
    1. المؤلف وسنة النشر (Author & Year)
    2. هدف الدراسة (Objective)
    3. المنهجية والأداة (Methodology)
    4. النتائج الرئيسية (Key Findings)
    5. الثغرات أو أوجه القصور / الفجوة البحثية (Limitations / Research Gap)

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "matrixItems": [
        {
          "authorYear": "...",
          "objective": "...",
          "methodology": "...",
          "findings": "...",
          "limitations": "..."
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
      return NextResponse.json({ success: true, matrixData: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل التوليد عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الخادم' }, { status: 500 });
  }
}
