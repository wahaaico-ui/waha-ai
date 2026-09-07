import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { researchDetails } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!researchDetails || !researchDetails.trim()) {
      return NextResponse.json({ success: false, error: 'تفاصيل البحث أو المشروع مفقودة' }, { status: 400 });
    }

    const prompt = `أنت رئيس لجنة مناقشة أبحاث ومحكم أكاديمي صارم. بناءً على تفاصيل البحث أو المشروع التالي:
    "${researchDetails}"

    قم بتوليد قائمة من 4 إلى 5 أسئلة مناقشة افتراضية قوية وصعبة (أسئلة دفاع / Viva Voce) تشمل:
    - أسئلة حول المنهجية وعينة الدراسة.
    - أسئلة حول المبررات والفجوة البحثية.
    - أسئلة حول الحدود أو التحديات المتوقعة.
    مع تقديم الإجابة النموذجية أو التوجيه الدفاعي المناسب لكل سؤال.

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "defenseQuestions": [
        {
          "question": "...",
          "category": "المنهجية / المبررات / الحدود",
          "suggestedDefense": "..."
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
      return NextResponse.json({ success: true, defenseData: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل التوليد عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الخادم' }, { status: 500 });
  }
}
