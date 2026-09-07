import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { textToCheck } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!textToCheck || !textToCheck.trim()) {
      return NextResponse.json({ success: false, error: 'النص المراد فحص أصالته مفقود' }, { status: 400 });
    }

    const prompt = `أنت خبير تدقيق أبحاث ومحكم أصالة علمية. بناءً على النص الأكاديمي التالي:
    "${textToCheck}"

    قم بتحليل مدى رصانة النص وتقييم مؤشرات الأصالة ومخاطر التطابق الشائع (Plagiarism & Originality Risk Analysis)، وقدم الآتي:
    1. تقدير نسبة الأصالة التقديرية (Estimated Originality Score %).
    2. تقييم مستوى المخاطر (منخفض / متوسط / مرتفع) مع رصد العبارات التي قد تبدو مألوفة أو متطابقة.
    3. توصيات علمية لزيادة الأصالة وتجنب التطابق (Recommendations for Enhancing Originality).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "originalityScore": 85,
      "riskLevel": "...",
      "riskPhrases": ["...", "..."],
      "recommendations": ["...", "..."]
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
      return NextResponse.json({ success: true, analysis: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل التحليل عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الخادم' }, { status: 500 });
  }
}
